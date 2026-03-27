/** Replace all ```component blocks in content by running them as shell scripts. */
export declare function processComponentBlocks(content: string, workingDir: string, userEnv: Record<string, string>): Promise<string>;
export declare function hasComponentBlocks(content: string): boolean;
