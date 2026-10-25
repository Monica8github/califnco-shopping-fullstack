declare module "../.local/deployment/runtime.mjs" {
  import type { IncomingMessage, ServerResponse } from "node:http";

  export function handle(
    request: IncomingMessage & { body?: unknown },
    response: ServerResponse,
  ): Promise<void>;
}