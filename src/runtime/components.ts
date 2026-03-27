// Component block rendering — mirrors eval.rs
import { spawn } from "child_process";
import { getSandboxPath, isReservedEnvKey } from "./env.js";

const EVAL_BLOCK_TIMEOUT_MS = 5_000;
const EVAL_MAX_BLOCKS = 20;
const EVAL_MAX_OUTPUT_BYTES = 1024 * 1024;

interface EvalBlock {
  start: number;
  end: number;
  code: string;
}

function findClosingFence(content: string): number | null {
  let pos = 0;
  while (pos < content.length) {
    const fenceIdx = content.indexOf("```", pos);
    if (fenceIdx === -1) return null;
    if (fenceIdx === 0 || content[fenceIdx - 1] === "\n") return fenceIdx;
    pos = fenceIdx + 3;
  }
  return null;
}

function findNextEvalBlock(content: string, start: number): EvalBlock | null {
  let pos = start;

  while (pos < content.length) {
    const fenceIdx = content.indexOf("```", pos);
    if (fenceIdx === -1) return null;

    // Fence must be at start of line (or start of content)
    if (fenceIdx > 0 && content[fenceIdx - 1] !== "\n") {
      pos = fenceIdx + 3;
      continue;
    }

    const afterBackticks = content.slice(fenceIdx + 3);
    const newlinePos = afterBackticks.indexOf("\n");
    if (newlinePos === -1) {
      pos = fenceIdx + 3;
      continue;
    }

    const infoString = afterBackticks.slice(0, newlinePos).trim();
    if (infoString !== "component") {
      pos = fenceIdx + 3;
      continue;
    }

    const codeStart = fenceIdx + 3 + newlinePos + 1;
    const codeRegion = content.slice(codeStart);
    const closePos = findClosingFence(codeRegion);
    if (closePos === null) return null;

    const code = content.slice(codeStart, codeStart + closePos).replace(/\n$/, "");
    const blockEnd = codeStart + closePos + 3;

    return { start: fenceIdx, end: blockEnd, code };
  }

  return null;
}

function parseEvalBlocks(content: string): EvalBlock[] {
  const blocks: EvalBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const block = findNextEvalBlock(content, searchFrom);
    if (!block) break;
    blocks.push(block);
    searchFrom = block.end;
  }

  return blocks;
}

function executeEvalBlock(
  code: string,
  workingDir: string,
  userEnv: Record<string, string>
): Promise<string> {
  return new Promise((resolve) => {
    const sandboxPath = getSandboxPath();
    const env: Record<string, string> = {
      PATH: sandboxPath,
      HOME: "/tmp",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
    };

    for (const [k, v] of Object.entries(userEnv)) {
      if (!isReservedEnvKey(k)) env[k] = v;
    }

    const proc = spawn("sh", ["-c", code], { cwd: workingDir, env });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      proc.kill();
      resolve("[eval error: timed out after 5s]");
    }, EVAL_BLOCK_TIMEOUT_MS);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (exitCode === 0) {
        let out = stdout.trimEnd();
        if (out.length > EVAL_MAX_OUTPUT_BYTES) {
          out = out.slice(0, EVAL_MAX_OUTPUT_BYTES);
        }
        resolve(out);
      } else {
        const detail = (stderr || stdout).trimEnd().slice(0, 256);
        const msg = detail
          ? `[eval error: exit ${exitCode} — ${detail}]`
          : `[eval error: exit ${exitCode}]`;
        resolve(msg);
      }
    });

    proc.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(`[eval error: ${err.message}]`);
    });
  });
}

/** Replace all ```component blocks in content by running them as shell scripts. */
export async function processComponentBlocks(
  content: string,
  workingDir: string,
  userEnv: Record<string, string>
): Promise<string> {
  let blocks = parseEvalBlocks(content);
  if (blocks.length === 0) return content;

  if (blocks.length > EVAL_MAX_BLOCKS) {
    blocks = blocks.slice(0, EVAL_MAX_BLOCKS);
  }

  const results = await Promise.all(
    blocks.map((block) => executeEvalBlock(block.code, workingDir, userEnv))
  );

  // Replace in reverse order to preserve offsets
  let result = content;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]!;
    result = result.slice(0, block.start) + results[i] + result.slice(block.end);
  }

  return result;
}

export function hasComponentBlocks(content: string): boolean {
  return content.includes("```component");
}
