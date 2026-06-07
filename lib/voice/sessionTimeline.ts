import {
  formatLogClock,
  groupEntriesBySession,
  type SessionBlock,
} from "@/lib/voice/memoryAnswer";
import type { VoiceLogEntry } from "@/lib/voice/types";

export interface SessionTimelineLine {
  timestamp: string;
  timeLabel: string;
  role: VoiceLogEntry["role"];
  roleLabel: string;
  text: string;
}

export interface SessionTimelineBlock {
  index: number;
  blockKey: string;
  sessionId: string;
  startedAt: string;
  startedLabel: string;
  turnCount: number;
  lines: SessionTimelineLine[];
}

const POLLUTED_REPLY_MARKERS = [
  "i found ",
  "relevant logged responses",
  "i have ",
  "logged session",
  "here is what was logged most recently",
  "ask \"what did you say in session",
  "full transcript for session",
  "nothing logged at exactly",
];

function formatTimeMeridiem(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function roleLabel(role: VoiceLogEntry["role"]): string {
  if (role === "user") return "You";
  if (role === "assistant") return "Agent";
  if (role === "event") return "Event";
  if (role === "system") return "System";
  return role;
}

function isPollutedMemoryReply(entry: VoiceLogEntry): boolean {
  if (entry.role !== "assistant") return false;
  const lower = entry.text.toLowerCase();
  return POLLUTED_REPLY_MARKERS.some((marker) => lower.includes(marker));
}

function isGreetingNoise(entry: VoiceLogEntry): boolean {
  if (entry.meta?.type === "greeting") return true;
  if (entry.meta?.engine === "system") return true;
  const lower = entry.text.toLowerCase();
  if (/reloop voice agent online/.test(lower)) return true;
  if (/i remember \d+ prior session/.test(lower)) return true;
  if (/based on \d+ prior prompt/.test(lower)) return true;
  return isPollutedMemoryReply(entry);
}

function isTimelineLine(entry: VoiceLogEntry): boolean {
  if (entry.role !== "user" && entry.role !== "assistant") return false;
  if (!entry.text.trim()) return false;
  if (isGreetingNoise(entry)) return false;
  return true;
}

function blockToTimeline(block: SessionBlock, index: number): SessionTimelineBlock {
  const lines = block.entries.filter(isTimelineLine).map((entry) => ({
    timestamp: entry.timestamp,
    timeLabel: formatTimeMeridiem(entry.timestamp),
    role: entry.role,
    roleLabel: roleLabel(entry.role),
    text: entry.text.replace(/\s+/g, " ").trim(),
  }));

  return {
    index,
    blockKey: block.sessionId,
    sessionId: block.sessionId.split("@")[0] ?? block.sessionId,
    startedAt: block.startedAt,
    startedLabel: formatLogClock(block.startedAt),
    turnCount: lines.length,
    lines,
  };
}

/** Build grouped previous sessions with exact timestamps and spoken lines. */
export function buildSessionTimeline(
  entries: VoiceLogEntry[],
  options?: { maxSessions?: number }
): SessionTimelineBlock[] {
  const maxSessions = options?.maxSessions ?? 12;
  const blocks = groupEntriesBySession(entries);

  return blocks
    .slice(-maxSessions)
    .map((block, i, arr) => blockToTimeline(block, blocks.length - arr.length + i + 1))
    .reverse();
}

export function countTimelineTurns(blocks: SessionTimelineBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.lines.length, 0);
}
