import fs from "node:fs";
import path from "node:path";
import type { VoiceLogEntry, VoiceLogRole } from "@/lib/voice/types";
import {
  computeVoiceSessionStats,
  type VoiceSessionStats,
} from "@/lib/voice/sessionStats";
import { getSubstantiveReplies, groupEntriesBySession } from "@/lib/voice/memoryAnswer";

export type { VoiceLogEntry, VoiceLogRole } from "@/lib/voice/types";
export type { VoiceSessionStats } from "@/lib/voice/sessionStats";

const LOG_PATH = path.join(process.cwd(), "data", "voice_session_log.jsonl");
const MAX_HISTORY_TURNS = 40;

function ensureLogFile() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function newSessionId(): string {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logVoiceEvent(
  role: VoiceLogRole,
  text: string,
  meta?: Record<string, unknown>,
  sessionId?: string
): VoiceLogEntry {
  ensureLogFile();
  const entry: VoiceLogEntry = {
    timestamp: new Date().toISOString(),
    role,
    text,
    ...(sessionId ? { session_id: sessionId } : {}),
    ...(meta ? { meta } : {}),
  };
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

export function loadFullVoiceSession(): VoiceLogEntry[] {
  if (!fs.existsSync(LOG_PATH)) return [];

  return fs
    .readFileSync(LOG_PATH, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as VoiceLogEntry;
      } catch {
        return {
          timestamp: new Date().toISOString(),
          role: "error" as const,
          text: "Malformed log entry skipped",
        };
      }
    });
}

export function loadConversationHistory(): Array<{ role: string; content: string }> {
  return loadFullVoiceSession()
    .filter(
      (e) =>
        ["system", "user", "assistant"].includes(e.role) && e.text.trim().length > 0
    )
    .map((e) => ({ role: e.role, content: e.text }))
    .slice(-MAX_HISTORY_TURNS);
}

export function getPriorSessionSummary(): string {
  const entries = loadFullVoiceSession();
  if (entries.length === 0) return "";

  const userTurns = entries.filter((e) => e.role === "user");
  const assistantTurns = entries.filter((e) => e.role === "assistant");
  const lastUser = userTurns.at(-1)?.text.slice(0, 180) ?? "";
  const lastSubstantive = getSubstantiveReplies(entries).at(-1)?.text.slice(0, 180) ?? "";

  const sessionBlocks = groupEntriesBySession(entries);

  return [
    `Prior voice sessions: ${Math.max(sessionBlocks.length, 1)}.`,
    `Logged history: ${userTurns.length} prompts, ${assistantTurns.length} responses.`,
    lastUser ? `Last prompt: ${lastUser}` : "",
    lastSubstantive ? `Last recovery briefing: ${lastSubstantive}` : "",
    'You can ask "list all sessions" or "what did you say at [time]".',
  ]
    .filter(Boolean)
    .join(" ");
}

export function getRecentVoiceSessions(limit = 5): VoiceLogEntry[] {
  return loadFullVoiceSession()
    .filter((e) => e.role === "assistant" || e.role === "event")
    .slice(-limit)
    .reverse();
}

export function getSessionCount(): number {
  const entries = loadFullVoiceSession();
  return Math.max(
    1,
    entries.filter(
      (e) =>
        e.role === "event" &&
        (e.text.toLowerCase().includes("session started") ||
          e.text.toLowerCase().includes("voice summary played"))
    ).length
  );
}

export function getSessionStats(): VoiceSessionStats {
  return computeVoiceSessionStats(loadFullVoiceSession());
}
