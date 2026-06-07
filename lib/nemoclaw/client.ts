import { spawn } from "node:child_process";
import type { InventoryItem } from "@/lib/types";

export interface NemoclawAnalysisResult {
  usedNemoclaw: boolean;
  insight: string;
  source: "nemoclaw" | "openclaw" | "fallback";
  error?: string;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.NEMOCLAW_TIMEOUT_MS ?? 8_000);

export function isNemoclawEnabled(): boolean {
  if (process.env.NEMOCLAW_ENABLED === "false") return false;
  if (process.env.SKIP_NEMOCLAW === "true") return false;
  // On Windows, skip unless a custom binary path is configured (CLI usually absent locally).
  if (
    process.platform === "win32" &&
    !process.env.NEMOCLAW_BIN?.trim() &&
    process.env.NEMOCLAW_ENABLED !== "true"
  ) {
    return false;
  }
  return true;
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
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
      reject(new Error(`NemoClaw timed out after ${timeoutMs}ms`));
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

function buildPrompt(inventory: InventoryItem[]): string {
  const summary = inventory
    .slice(0, 12)
    .map(
      (item) =>
        `${item.quantity}× ${item.deviceType}, condition ${Math.round(item.conditionScore * 100)}%`
    )
    .join("; ");

  return (
    "You are ReLoop AI using NVIDIA Nemotron inside NemoClaw. " +
    "Analyze this London IT disposal inventory and recommend circular economy actions " +
    "(reuse, repair, donate, resell, recycle). Include carbon and GBP recovery estimates. " +
    `Inventory summary: ${summary}`
  );
}

export async function analyzeInventoryWithNemoclaw(
  inventory: InventoryItem[],
  options?: { timeoutMs?: number }
): Promise<NemoclawAnalysisResult> {
  if (!isNemoclawEnabled()) {
    return {
      usedNemoclaw: false,
      insight: "",
      source: "fallback",
      error: "NemoClaw skipped (not configured on this machine)",
    };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const prompt = buildPrompt(inventory);
  const sandbox = process.env.NEMOCLAW_SANDBOX ?? "abdi";
  const nemoclawBin = process.env.NEMOCLAW_BIN ?? "nemoclaw";
  const openclawBin = process.env.OPENCLAW_BIN ?? "openclaw";

  // 1) Preferred: nemoclaw abdi exec openclaw chat --json
  try {
    const output = await runCommand(
      nemoclawBin,
      [sandbox, "exec", openclawBin, "chat", "--json", prompt],
      timeoutMs
    );
    return {
      usedNemoclaw: true,
      insight: extractReply(output),
      source: "nemoclaw",
    };
  } catch (nemoclawError) {
    // 2) Fallback: local openclaw on host
    try {
      const output = await runCommand(
        openclawBin,
        ["chat", "--json", prompt],
        timeoutMs
      );
      return {
        usedNemoclaw: true,
        insight: extractReply(output),
        source: "openclaw",
      };
    } catch {
      return {
        usedNemoclaw: false,
        insight: "",
        source: "fallback",
        error:
          nemoclawError instanceof Error
            ? nemoclawError.message
            : "NemoClaw/OpenClaw unavailable",
      };
    }
  }
}
