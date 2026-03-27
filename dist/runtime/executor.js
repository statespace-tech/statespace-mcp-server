// Tool execution with security checks — mirrors executor.rs
import { spawn } from "child_process";
import path from "path";
import { glob } from "glob";
import { getSandboxPath, isReservedEnvKey } from "./env.js";
const MAX_OUTPUT_BYTES = 1024 * 1024;
const EXECUTION_TIMEOUT_MS = 30_000;
const MAX_LIST_ITEMS = 1000;
class SecurityError extends Error {
    statusCode = 403;
    constructor(message) {
        super(message);
    }
}
class CommandNotFoundError extends Error {
    statusCode = 422;
    constructor(message) {
        super(message);
    }
}
class OutputTooLargeError extends Error {
    statusCode = 413;
    constructor(size, limit) {
        super(`Output too large: ${size} bytes (limit ${limit})`);
    }
}
function validateCommandSecurity(command) {
    if (command.length === 0) {
        throw new CommandNotFoundError("Command cannot be empty");
    }
    const cmd = command[0];
    // Mirror ToolExecutor::execute_exec security checks
    if (cmd.includes("/") || cmd.includes("\\") || cmd.includes("..")) {
        throw new SecurityError(`Path separators not allowed in command name: ${cmd}`);
    }
    // Windows drive letter check (cmd[1] === ":")
    if (cmd.length >= 2 && cmd[1] === ":") {
        throw new SecurityError(`Path separators not allowed in command name: ${cmd}`);
    }
    for (const arg of command.slice(1)) {
        if (arg.startsWith("/")) {
            throw new SecurityError(`Absolute paths not allowed in command arguments: ${arg}`);
        }
        if (arg.includes("..")) {
            throw new SecurityError(`Path traversal not allowed in command arguments: ${arg}`);
        }
    }
}
async function runGlob(pattern, workingDir) {
    if (pattern.includes("..")) {
        throw new SecurityError(`Path traversal not allowed in glob pattern: ${pattern}`);
    }
    const matches = await glob(pattern, {
        cwd: workingDir,
        nodir: false,
    });
    const limited = matches.slice(0, MAX_LIST_ITEMS);
    const stdout = limited.join("\n");
    if (stdout.length > MAX_OUTPUT_BYTES) {
        throw new OutputTooLargeError(stdout.length, MAX_OUTPUT_BYTES);
    }
    return { stdout, stderr: "", returncode: 0 };
}
async function runExec(cmd, args, workingDir, userEnv) {
    const sandboxPath = getSandboxPath();
    const env = {
        PATH: sandboxPath,
        HOME: "/tmp",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
    };
    for (const [k, v] of Object.entries(userEnv)) {
        if (!isReservedEnvKey(k))
            env[k] = v;
    }
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { cwd: workingDir, env });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const timer = setTimeout(() => {
            settled = true;
            proc.kill();
            reject(Object.assign(new Error("Command timed out after 30s"), { statusCode: 408 }));
        }, EXECUTION_TIMEOUT_MS);
        proc.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        proc.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        proc.on("error", (err) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (err.code === "ENOENT") {
                reject(new CommandNotFoundError(`Command '${cmd}' not found in PATH: ${sandboxPath}`));
            }
            else if (err.code === "EACCES") {
                reject(new CommandNotFoundError(`Command '${cmd}' not executable in PATH: ${sandboxPath}`));
            }
            else {
                reject(Object.assign(new Error(`Failed to execute ${cmd}: ${err.message}`), {
                    statusCode: 500,
                }));
            }
        });
        proc.on("close", (exitCode) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            const totalSize = stdout.length + stderr.length;
            if (totalSize > MAX_OUTPUT_BYTES) {
                reject(new OutputTooLargeError(totalSize, MAX_OUTPUT_BYTES));
                return;
            }
            // On Unix, exitCode is null when killed by signal; use 128+signal convention
            const returncode = exitCode ?? 1;
            resolve({ stdout, stderr, returncode });
        });
    });
}
/**
 * Execute a validated, expanded command in workingDir.
 * Handles the `glob` builtin and regular exec commands.
 */
export async function executeCommand(command, workingDir, userEnv) {
    validateCommandSecurity(command);
    const [cmd, ...args] = command;
    if (cmd === "glob") {
        const pattern = args[0];
        if (!pattern) {
            throw new CommandNotFoundError("glob requires a pattern argument");
        }
        return runGlob(pattern, workingDir);
    }
    // Resolve workingDir to an absolute path for safety
    const absWorkingDir = path.resolve(workingDir);
    return runExec(cmd, args, absWorkingDir, userEnv);
}
//# sourceMappingURL=executor.js.map