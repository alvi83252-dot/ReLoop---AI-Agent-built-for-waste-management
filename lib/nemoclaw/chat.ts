import { spawn } from "node:child_process";

export interface NemotronChatResult {
  reply: string;
  engine: "nemoclaw" | "openclaw" | "memory";
  error?: string;
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs = 120_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function extractReply(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    for (const key of ["reply", "response", "content", "message", "text", "output"]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return JSON.stringify(parsed);
  } catch {
    return payload.trim();
  }
}

function formatHistory(history: Array<{ role: string; content: string }>): string {
  return history
    .slice(-20)
    .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
    .join("\n");
}

function buildChatPrompt(
  question: string,
  history: Array<{ role: string; content: string }>,
  memorySummary: string,
  contextSummary?: string
): string {
  const parts = [
    "You are the ReLoop AI Voice Operations Agent for the NVIDIA Hack for Impact London hackathon.",
    "Answer using specific details from earlier in this session and prior logged sessions when asked.",
    "You are in a live voice conversation — stay consistent with what you said before in this chat.",
    "Be concise (under 120 words) so responses work when spoken aloud.",
    "Focus on London circular economy, IT asset recovery, carbon, and GBP value.",
  ];

  if (memorySummary) {
    parts.push(`Session memory: ${memorySummary}`);
  }
  if (contextSummary?.trim()) {
    parts.push(`Current analysis context: ${contextSummary.slice(0, 1200)}`);
  }

  const historyBlock = formatHistory(history);
  if (historyBlock) {
    parts.push(historyBlock);
  }

  parts.push(`USER: ${question}`);
  return parts.join("\n\n");
}

export async function askNemotronChat(
  question: string,
  history: Array<{ role: string; content: string }>,
  memorySummary: string,
  contextSummary?: string
): Promise<NemotronChatResult> {
  const prompt = buildChatPrompt(question, history, memorySummary, contextSummary);
  const sandbox = process.env.NEMOCLAW_SANDBOX ?? "abdi";
  const nemoclawBin = process.env.NEMOCLAW_BIN ?? "nemoclaw";
  const openclawBin = process.env.OPENCLAW_BIN ?? "openclaw";

  try {
    const output = await runCommand(nemoclawBin, [
      sandbox,
      "exec",
      openclawBin,
      "chat",
      "--json",
      prompt,
    ]);
    return { reply: extractReply(output), engine: "nemoclaw" };
  } catch {
    try {
      const output = await runCommand(openclawBin, ["chat", "--json", prompt]);
      return { reply: extractReply(output), engine: "openclaw" };
    } catch (error) {
      return {
        reply: "",
        engine: "memory",
        error: error instanceof Error ? error.message : "Nemotron unavailable",
      };
    }
  }
}
