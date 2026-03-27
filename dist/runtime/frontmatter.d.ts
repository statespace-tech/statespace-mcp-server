export type ToolPart = {
    kind: "literal";
    value: string;
} | {
    kind: "placeholder";
    regex: RegExp | null;
};
export interface ToolSpec {
    parts: ToolPart[];
    optionsDisabled: boolean;
}
export interface Frontmatter {
    specs: ToolSpec[];
    /** Legacy string-only view of each tool (strings only, no `;`) */
    tools: string[][];
}
export declare function parseFrontmatter(content: string): Frontmatter;
export declare function hasFrontmatter(content: string): boolean;
