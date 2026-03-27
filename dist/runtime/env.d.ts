export declare function isReservedEnvKey(key: string): boolean;
/** Returns an error message string, or null if valid. */
export declare function validateEnvMap(env: Record<string, string>): string | null;
/**
 * Merge trusted server env on top of untrusted request env.
 * Reserved keys are stripped from both sides.
 * Trusted values win on collision.
 */
export declare function mergeEvalEnv(trusted: Record<string, string>, untrusted: Record<string, string>): Record<string, string>;
/**
 * Build the sandbox PATH by prepending host PATH entries before the fixed
 * defaults, deduplicating absolute entries.
 */
export declare function getSandboxPath(): string;
