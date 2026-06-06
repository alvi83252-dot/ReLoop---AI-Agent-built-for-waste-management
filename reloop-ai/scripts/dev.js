
const os = require("os");
const { spawn } = require("child_process");

const port = process.env.PORT || 3000;
const interfaceIp = getLocalExternalIp();
const networkIp = process.env.NEXT_DEV_HOST || interfaceIp || "0.0.0.0";
const localUrl = `http://localhost:${port}`;
const networkUrl = networkIp === "0.0.0.0" ? `http://<dgx-ip>:${port}` : `http://${networkIp}:${port}`;

console.log("\nStarting ReLoop AI dev server on DGX...");
console.log(`  Local:   ${localUrl}`);
console.log(`  Network: ${networkUrl}`);
console.log(`  Listening on: 0.0.0.0:${port}\n`);

const child = spawn("npx", ["next", "dev", "--hostname", "0.0.0.0", "--port", String(port)], {
  stdio: "inherit",
  shell: true,
  env: Object.assign({}, process.env, {
    HOST: "0.0.0.0",
  }),
});

child.on("exit", (code) => {
  process.exit(code || 0);
});

function getLocalExternalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const addresses = nets[name];
    if (!addresses) continue;
    for (const addr of addresses) {
      if (addr.family === "IPv4" && !addr.internal && !addr.address.startsWith("169.")) {
        return addr.address;
      }
    }
  }
  return null;
}
