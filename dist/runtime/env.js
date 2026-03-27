// Environment variable utilities — mirrors env_validation.rs and sandbox.rs
const MAX_ENV_VAR_COUNT = 64;
const MAX_ENV_VAR_KEY_BYTES = 64;
const MAX_ENV_VAR_VALUE_BYTES = 4 * 1024;
const MAX_ENV_TOTAL_BYTES = 16 * 1024;
const RESERVED_ENV_PREFIXES = ["AWS_", "LD_", "DYLD_", "_LAMBDA", "_HANDLER"];
const RESERVED_ENV_KEYS = new Set([
    "HOME",
    "LANG",
    "LC_ALL",
    "PATH",
    "STATESPACE_SCRATCH",
    "STATESPACE_WORKSPACE",
]);
export function isReservedEnvKey(key) {
    if (RESERVED_ENV_KEYS.has(key))
        return true;
    return RESERVED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}
function isValidEnvKey(key) {
    if (key.length === 0 || key.length > MAX_ENV_VAR_KEY_BYTES)
        return false;
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
}
/** Returns an error message string, or null if valid. */
export function validateEnvMap(env) {
    const entries = Object.entries(env);
    if (entries.length > MAX_ENV_VAR_COUNT) {
        return `too many environment variables (max ${MAX_ENV_VAR_COUNT})`;
    }
    let totalBytes = 0;
    for (const [key, value] of entries) {
        if (!isValidEnvKey(key)) {
            return `invalid environment variable name '${key}'`;
        }
        if (Buffer.byteLength(value) > MAX_ENV_VAR_VALUE_BYTES) {
            return `environment variable '${key}' value is too long (max ${MAX_ENV_VAR_VALUE_BYTES} bytes)`;
        }
        // Reject control characters (ASCII 0–31 and 127)
        if (/[\x00-\x1f\x7f]/.test(value)) {
            return `environment variable '${key}' contains control characters`;
        }
        totalBytes += key.length + value.length;
        if (totalBytes > MAX_ENV_TOTAL_BYTES) {
            return `environment variables exceed total size limit (max ${MAX_ENV_TOTAL_BYTES} bytes)`;
        }
    }
    return null;
}
/**
 * Merge trusted server env on top of untrusted request env.
 * Reserved keys are stripped from both sides.
 * Trusted values win on collision.
 */
export function mergeEvalEnv(trusted, untrusted) {
    const merged = {};
    for (const [k, v] of Object.entries(untrusted)) {
        if (!isReservedEnvKey(k))
            merged[k] = v;
    }
    for (const [k, v] of Object.entries(trusted)) {
        if (!isReservedEnvKey(k))
            merged[k] = v;
    }
    return merged;
}
/**
 * Build the sandbox PATH by prepending host PATH entries before the fixed
 * defaults, deduplicating absolute entries.
 */
export function getSandboxPath() {
    const hostPath = process.env["PATH"] ?? "";
    const defaults = ["/usr/local/bin", "/usr/bin", "/bin"];
    const seen = new Set();
    const entries = [];
    for (const entry of hostPath.split(":")) {
        if (entry.startsWith("/") && entry.length > 1 && !seen.has(entry)) {
            seen.add(entry);
            entries.push(entry);
        }
    }
    for (const entry of defaults) {
        if (!seen.has(entry)) {
            seen.add(entry);
            entries.push(entry);
        }
    }
    return entries.join(":");
}
//# sourceMappingURL=env.js.map