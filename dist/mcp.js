// MCP server — two tools: read_page and run_command
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import fs from "fs/promises";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
export function loadAgentsMcp() {
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
async function localGetPage(rootDir, serverEnv, pagePath) {
    const filePath = await resolvePath(rootDir, pagePath);
    const content = await fs.readFile(filePath, "utf8");
    const workingDir = path.dirname(filePath);
    return processComponentBlocks(content, workingDir, serverEnv);
}
async function localCallTool(rootDir, serverEnv, pagePath, command, requestEnv) {
    const filePath = await resolvePath(rootDir, pagePath);
    const content = await fs.readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(content);
    if (!isValidToolCall(command, frontmatter.specs)) {
        throw new Error(`Command not allowed: ${command.join(" ")}`);
    }
    const mergedEnv = mergeEvalEnv(serverEnv, requestEnv);
    const expandedCommand = expandCommandForExecution(command, frontmatter.specs, mergedEnv);
    const workingDir = path.dirname(filePath);
    return executeCommand(expandedCommand, workingDir, mergedEnv);
}
// ---------------------------------------------------------------------------
// Remote mode — proxies to a running statespace serve instance
// ---------------------------------------------------------------------------
async function remoteGetPage(baseUrl, pagePath) {
    const url = new URL(pagePath, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
    const response = await fetch(url.toString());
    if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
            const body = (await response.json());
            if (body.error)
                errorMsg = body.error;
        }
        catch { /* ignore */ }
        throw new Error(errorMsg);
    }
    return response.text();
}
async function remoteCallTool(baseUrl, pagePath, command, requestEnv) {
    const url = new URL(pagePath, baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
    const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, env: requestEnv }),
    });
    const body = (await response.json());
    if (!response.ok || body.error) {
        throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    return body.data;
}
// ---------------------------------------------------------------------------
// MCP server entry point
// ---------------------------------------------------------------------------
export async function startMcpServer(target, serverEnv = {}) {
    const isRemote = target.startsWith("http://") || target.startsWith("https://");
    const instructions = loadAgentsMcp();
    const server = new Server({ name: "statespace", version: "0.1.0" }, { capabilities: { tools: {} }, instructions: instructions });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "read_page",
                description: "Read any file from the application. Returns raw content. Start with README.md.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Path to the file, relative to the application root (e.g. \"README.md\", \"schema/users.md\", \"data/sales.csv\"). Defaults to README.md.",
                            default: "README.md",
                        },
                    },
                },
            },
            {
                name: "run_command",
                description: "Execute a command declared in the YAML frontmatter of a Markdown page. Call read_page on the page first to read its command declarations.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Path to the Markdown page whose frontmatter declares this tool.",
                        },
                        command: {
                            type: "array",
                            items: { type: "string" },
                            description: "The full command as an array of strings. Fixed elements must match exactly; fill in placeholders with your values.",
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
            const pagePath = args?.["path"] ?? "README.md";
            try {
                const content = isRemote
                    ? await remoteGetPage(target, pagePath)
                    : await localGetPage(target, serverEnv, pagePath);
                return { content: [{ type: "text", text: content }] };
            }
            catch (e) {
                return {
                    content: [
                        { type: "text", text: `Error: ${e.message}` },
                    ],
                    isError: true,
                };
            }
        }
        if (name === "run_command") {
            const pagePath = args?.["path"];
            const command = args?.["command"];
            const requestEnv = args?.["env"] ?? {};
            if (!pagePath || !command || command.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: path and command are required",
                        },
                    ],
                    isError: true,
                };
            }
            const envErr = validateEnvMap(requestEnv);
            if (envErr) {
                return {
                    content: [{ type: "text", text: `Error: ${envErr}` }],
                    isError: true,
                };
            }
            try {
                const result = isRemote
                    ? await remoteCallTool(target, pagePath, command, requestEnv)
                    : await localCallTool(target, serverEnv, pagePath, command, requestEnv);
                const text = [
                    result.stdout,
                    result.stderr ? `[stderr]: ${result.stderr}` : "",
                    `[exit ${result.returncode}]`,
                ]
                    .filter(Boolean)
                    .join("\n");
                return { content: [{ type: "text", text }] };
            }
            catch (e) {
                return {
                    content: [
                        { type: "text", text: `Error: ${e.message}` },
                    ],
                    isError: true,
                };
            }
        }
        return {
            content: [
                { type: "text", text: `Unknown tool: ${name}` },
            ],
            isError: true,
        };
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
//# sourceMappingURL=mcp.js.map