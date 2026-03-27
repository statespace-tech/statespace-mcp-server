// Command validation and env expansion — mirrors validation.rs and spec.rs
import type { ToolSpec } from "./frontmatter.js";

export function isValidToolCall(command: string[], specs: ToolSpec[]): boolean {
  if (command.length === 0) return false;
  return findMatchingSpec(command, specs) !== null;
}

export function findMatchingSpec(
  command: string[],
  specs: ToolSpec[]
): ToolSpec | null {
  return specs.find((spec) => matchesSpec(command, spec)) ?? null;
}

function matchesSpec(command: string[], spec: ToolSpec): boolean {
  if (command.length < spec.parts.length) return false;
  if (command.length > spec.parts.length && spec.optionsDisabled) return false;

  for (let i = 0; i < spec.parts.length; i++) {
    const part = spec.parts[i]!;
    const arg = command[i]!;

    if (part.kind === "literal") {
      if (arg !== part.value) return false;
    } else if (part.kind === "placeholder") {
      if (part.regex !== null && !part.regex.test(arg)) return false;
    }
  }

  return true;
}

function expandLiteralSegment(
  segment: string,
  env: Record<string, string>
): string {
  let result = segment;
  for (const [key, value] of Object.entries(env)) {
    result = result.replaceAll(`$${key}`, value);
  }
  return result;
}

/**
 * Expand trusted env only in spec-declared literal `$VAR` segments.
 * Placeholder-derived arguments are left opaque.
 */
export function expandCommandForExecution(
  command: string[],
  specs: ToolSpec[],
  env: Record<string, string>
): string[] {
  const spec = findMatchingSpec(command, specs);
  if (!spec) return [...command];

  return command.map((part, index) => {
    const specPart = spec.parts[index];
    if (
      specPart?.kind === "literal" &&
      specPart.value === part &&
      part.includes("$")
    ) {
      return expandLiteralSegment(part, env);
    }
    return part;
  });
}
