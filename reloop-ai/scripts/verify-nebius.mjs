import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const match = line.match(/^\s*([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const endpoint = (process.env.NEBIUS_ENDPOINT ?? "https://api.tokenfactory.nebius.com/v1").replace(
  /\/$/,
  ""
);
const apiKey = process.env.NEBIUS_API_KEY;

const modelsRes = await fetch(`${endpoint}/models`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const modelsBody = await modelsRes.json();
const modelIds = (modelsBody.data ?? []).map((m) => m.id);
console.log("models:", modelIds.slice(0, 5).join(", ") || "none");

const model = modelIds[0];
if (!model) {
  console.error("FAIL: no models available");
  process.exit(1);
}

const chatRes = await fetch(`${endpoint}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [{ role: "user", content: "Reply with exactly: nebius-ok" }],
    max_tokens: 20,
  }),
});

const chatBody = await chatRes.text();
if (!chatRes.ok) {
  console.error("FAIL chat:", chatRes.status, chatBody);
  process.exit(1);
}

console.log("OK model:", model);
console.log("OK response:", chatBody.slice(0, 120));
