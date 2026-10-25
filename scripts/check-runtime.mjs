import assert from "node:assert/strict";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

process.env.VERCEL = "1";
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const deploymentRuntime = fileURLToPath(
  new URL("../.local/runtime/.local/deployment/runtime.mjs", import.meta.url),
);
mkdirSync(dirname(deploymentRuntime), { recursive: true });
copyFileSync(
  fileURLToPath(new URL("../api/runtime.mjs", import.meta.url)),
  deploymentRuntime,
);
const { default: handle } = await import("../.local/runtime/api/index.js");
const server = createServer(handle);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/api/health", "/api?route=health"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.mode, "setup-required");
    assert.equal(body.service, "califnco");
  }
  console.log(
    "Compiled Node ESM API starts and both Vercel health routes respond.",
  );
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
