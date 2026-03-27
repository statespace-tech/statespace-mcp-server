// Frontmatter parsing — mirrors frontmatter.rs and spec.rs
import yaml from "js-yaml";
function parseToolPart(value) {
    if (typeof value === "string") {
        return { kind: "literal", value };
    }
    if (typeof value === "object" && value !== null) {
        const obj = value;
        if (Object.keys(obj).length === 0) {
            return { kind: "placeholder", regex: null };
        }
        if ("regex" in obj && typeof obj["regex"] === "string") {
            try {
                return { kind: "placeholder", regex: new RegExp(obj["regex"]) };
            }
            catch {
                throw new Error(`Invalid regex pattern '${obj["regex"]}'`);
            }
        }
        throw new Error(`Unknown object keys: ${Object.keys(obj).join(", ")}`);
    }
    throw new Error(`Expected string or object, got: ${typeof value}`);
}
function buildSpec(raw) {
    if (raw.length === 0)
        throw new Error("Empty tool specification");
    const optionsDisabled = raw[raw.length - 1] === ";";
    const filtered = raw.filter((v) => v !== ";");
    if (filtered.length === 0)
        throw new Error("Empty tool specification");
    const parts = filtered.map(parseToolPart);
    return { parts, optionsDisabled };
}
function extractYamlFrontmatter(content) {
    const trimmed = content.trimStart();
    if (!trimmed.startsWith("---"))
        return null;
    const after = trimmed.slice(3);
    const closePos = after.indexOf("\n---");
    if (closePos === -1)
        return null;
    return after.slice(0, closePos).trim();
}
function buildFrontmatter(rawTools) {
    const specs = [];
    const tools = [];
    for (const rawTool of rawTools) {
        specs.push(buildSpec(rawTool));
        const legacy = rawTool
            .filter((v) => typeof v === "string" && v !== ";")
            .map((v) => v);
        if (legacy.length > 0)
            tools.push(legacy);
    }
    return { specs, tools };
}
export function parseFrontmatter(content) {
    const yamlContent = extractYamlFrontmatter(content);
    if (yamlContent !== null) {
        const raw = yaml.load(yamlContent);
        return buildFrontmatter((raw?.tools ?? []));
    }
    throw new Error("No frontmatter found");
}
export function hasFrontmatter(content) {
    return content.trimStart().startsWith("---");
}
//# sourceMappingURL=frontmatter.js.map