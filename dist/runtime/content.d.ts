/** Return the ordered list of candidate file paths for a URL path segment. */
export declare function lookupCandidates(urlPath: string): string[];
/**
 * Resolve a URL path to an absolute file path within rootDir.
 * Throws a NotFoundError (with .statusCode = 404) if nothing matches.
 */
export declare function resolvePath(rootDir: string, urlPath: string): Promise<string>;
