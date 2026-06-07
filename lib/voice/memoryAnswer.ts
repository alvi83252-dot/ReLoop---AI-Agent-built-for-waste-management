import type { VoiceLogEntry } from "@/lib/voice/types";

export type MemoryIntent =
  | { type: "list_sessions" }
  | { type: "session_index"; index: number }
  | { type: "session_relative"; which: "first" | "last" | "previous" }
  | { type: "time"; hour: number; minute: number }
  | { type: "time_recent" }
  | { type: "full_transcript"; sessionIndex?: number }
  | { type: "topic" };

const MERIDIEM = "(?:a\\.?\\s*m\\.?|p\\.?\\s*m\\.?|am|pm)";

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

export interface SessionBlock {
  sessionId: string;
  startedAt: string;
  entries: VoiceLogEntry[];
}

export function formatLogClock(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function parseClock(hour: number, minute: number, meridiem?: string): {
  hour: number;
  minute: number;
} {
  let h = hour;
  const m = minute;
  if (meridiem) {
    const lower = meridiem.toLowerCase().replace(/\./g, "");
    if (lower.startsWith("p") && h < 12) h += 12;
    if (lower.startsWith("a") && h === 12) h = 0;
  }
  return { hour: h, minute: m };
}

/** Parse clock times including 5:11 a.m. and typo forms like 527 a.m. → 5:27 */
export function parseTimeFromQuestion(
  question: string
): { hour: number; minute: number } | null {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();

  const patterns: RegExp[] = [
    new RegExp(`\\bat\\s+(\\d{1,2}):(\\d{2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\b(\\d{1,2}):(\\d{2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\bat\\s+(\\d{1,2}):(\\d{2})\\b`, "i"),
    new RegExp(`\\b(\\d{1,2}):(\\d{2})\\b`, "i"),
    new RegExp(`\\bat\\s+(\\d{3,4})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\b(\\d{3,4})\\s*${MERIDIEM}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (!match) continue;

    if (match[1].length >= 3) {
      const digits = match[1];
      const meridiem = match[2];
      if (digits.length === 3) {
        return parseClock(Number(digits[0]), Number(digits.slice(1)), meridiem);
      }
      if (digits.length === 4) {
        return parseClock(Number(digits.slice(0, 2)), Number(digits.slice(2)), meridiem);
      }
    }

    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const meridiem = match[3];
    return parseClock(hour, minute, meridiem);
  }

  return null;
}

export function questionLooksTimeBased(question: string): boolean {
  const q = question.toLowerCase();
  return (
    parseTimeFromQuestion(question) !== null ||
    /\b(at|time|when|o'clock|clock)\b/.test(q) ||
    /\d{1,2}:\d{2}/.test(q) ||
    /\d{3,4}\s*(?:a|p)\.?/i.test(q)
  );
}

export function detectMemoryIntent(question: string): MemoryIntent {
  const q = question.toLowerCase();

  if (
    /list\s+(all\s+)?(previous\s+)?sessions?/.test(q) ||
    /show\s+(all\s+)?(previous\s+)?sessions?/.test(q) ||
    /what\s+sessions?/.test(q) ||
    /how\s+many\s+sessions?/.test(q)
  ) {
    return { type: "list_sessions" };
  }

  const parsedTime = parseTimeFromQuestion(question);
  if (parsedTime) {
    return { type: "time", ...parsedTime };
  }

  if (
    /full\s+transcript/.test(q) ||
    (/everything\s+(you\s+)?(said|logged)/.test(q) && /session/.test(q))
  ) {
    const sessionMatch = q.match(/session\s+(\d+)/);
    if (sessionMatch) {
      return { type: "full_transcript", sessionIndex: Number(sessionMatch[1]) };
    }
    return { type: "full_transcript" };
  }

  if (/first\s+session/.test(q)) {
    return { type: "session_relative", which: "first" };
  }
  if (/last\s+session|latest\s+session|most\s+recent\s+session/.test(q)) {
    return { type: "session_relative", which: "last" };
  }
  if (/previous\s+session|prior\s+session/.test(q)) {
    return { type: "session_relative", which: "previous" };
  }

  const sessionNum = q.match(/session\s+(\d+)/);
  if (sessionNum) {
    return { type: "session_index", index: Number(sessionNum[1]) };
  }

  if (/^(this\s+time|just\s+now|right\s+now)$/.test(q.trim())) {
    return { type: "time_recent" };
  }

  return { type: "topic" };
}

export function groupEntriesBySession(entries: VoiceLogEntry[]): SessionBlock[] {
  if (entries.length === 0) return [];

  const blocks: SessionBlock[] = [];
  let current: SessionBlock | null = null;

  for (const entry of entries) {
    const isStart =
      entry.role === "event" &&
      (/session started/i.test(entry.text) ||
        /voice summary played/i.test(entry.text) ||
        /live voice agent session started/i.test(entry.text));

    const newSession =
      isStart ||
      (entry.session_id &&
        current &&
        entry.session_id !== current.sessionId &&
        current.entries.length > 0);

    if (newSession || !current) {
      if (current && current.entries.length > 0) blocks.push(current);
      current = {
        sessionId: entry.session_id ?? `block-${entry.timestamp}`,
        startedAt: entry.timestamp,
        entries: [],
      };
    }

    current!.entries.push(entry);
  }

  if (current && current.entries.length > 0) blocks.push(current);
  return blocks;
}

function isPollutedMemoryReply(entry: VoiceLogEntry): boolean {
  if (entry.role !== "assistant") return false;
  const lower = entry.text.toLowerCase();
  return POLLUTED_REPLY_MARKERS.some((m) => lower.includes(m));
}

function isConversationEntry(entry: VoiceLogEntry): boolean {
  return (
    (entry.role === "user" || entry.role === "assistant") &&
    entry.text.trim().length > 0
  );
}

function isTranscriptEntry(entry: VoiceLogEntry): boolean {
  if (entry.role === "error" || entry.role === "system") return false;
  if (isPollutedMemoryReply(entry)) return false;
  return entry.text.trim().length > 0;
}

function roleLabel(role: VoiceLogEntry["role"]): string {
  if (role === "user") return "You";
  if (role === "assistant") return "Agent";
  if (role === "event") return "System";
  return role;
}

function formatConversationLine(entry: VoiceLogEntry): string {
  return `${formatLogTime(entry.timestamp)} — ${roleLabel(entry.role)}: ${entry.text.replace(/\s+/g, " ").trim()}`;
}

function formatTranscript(entries: VoiceLogEntry[], maxChars = 2000): string {
  const lines = entries.filter(isTranscriptEntry).map(formatConversationLine);

  if (lines.length === 0) {
    return "No conversation lines were logged for that session.";
  }

  let output = lines.join("\n");
  if (output.length <= maxChars) return output;

  const kept: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > maxChars) break;
    kept.push(line);
    size += line.length + 1;
  }

  const omitted = lines.length - kept.length;
  return `${kept.join("\n")}\n…plus ${omitted} more line${omitted === 1 ? "" : "s"} in the session file.`;
}

function entriesAtExactMinute(
  entries: VoiceLogEntry[],
  hour: number,
  minute: number
): VoiceLogEntry[] {
  return entries
    .filter((entry) => {
      const d = new Date(entry.timestamp);
      return d.getHours() === hour && d.getMinutes() === minute;
    })
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
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

function listAvailableConversationTimes(entries: VoiceLogEntry[], limit = 6): string {
  const meaningful = entries.filter((e) => {
    if (e.role !== "user" && e.role !== "assistant") return false;
    if (isGreetingNoise(e)) return false;
    if (e.role === "user") return e.text.trim().length > 0;
    return e.text.trim().length >= 20;
  });

  if (meaningful.length === 0) {
    return "No Q&A turns logged yet — ask me something first.";
  }

  const seen = new Set<string>();
  const picked: VoiceLogEntry[] = [];

  for (let i = meaningful.length - 1; i >= 0 && picked.length < limit; i--) {
    const entry = meaningful[i];
    const preview = entry.text.slice(0, 60).toLowerCase().trim();
    const dedupeKey = `${entry.role}|${preview}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    picked.unshift(entry);
  }

  const lines = picked.map((e) => {
    const preview =
      e.text.slice(0, 70).trim() + (e.text.length > 70 ? "…" : "");
    return `• ${formatLogClock(e.timestamp)} — ${roleLabel(e.role)}: "${preview}"`;
  });

  return ["Recent moments you can ask about by time:", ...lines].join("\n");
}

function formatLogTimeFromParts(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return formatLogTime(d.toISOString());
}

function answerAtTime(
  entries: VoiceLogEntry[],
  hour: number,
  minute: number
): string {
  const matched = entriesAtExactMinute(entries, hour, minute).filter(
    isConversationEntry
  );

  if (matched.length === 0) {
    const label = formatLogTimeFromParts(hour, minute);
    return [
      `Nothing was logged at exactly ${label}. I only report exact log timestamps — no guesses.`,
      "",
      listAvailableConversationTimes(entries),
    ].join("\n");
  }

  const when = formatLogClock(matched[0].timestamp);
  const lines = matched.map(formatConversationLine);

  return [
    `Exact conversation at ${when} — your prompt and my reply, in order:`,
    ...lines,
  ].join("\n");
}

function answerRecentTime(entries: VoiceLogEntry[]): string {
  const conversational = entries
    .filter(isTranscriptEntry)
    .filter((e) => e.role === "user" || e.role === "assistant")
    .slice(-6);

  if (conversational.length === 0) {
    return listAvailableConversationTimes(entries);
  }

  const when = formatLogClock(conversational[0].timestamp);
  const lines = conversational.map(formatConversationLine);

  return [`Most recent logged conversation (from ${when}):`, ...lines].join("\n");
}

function listAllSessions(entries: VoiceLogEntry[]): string {
  const blocks = groupEntriesBySession(entries);
  if (blocks.length === 0) {
    return "No previous sessions are logged yet.";
  }

  const lines = blocks.map((block, i) => {
    const turns = block.entries.filter(
      (e) => e.role === "user" || e.role === "assistant"
    ).length;
    return `Session ${i + 1} — started ${formatLogClock(block.startedAt)} — ${turns} turns`;
  });

  return [
    `I have ${blocks.length} logged session${blocks.length === 1 ? "" : "s"}:`,
    ...lines,
    'Ask "what did you say in session 2" or "what did you say at 5:11 AM" for an exact transcript.',
  ].join("\n");
}

function sessionByIndex(blocks: SessionBlock[], index: number): string | null {
  if (index < 1 || index > blocks.length) return null;
  const block = blocks[index - 1];
  return [
    `Exact transcript for session ${index}, started ${formatLogClock(block.startedAt)}:`,
    formatTranscript(block.entries),
  ].join("\n");
}

function sessionByRelative(
  blocks: SessionBlock[],
  which: "first" | "last" | "previous"
): string {
  if (blocks.length === 0) return "No sessions logged yet.";

  const index =
    which === "first"
      ? 1
      : which === "last"
        ? blocks.length
        : Math.max(1, blocks.length - 1);

  return sessionByIndex(blocks, index)!;
}

function isSubstantiveTopicReply(entry: VoiceLogEntry): boolean {
  if (entry.role !== "assistant") return false;
  if (entry.meta?.type === "greeting") return false;
  if (entry.meta?.engine === "system") return false;
  if (isPollutedMemoryReply(entry)) return false;
  if (entry.text.trim().length < 40) return false;
  return true;
}

function answerTopicQuestion(question: string, entries: VoiceLogEntry[]): string {
  if (questionLooksTimeBased(question)) {
    return listAvailableConversationTimes(entries);
  }

  const candidates = entries.filter(isSubstantiveTopicReply);
  if (candidates.length === 0) {
    return listAvailableConversationTimes(entries);
  }

  const q = question.toLowerCase();
  const scored = candidates
    .map((entry) => {
      let score = 0;
      const t = entry.text.toLowerCase();
      for (const token of q.split(/\W+/).filter((w) => w.length > 3)) {
        if (t.includes(token)) score += 3;
      }
      if (entry.meta?.source === "reloop_dashboard") score += 10;
      return { entry, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return listAvailableConversationTimes(entries);
  }

  const best = scored[0].entry;
  return `At ${formatLogClock(best.timestamp)} I said: ${best.text.replace(/\s+/g, " ").trim()}`;
}

/** Exact session log lookup — never invents data outside the JSONL transcript. */
export function answerFromSessionMemory(
  question: string,
  entries: VoiceLogEntry[]
): string {
  const intent = detectMemoryIntent(question);
  const blocks = groupEntriesBySession(entries);

  switch (intent.type) {
    case "list_sessions":
      return listAllSessions(entries);
    case "session_index": {
      const transcript = sessionByIndex(blocks, intent.index);
      return (
        transcript ??
        `Session ${intent.index} not found. I have ${blocks.length} logged session${blocks.length === 1 ? "" : "s"}.`
      );
    }
    case "session_relative":
      return sessionByRelative(blocks, intent.which);
    case "time":
      return answerAtTime(entries, intent.hour, intent.minute);
    case "time_recent":
      return answerRecentTime(entries);
    case "full_transcript": {
      if (intent.sessionIndex) {
        const transcript = sessionByIndex(blocks, intent.sessionIndex);
        return transcript ?? `Session ${intent.sessionIndex} not found.`;
      }
      return sessionByRelative(blocks, "last");
    }
    case "topic":
    default:
      return answerTopicQuestion(question, entries);
  }
}

export function isSubstantiveReply(entry: VoiceLogEntry): boolean {
  return isSubstantiveTopicReply(entry);
}

export function getSubstantiveReplies(entries: VoiceLogEntry[]): VoiceLogEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (!isSubstantiveTopicReply(entry)) return false;
    const key = entry.text.slice(0, 120).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
