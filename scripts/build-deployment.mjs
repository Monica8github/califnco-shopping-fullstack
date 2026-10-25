import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const app = process.env.CALIFNCO_APP || "storefront";
const workspaces = {
  admin: "apps/admin",
  automation: "apps/admin",
  storefront: "apps/storefront",
};
const workspace = workspaces[app];

if (!workspace) {
  throw new Error("CALIFNCO_APP must be admin, storefront or automation");
}

const deploymentDirectory = resolve(root, ".local/deployment");
mkdirSync(deploymentDirectory, { recursive: true });
cpSync(
  resolve(root, "api/runtime.mjs"),
  resolve(deploymentDirectory, "runtime.mjs"),
);

const environment = { ...process.env };
if (app === "automation") environment.VITE_CALIFNCO_APP = "automation";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("Run this script with npm run build:deployment");
}

execFileSync(
  process.execPath,
  [npmCli, "run", "build", "--workspace", workspace],
  { cwd: root, env: environment, stdio: "inherit" },
);

const output = resolve(root, "dist");
const workspaceOutput = resolve(root, workspace, "dist");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(workspaceOutput, output, { recursive: true });

console.log(`Prepared ${app} as an independent Vercel deployment.`);
