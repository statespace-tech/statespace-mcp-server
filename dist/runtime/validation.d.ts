import type { ToolSpec } from "./frontmatter.js";
export declare function isValidToolCall(command: string[], specs: ToolSpec[]): boolean;
export declare function findMatchingSpec(command: string[], specs: ToolSpec[]): ToolSpec | null;
/**
 * Expand trusted env only in spec-declared literal `$VAR` segments.
 * Placeholder-derived arguments are left opaque.
 */
export declare function expandCommandForExecution(command: string[], specs: ToolSpec[], env: Record<string, string>): string[];
