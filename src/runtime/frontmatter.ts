// Frontmatter parsing — mirrors frontmatter.rs and spec.rs
import yaml from "js-yaml";

export type ToolPart =
  | { kind: "literal"; value: string }
  | { kind: "placeholder"; regex: RegExp | null };

export interface ToolSpec {
  parts: ToolPart[];
  optionsDisabled: boolean;
}

export interface Frontmatter {
  specs: ToolSpec[];
  /** Legacy string-only view of each tool (strings only, no `;`) */
  tools: string[][];
}

function parseToolPart(value: unknown): ToolPart {
  if (typeof value === "string") {
    return { kind: "literal", value };
  }
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (Object.keys(obj).length === 0) {
      return { kind: "placeholder", regex: null };
    }
    if ("regex" in obj && typeof obj["regex"] === "string") {
      try {
        return { kind: "placeholder", regex: new RegExp(obj["regex"]) };
      } catch {
        throw new Error(`Invalid regex pattern '${obj["regex"]}'`);
      }
    }
    throw new Error(`Unknown object keys: ${Object.keys(obj).join(", ")}`);
  }
  throw new Error(`Expected string or object, got: ${typeof value}`);
}

function buildSpec(raw: unknown[]): ToolSpec {
  if (raw.length === 0) throw new Error("Empty tool specification");

  const optionsDisabled = raw[raw.length - 1] === ";";
  const filtered = raw.filter((v) => v !== ";");

  if (filtered.length === 0) throw new Error("Empty tool specification");

  const parts = filtered.map(parseToolPart);
  return { parts, optionsDisabled };
}

function extractYamlFrontmatter(content: string): string | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return null;
  const after = trimmed.slice(3);
  const closePos = after.indexOf("\n---");
  if (closePos === -1) return null;
  return after.slice(0, closePos).trim();
}

function buildFrontmatter(rawTools: unknown[][]): Frontmatter {
  const specs: ToolSpec[] = [];
  const tools: string[][] = [];

  for (const rawTool of rawTools) {
    specs.push(buildSpec(rawTool));

    const legacy = rawTool
      .filter((v): v is string => typeof v === "string" && v !== ";")
      .map((v) => v);
    if (legacy.length > 0) tools.push(legacy);
  }

  return { specs, tools };
}

export function parseFrontmatter(content: string): Frontmatter {
  const yamlContent = extractYamlFrontmatter(content);
  if (yamlContent !== null) {
    const raw = yaml.load(yamlContent) as { tools?: unknown[][] } | null;
    return buildFrontmatter((raw?.tools ?? []) as unknown[][]);
  }
  throw new Error("No frontmatter found");
}

export function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith("---");
}
