import type { VoiceLogEntry } from "@/lib/voice/types";
import { getSubstantiveReplies } from "@/lib/voice/memoryAnswer";

export type VoiceSessionStatus = "idle" | "running" | "complete" | "judge_qa";

export interface VoiceSessionStats {
  entryCount: number;
  sessionCount: number;
  userTurns: number;
  assistantTurns: number;
  nemotronTurns: number;
  judgeQaTurns: number;
  durationMinutes: number | null;
  activeSessionId: string | null;
  sessionStatus: VoiceSessionStatus;
  lastSessionStartedAt: string | null;
  lastSessionEndedAt: string | null;
  lastUserPrompt: string | null;
  lastAssistantReply: string | null;
  recentRecommendations: Array<{ timestamp: string; text: string }>;
  judgeReady: boolean;
  memorySummary: string;
}

function parseTime(iso: string): number {
  return new Date(iso).getTime();
}

function isSessionStart(entry: VoiceLogEntry): boolean {
  return (
    entry.role === "event" &&
    entry.text.toLowerCase().includes("session started")
  );
}

function isSessionComplete(entry: VoiceLogEntry): boolean {
  return (
    entry.role === "event" &&
    entry.text.toLowerCase().includes("session complete")
  );
}

function isJudgeQaStart(entry: VoiceLogEntry): boolean {
  return (
    entry.role === "event" &&
    entry.text.toLowerCase().includes("judge q&a voice mode started")
  );
}

function isJudgeQaComplete(entry: VoiceLogEntry): boolean {
  return (
    entry.role === "event" &&
    entry.text.toLowerCase().includes("judge q&a complete")
  );
}

function isDashboardPlay(entry: VoiceLogEntry): boolean {
  return (
    entry.role === "event" &&
    entry.text.toLowerCase().includes("voice summary played")
  );
}

function inferSessionStatus(entries: VoiceLogEntry[]): VoiceSessionStatus {
  if (entries.length === 0) return "idle";

  let lastStartIdx = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isSessionStart(entries[i])) {
      lastStartIdx = i;
      break;
    }
  }

  if (lastStartIdx < 0) {
    return entries.some((e) => e.role === "assistant" || isDashboardPlay(e))
      ? "complete"
      : "idle";
  }

  const afterStart = entries.slice(lastStartIdx);
  if (afterStart.some(isJudgeQaStart) && !afterStart.some(isJudgeQaComplete)) {
    return "judge_qa";
  }
  if (afterStart.some(isSessionComplete)) {
    return "complete";
  }

  const startTime = parseTime(entries[lastStartIdx].timestamp);
  const lastTime = parseTime(entries.at(-1)!.timestamp);
  const elapsedMin = (lastTime - startTime) / 60_000;

  // Autonomous session default is 75 min — treat recent activity as running
  if (elapsedMin < 80) return "running";
  return "complete";
}

function countSessions(entries: VoiceLogEntry[]): number {
  const starts = entries.filter(
    (e) => isSessionStart(e) || isDashboardPlay(e)
  ).length;
  return Math.max(starts, entries.length > 0 ? 1 : 0);
}

function sessionDurationMinutes(entries: VoiceLogEntry[]): number | null {
  const starts = entries.filter((e) => isSessionStart(e) || isDashboardPlay(e));
  if (starts.length === 0 && entries.length === 0) return null;

  const first = starts[0]?.timestamp ?? entries[0]?.timestamp;
  const last = entries.at(-1)?.timestamp;
  if (!first || !last) return null;

  const minutes = (parseTime(last) - parseTime(first)) / 60_000;
  return Math.max(0, Math.round(minutes * 10) / 10);
}

function pickRecommendations(
  entries: VoiceLogEntry[],
  limit = 3
): Array<{ timestamp: string; text: string }> {
  return getSubstantiveReplies(entries)
    .slice(-limit)
    .map((e) => ({
      timestamp: e.timestamp,
      text: e.text.length > 200 ? `${e.text.slice(0, 200).trim()}…` : e.text,
    }));
}

export function computeVoiceSessionStats(
  entries: VoiceLogEntry[]
): VoiceSessionStats {
  const userTurns = entries.filter((e) => e.role === "user");
  const assistantTurns = entries.filter((e) => e.role === "assistant");
  const nemotronTurns = entries.filter(
    (e) =>
      e.role === "assistant" &&
      (e.meta?.engine === "nemotron" || e.meta?.engine === "Nemotron")
  ).length;
  const judgeQaTurns = entries.filter(
    (e) => e.meta?.mode === "judge_qa" && e.role === "user"
  ).length;

  const sessionStatus = inferSessionStatus(entries);
  const lastStart = [...entries].reverse().find(isSessionStart);
  const lastComplete = [...entries].reverse().find(isSessionComplete);

  const lastUser = userTurns.at(-1)?.text ?? null;
  const lastAssistant = assistantTurns.at(-1)?.text ?? null;
  const recentRecommendations = pickRecommendations(entries);

  const sessionCount = countSessions(entries);
  const durationMinutes = sessionDurationMinutes(entries);

  const memorySummary = [
    sessionCount > 0
      ? `${sessionCount} voice session${sessionCount === 1 ? "" : "s"} logged`
      : "",
    userTurns.length > 0
      ? `${userTurns.length} prompts, ${assistantTurns.length} spoken responses`
      : "",
    durationMinutes != null ? `${durationMinutes} min recorded` : "",
    nemotronTurns > 0 ? `${nemotronTurns} Nemotron turns` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const activeSessionId =
    [...entries]
      .reverse()
      .find((e) => e.session_id)?.session_id ?? null;

  return {
    entryCount: entries.length,
    sessionCount,
    userTurns: userTurns.length,
    assistantTurns: assistantTurns.length,
    nemotronTurns,
    judgeQaTurns,
    durationMinutes,
    activeSessionId,
    sessionStatus,
    lastSessionStartedAt: lastStart?.timestamp ?? null,
    lastSessionEndedAt: lastComplete?.timestamp ?? null,
    lastUserPrompt: lastUser,
    lastAssistantReply: lastAssistant,
    recentRecommendations,
    judgeReady: userTurns.length >= 2 && assistantTurns.length >= 2,
    memorySummary,
  };
}
