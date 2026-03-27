// MCP server — two tools: read_page and run_command
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import fs from "fs/promises";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export function loadAgentsMcp(): string {
  return readFileSync(path.join(__dirname, "prompts", "mcp", "AGENTS.md"), "utf8").trim();
}
import { resolvePath } from "./runtime/content.js";
import { processComponentBlocks } from "./runtime/components.js";
import { mergeEvalEnv, validateEnvMap } from "./runtime/env.js";
import { parseFrontmatter } from "./runtime/frontmatter.js";
import { isValidToolCall, expandCommandForExecution } from "./runtime/validation.js";
import { executeCommand } from "./runtime/executor.js";

// ---------------------------------------------------------------------------
// Local mode — reads from a filesystem root
// ---------------------------------------------------------------------------

async function localGetPage(
  rootDir: string,
  serverEnv: Record<string, string>,
  pagePath: string
): Promise<string> {
  const filePath = await resolvePath(rootDir, pagePath);
  const content = await fs.readFile(filePath, "utf8");
  const workingDir = path.dirname(filePath);
  return processComponentBlocks(content, workingDir, serverEnv);
}

async function localCallTool(
  rootDir: string,
  serverEnv: Record<string, string>,
  pagePath: string,
  command: string[],
  requestEnv: Record<string, string>
): Promise<{ stdout: string; stderr: string; returncode: number }> {
  const filePath = await resolvePath(rootDir, pagePath);
  const content = await fs.readFile(filePath, "utf8");
  const frontmatter = parseFrontmatter(content);

  if (!isValidToolCall(command, frontmatter.specs)) {
    throw new Error(`Command not allowed: ${command.join(" ")}`);
  }

  const mergedEnv = mergeEvalEnv(serverEnv, requestEnv);
  const expandedCommand = expandCommandForExecution(
    command,
    frontmatter.specs,
    mergedEnv
  );
  const workingDir = path.dirname(filePath);
  return executeCommand(expandedCommand, workingDir, mergedEnv);
}

// ---------------------------------------------------------------------------
// Remote mode — proxies to a running statespace serve instance
// ---------------------------------------------------------------------------

async function remoteGetPage(
  baseUrl: string,
  pagePath: string
): Promise<string> {
  const url = new URL(pagePath, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  const response = await fetch(url.toString());
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) errorMsg = body.error;
    } catch { /* ignore */ }
    throw new Error(errorMsg);
  }
  return response.text();
}

async function remoteCallTool(
  baseUrl: string,
  pagePath: string,
  command: string[],
  requestEnv: Record<string, string>
): Promise<{ stdout: string; stderr: string; returncode: number }> {
  const url = new URL(pagePath, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, env: requestEnv }),
  });

  const body = (await response.json()) as {
    data?: { stdout: string; stderr: string; returncode: number };
    error?: string;
  };

  if (!response.ok || body.error) {
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }

  return body.data!;
}

// ---------------------------------------------------------------------------
// MCP server entry point
// ---------------------------------------------------------------------------


export async function startMcpServer(
  target: string,
  serverEnv: Record<string, string> = {}
): Promise<void> {
  const isRemote =
    target.startsWith("http://") || target.startsWith("https://");

  const instructions = loadAgentsMcp();

  const server = new Server(
    { name: "statespace", version: "0.1.0" },
    { capabilities: { tools: {} }, instructions: instructions }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "read_page",
        description: "Read any file from the application. Returns raw content. Start with README.md.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description:
                "Path to the file, relative to the application root (e.g. \"README.md\", \"schema/users.md\", \"data/sales.csv\"). Defaults to README.md.",
              default: "README.md",
            },
          },
        },
      },
      {
        name: "run_command",
        description: "Execute a command declared in the YAML frontmatter of a Markdown page. Call read_page on the page first to read its command declarations.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Path to the Markdown page whose frontmatter declares this tool.",
            },
            command: {
              type: "array",
              items: { type: "string" },
              description:
                "The full command as an array of strings. Fixed elements must match exactly; fill in placeholders with your values.",
            },
            env: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Optional environment variables to pass to the command.",
            },
          },
          required: ["path", "command"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "read_page") {
      const pagePath =
        (args?.["path"] as string | undefined) ?? "README.md";

      try {
        const content = isRemote
          ? await remoteGetPage(target, pagePath)
          : await localGetPage(target, serverEnv, pagePath);

        return { content: [{ type: "text" as const, text: content }] };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${(e as Error).message}` },
          ],
          isError: true,
        };
      }
    }

    if (name === "run_command") {
      const pagePath = args?.["path"] as string | undefined;
      const command = args?.["command"] as string[] | undefined;
      const requestEnv =
        (args?.["env"] as Record<string, string> | undefined) ?? {};

      if (!pagePath || !command || command.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: path and command are required",
            },
          ],
          isError: true,
        };
      }

      const envErr = validateEnvMap(requestEnv);
      if (envErr) {
        return {
          content: [{ type: "text" as const, text: `Error: ${envErr}` }],
          isError: true,
        };
      }

      try {
        const result = isRemote
          ? await remoteCallTool(target, pagePath, command, requestEnv)
          : await localCallTool(
              target,
              serverEnv,
              pagePath,
              command,
              requestEnv
            );

        const text = [
          result.stdout,
          result.stderr ? `[stderr]: ${result.stderr}` : "",
          `[exit ${result.returncode}]`,
        ]
          .filter(Boolean)
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (e) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${(e as Error).message}` },
          ],
          isError: true,
        };
      }
    }

    return {
      content: [
        { type: "text" as const, text: `Unknown tool: ${name}` },
      ],
      isError: true,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
