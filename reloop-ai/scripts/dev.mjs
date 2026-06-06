/**
 * Cross-platform dev server with Node system CA store (fixes ElevenLabs SSL on Windows).
 */
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const hasHostname = args.includes("--hostname") || args.includes("-H");
const hasPort = args.includes("--port") || args.includes("-p");
const hasBundler =
  args.includes("--webpack") || args.includes("--turbo") || args.includes("--turbopack");
const port = getArgValue(args, "--port", "-p") ?? process.env.PORT ?? "3000";
const host = getArgValue(args, "--hostname", "-H") ?? "0.0.0.0";
const nextArgs = [
  "next",
  "dev",
  ...(hasBundler ? [] : ["--webpack"]),
  ...(hasHostname ? [] : ["--hostname", host]),
  ...(hasPort ? [] : ["--port", String(port)]),
  ...args,
];

const existing = process.env.NODE_OPTIONS ?? "";
if (!existing.includes("--use-system-ca")) {
  process.env.NODE_OPTIONS = `${existing} --use-system-ca`.trim();
}

const interfaceIp = getLocalExternalIp();
const networkUrl = interfaceIp
  ? `http://${interfaceIp}:${port}`
  : `http://<dgx-ip>:${port}`;

console.log("\nStarting ReLoop AI dev server...");
console.log(`  Local:   http://localhost:${port}`);
console.log(`  Network: ${networkUrl}`);
console.log(`  Bind:    ${host}:${port}\n`);

const command = process.platform === "win32" ? "cmd.exe" : "npx";
const commandArgs =
  process.platform === "win32" ? ["/d", "/s", "/c", "npx", ...nextArgs] : nextArgs;

const child = spawn(command, commandArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: process.env,
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));

function getArgValue(args, longName, shortName) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === longName || args[i] === shortName) {
      return args[i + 1];
    }
    if (args[i].startsWith(`${longName}=`)) {
      return args[i].slice(longName.length + 1);
    }
  }
  return null;
}

function getLocalExternalIp() {
  const nets = os.networkInterfaces();
  for (const addresses of Object.values(nets)) {
    if (!addresses) continue;
    for (const addr of addresses) {
      if (
        addr.family === "IPv4" &&
        !addr.internal &&
        !addr.address.startsWith("169.")
      ) {
        return addr.address;
      }
    }
  }
  return null;
}
