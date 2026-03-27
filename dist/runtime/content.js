// Path resolution — mirrors semantics.rs and content.rs
import path from "path";
import fs from "fs/promises";
/** Return the ordered list of candidate file paths for a URL path segment. */
export function lookupCandidates(urlPath) {
    const normalized = urlPath.replace(/^\/+/, "");
    if (normalized === "")
        return ["README.md"];
    if (normalized.endsWith("/"))
        return [`${normalized}README.md`];
    if (path.extname(normalized).toLowerCase() === ".md") {
        return [normalized];
    }
    return [`${normalized}/README.md`, `${normalized}.md`];
}
class NotFoundError extends Error {
    statusCode = 404;
    constructor(urlPath) {
        super(`Not found: ${urlPath}`);
    }
}
/**
 * Resolve a URL path to an absolute file path within rootDir.
 * Throws a NotFoundError (with .statusCode = 404) if nothing matches.
 */
export async function resolvePath(rootDir, urlPath) {
    const root = path.resolve(rootDir);
    const candidates = lookupCandidates(urlPath);
    for (const candidate of candidates) {
        const fullPath = path.join(root, candidate);
        const resolved = path.resolve(fullPath);
        // Safety: reject any path that escapes the root
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
            continue;
        }
        try {
            await fs.access(resolved, fs.constants.R_OK);
            return resolved;
        }
        catch {
            // try next candidate
        }
    }
    throw new NotFoundError(urlPath);
}
//# sourceMappingURL=content.js.map