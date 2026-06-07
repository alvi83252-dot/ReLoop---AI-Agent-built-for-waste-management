import type { VoiceLogEntry, VoiceMemoryView } from "@/lib/voice/types";
import { getSubstantiveReplies } from "@/lib/voice/memoryAnswer";

export const LOCAL_STORAGE_KEY = "reloop_voice_session_logs";
const MAX_LOCAL_ENTRIES = 200;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Load all session log entries from localStorage. */
export function loadLocalSessionLogs(): VoiceLogEntry[] {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VoiceLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist session log entries to localStorage (append + cap). */
export function saveLocalSessionLogs(entries: VoiceLogEntry[]): void {
  if (!isBrowser()) return;

  try {
    const trimmed = entries.slice(-MAX_LOCAL_ENTRIES);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn("Failed to save voice session logs to localStorage:", error);
  }
}

/** Append one or more entries to localStorage. */
export function appendLocalSessionLogs(newEntries: VoiceLogEntry[]): VoiceLogEntry[] {
  const existing = loadLocalSessionLogs();
  const merged = [...existing, ...newEntries];
  saveLocalSessionLogs(merged);
  return merged;
}

/** Merge server + local logs, deduplicating identical entries. */
export function mergeSessionLogs(
  serverEntries: VoiceLogEntry[],
  localEntries: VoiceLogEntry[]
): VoiceLogEntry[] {
  const seen = new Set<string>();
  const merged: VoiceLogEntry[] = [];

  for (const entry of [...serverEntries, ...localEntries]) {
    const key = `${entry.timestamp}|${entry.role}|${entry.text}|${entry.session_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  merged.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return merged.slice(-MAX_LOCAL_ENTRIES);
}

export function buildMemoryView(entries: VoiceLogEntry[]): VoiceMemoryView {
  const sessionEvents = entries.filter(
    (e) =>
      e.role === "event" &&
      (e.text.toLowerCase().includes("session") ||
        e.text.toLowerCase().includes("voice summary"))
  );

  const userTurns = entries.filter((e) => e.role === "user");
  const lastSubstantive = getSubstantiveReplies(entries).at(-1)?.text.slice(0, 180) ?? "";
  const lastUser = userTurns.at(-1)?.text.slice(0, 180) ?? "";

  const summary = [
    entries.length > 0
      ? `Stored sessions: ${Math.max(sessionEvents.length, 1)} (${entries.length} log entries).`
      : "",
    lastUser ? `Last prompt: ${lastUser}` : "",
    lastSubstantive ? `Last recovery briefing: ${lastSubstantive}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const recent = entries
    .filter((e) => e.role === "assistant" || e.role === "event")
    .slice(-8)
    .reverse();

  return {
    sessionCount: Math.max(sessionEvents.length, entries.length > 0 ? 1 : 0),
    summary,
    recent,
    entries,
  };
}

export function clearLocalSessionLogs(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}
