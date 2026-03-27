// HTTP server — mirrors statespace-server, matching its exact response shape
import http from "http";
import path from "path";
import fs from "fs/promises";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { URL } from "url";
import { resolvePath } from "./runtime/content.js";
import {
  processComponentBlocks,
  hasComponentBlocks,
} from "./runtime/components.js";
import { mergeEvalEnv, validateEnvMap } from "./runtime/env.js";
import { parseFrontmatter } from "./runtime/frontmatter.js";
import { isValidToolCall, expandCommandForExecution } from "./runtime/validation.js";
import { executeCommand } from "./runtime/executor.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BUNDLED_AGENTS_MD = readFileSync(
  path.join(__dirname, "prompts", "api", "AGENTS.md"),
  "utf8"
);

interface ActionRequest {
  command: string[];
  env?: Record<string, string>;
}

function sendJsonError(
  res: http.ServerResponse,
  status: number,
  message: string
): void {
  const body = JSON.stringify({
    error: `${message}. See /AGENTS.md for API instructions.`,
  });
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(body)),
  });
  res.end(body);
}

function sendJsonOk(res: http.ServerResponse, data: unknown): void {
  const body = JSON.stringify({ data });
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(body)),
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function handleGet(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rootDir: string,
  serverEnv: Record<string, string>,
  urlPath: string,
  queryEnv: Record<string, string>
): Promise<void> {
  const envErr = validateEnvMap(queryEnv);
  if (envErr) return sendJsonError(res, 400, envErr);

  // Serve bundled AGENTS.md if the content directory doesn't have one
  const isAgentsRequest =
    urlPath === "/AGENTS.md" || urlPath === "AGENTS.md" ||
    urlPath === "/AGENTS" || urlPath === "AGENTS";
  if (isAgentsRequest) {
    const customPath = path.join(rootDir, "AGENTS.md");
    const custom = await fs.readFile(customPath, "utf8").catch(() => null);
    const body = Buffer.from(custom ?? BUNDLED_AGENTS_MD, "utf8");
    res.writeHead(200, {
      "Content-Type": "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(body.length),
    });
    req.method === "HEAD" ? res.end() : res.end(body);
    return;
  }

  let filePath: string;
  try {
    filePath = await resolvePath(rootDir, urlPath);
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    return sendJsonError(res, err.statusCode ?? 500, err.message ?? "Internal server error");
  }

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    return sendJsonError(res, 500, "Internal server error");
  }

  const workingDir = path.dirname(filePath);
  const hasEval = hasComponentBlocks(content);
  const mergedEnv = mergeEvalEnv(serverEnv, queryEnv);
  const rendered = await processComponentBlocks(content, workingDir, mergedEnv);

  const headers: Record<string, string> = {
    "Content-Type": "text/markdown; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  if (hasEval) headers["Cache-Control"] = "no-store";

  const bodyBuf = Buffer.from(rendered, "utf8");
  headers["Content-Length"] = String(bodyBuf.length);
  res.writeHead(200, headers);

  if (req.method === "HEAD") {
    res.end();
  } else {
    res.end(bodyBuf);
  }
}

async function handlePost(
  res: http.ServerResponse,
  rootDir: string,
  serverEnv: Record<string, string>,
  urlPath: string,
  bodyStr: string
): Promise<void> {
  let request: ActionRequest;
  try {
    request = JSON.parse(bodyStr) as ActionRequest;
  } catch {
    return sendJsonError(res, 400, "Invalid JSON body");
  }

  if (
    !Array.isArray(request.command) ||
    request.command.length === 0 ||
    request.command.some((c) => typeof c !== "string")
  ) {
    return sendJsonError(res, 400, "Command cannot be empty");
  }

  const requestEnv = request.env ?? {};
  const envErr = validateEnvMap(requestEnv);
  if (envErr) return sendJsonError(res, 400, envErr);

  let filePath: string;
  try {
    filePath = await resolvePath(rootDir, urlPath);
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    return sendJsonError(res, err.statusCode ?? 500, err.message ?? "Internal server error");
  }

  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    return sendJsonError(res, 500, "Internal server error");
  }

  let frontmatter;
  try {
    frontmatter = parseFrontmatter(content);
  } catch (e) {
    return sendJsonError(res, 422, (e as Error).message);
  }

  const mergedEnv = mergeEvalEnv(serverEnv, requestEnv);
  const expandedCommand = expandCommandForExecution(
    request.command,
    frontmatter.specs,
    mergedEnv
  );

  if (!isValidToolCall(request.command, frontmatter.specs)) {
    return sendJsonError(
      res,
      422,
      `Command not allowed: ${request.command.join(" ")}`
    );
  }

  const workingDir = path.dirname(filePath);

  try {
    const result = await executeCommand(expandedCommand, workingDir, mergedEnv);
    return sendJsonOk(res, result);
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    return sendJsonError(res, err.statusCode ?? 500, err.message ?? "Internal server error");
  }
}

export function createServer(
  rootDir: string,
  serverEnv: Record<string, string> = {}
): http.Server {
  return http.createServer(async (req, res) => {
    let url: URL;
    try {
      url = new URL(`http://localhost${req.url ?? "/"}`);
    } catch {
      return sendJsonError(res, 400, "Invalid URL");
    }

    const urlPath = url.pathname === "/" ? "" : url.pathname;

    const queryEnv: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryEnv[key] = value;
    });

    if (req.method === "GET" || req.method === "HEAD") {
      return handleGet(req, res, rootDir, serverEnv, urlPath, queryEnv);
    }

    if (req.method === "POST") {
      let bodyStr: string;
      try {
        bodyStr = await readBody(req);
      } catch {
        return sendJsonError(res, 400, "Failed to read request body");
      }
      return handlePost(res, rootDir, serverEnv, urlPath, bodyStr);
    }

    return sendJsonError(res, 405, "Method not allowed");
  });
}

export function startServer(
  rootDir: string,
  options: {
    host?: string;
    port?: number;
    env?: Record<string, string>;
  } = {}
): void {
  const { host = "127.0.0.1", port = 8000, env = {} } = options;
  const server = createServer(rootDir, env);
  server.listen(port, host, () => {
    process.stderr.write(
      `Statespace serving ${rootDir} at http://${host}:${port}\n`
    );
  });
}
