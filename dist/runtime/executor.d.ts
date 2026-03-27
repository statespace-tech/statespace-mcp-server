export interface ExecResult {
    stdout: string;
    stderr: string;
    returncode: number;
}
/**
 * Execute a validated, expanded command in workingDir.
 * Handles the `glob` builtin and regular exec commands.
 */
export declare function executeCommand(command: string[], workingDir: string, userEnv: Record<string, string>): Promise<ExecResult>;
