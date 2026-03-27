import http from "http";
export declare function createServer(rootDir: string, serverEnv?: Record<string, string>): http.Server;
export declare function startServer(rootDir: string, options?: {
    host?: string;
    port?: number;
    env?: Record<string, string>;
}): void;
