/**
 * Cross-platform dev server with Node system CA store (fixes ElevenLabs SSL on Windows).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const existing = process.env.NODE_OPTIONS ?? "";
if (!existing.includes("--use-system-ca")) {
  process.env.NODE_OPTIONS = `${existing} --use-system-ca`.trim();
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  }
);

child.on("exit", (code) => process.exit(code ?? 0));
