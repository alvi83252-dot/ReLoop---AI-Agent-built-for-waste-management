import type { VoiceLogEntry } from "@/lib/voice/types";

export type MemoryIntent =
  | { type: "list_sessions" }
  | { type: "session_index"; index: number }
  | { type: "session_relative"; which: "first" | "last" | "previous" }
  | {
      type: "time";
      hour: number;
      minute: number;
      meridiem?: "am" | "pm";
      sessionIndex?: number;
      sessionWhich?: "first" | "last" | "previous";
    }
  | { type: "time_recent" }
  | { type: "list_times" }
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
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

/** Human-readable clock with AM/PM, e.g. "5:11 AM". */
export function formatTimeMeridiem(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeMeridiem(raw?: string): "am" | "pm" | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, "").trim();
  if (lower.startsWith("p")) return "pm";
  if (lower.startsWith("a")) return "am";
  return undefined;
}

function isMeridiemToken(value?: string): boolean {
  return normalizeMeridiem(value) !== undefined;
}

function parseClock(
  hour: number,
  minute: number,
  meridiem?: string
): { hour: number; minute: number; meridiem?: "am" | "pm" } {
  let h = hour;
  const m = minute;
  const normalized = normalizeMeridiem(meridiem);
  if (normalized === "pm" && h < 12) h += 12;
  if (normalized === "am" && h === 12) h = 0;
  return { hour: h, minute: m, meridiem: normalized };
}

/** Parse clock times including 5:11 AM, 5:11am, 5 pm, and typo 527 a.m. → 5:27 */
export function parseTimeFromQuestion(
  question: string
): { hour: number; minute: number; meridiem?: "am" | "pm" } | null {
  const q = question.toLowerCase().replace(/\s+/g, " ").trim();

  const patterns: RegExp[] = [
    new RegExp(`\\bat\\s+(\\d{1,2})[:.](\\d{2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\b(\\d{1,2})[:.](\\d{2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\bat\\s+(\\d{1,2})\\s+(\\d{2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\b(\\d{1,2})\\s+(\\d{2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\bat\\s+(\\d{1,2})\\s*${MERIDIEM}`, "i"),
    new RegExp(`\\b(\\d{1,2})\\s*${MERIDIEM}`, "i"),
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
    let minute = 0;
    let meridiemRaw: string | undefined;

    if (match[2] && /^\d+$/.test(match[2])) {
      minute = Number(match[2]);
      meridiemRaw = match[3];
    } else if (isMeridiemToken(match[2])) {
      meridiemRaw = match[2];
    } else if (isMeridiemToken(match[3])) {
      minute = match[2] ? Number(match[2]) : 0;
      meridiemRaw = match[3];
    } else {
      minute = match[2] ? Number(match[2]) : 0;
      meridiemRaw = match[3];
    }

    return parseClock(hour, minute, meridiemRaw);
  }

  const dayPart = q.match(
    /\bat\s+(\d{1,2})(?::(\d{2}))?\s+(?:in the )?(morning|afternoon|evening|night)\b/
  );
  if (dayPart) {
    const hour = Number(dayPart[1]);
    const minute = dayPart[2] ? Number(dayPart[2]) : 0;
    const part = dayPart[3];
    const meridiem =
      part === "morning" || part === "night"
        ? "am"
        : part === "afternoon" || part === "evening"
          ? "pm"
          : undefined;
    return parseClock(hour, minute, meridiem);
  }

  return null;
}

function parseSessionScope(
  question: string
): { sessionIndex?: number; sessionWhich?: "first" | "last" | "previous" } | null {
  const q = question.toLowerCase();
  const sessionNum = q.match(/session\s+(\d+)/);
  if (sessionNum) return { sessionIndex: Number(sessionNum[1]) };
  if (/first\s+session/.test(q)) return { sessionWhich: "first" };
  if (/last\s+session|latest\s+session|most\s+recent\s+session/.test(q)) {
    return { sessionWhich: "last" };
  }
  if (/previous\s+session|prior\s+session|earlier\s+session/.test(q)) {
    return { sessionWhich: "previous" };
  }
  return null;
}

function resolveSessionEntries(
  blocks: SessionBlock[],
  scope?: { sessionIndex?: number; sessionWhich?: "first" | "last" | "previous" }
): { entries: VoiceLogEntry[]; label: string } | null {
  if (!scope || blocks.length === 0) return null;

  let index = scope.sessionIndex;
  if (scope.sessionWhich === "first") index = 1;
  if (scope.sessionWhich === "last") index = blocks.length;
  if (scope.sessionWhich === "previous") index = Math.max(1, blocks.length - 1);

  if (!index || index < 1 || index > blocks.length) return null;

  const block = blocks[index - 1];
  return {
    entries: block.entries,
    label: `session ${index} (started ${formatLogClock(block.startedAt)})`,
  };
}

export function questionLooksTimeBased(question: string): boolean {
  const q = question.toLowerCase();
  return (
    parseTimeFromQuestion(question) !== null ||
    /\b(at|time|when|o'clock|clock|morning|afternoon|evening)\b/.test(q) ||
    /\b\d{1,2}\s*(?:am|pm|a\.m|p\.m)\b/.test(q) ||
    /\d{1,2}:\d{2}/.test(q) ||
    /\d{3,4}\s*(?:a|p)\.?/i.test(q) ||
    /\b(nothing|anything)\s+at\b/.test(q) ||
    /\bwas\s+there\s+(anything|something)\b/.test(q)
  );
}

export function questionLooksSessionMemoryBased(question: string): boolean {
  const q = question.toLowerCase();
  return (
    questionLooksTimeBased(question) ||
    /previous\s+session|prior\s+session|last\s+session|earlier\s+session|session\s+\d+/.test(
      q
    ) ||
    /list\s+(all\s+)?(previous\s+)?sessions?|show\s+(all\s+)?sessions?/.test(q) ||
    /what\s+did\s+(you|i)\s+say|what\s+happened\s+in\s+session/.test(q) ||
    /full\s+transcript|logged\s+at|what\s+times?|when\s+did\s+(you|we)/.test(q)
  );
}

export function detectMemoryIntent(question: string): MemoryIntent {
  const q = question.toLowerCase();
  const sessionScope = parseSessionScope(question);

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
    return {
      type: "time",
      ...parsedTime,
      ...(sessionScope?.sessionIndex
        ? { sessionIndex: sessionScope.sessionIndex }
        : {}),
      ...(sessionScope?.sessionWhich
        ? { sessionWhich: sessionScope.sessionWhich }
        : {}),
    };
  }

  if (
    /what\s+times?|when\s+did\s+(you|we)|logged\s+times?|available\s+times?|what\s+can\s+i\s+ask\s+about/.test(
      q
    )
  ) {
    return { type: "list_times" };
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
  if (/previous\s+session|prior\s+session|earlier\s+session/.test(q)) {
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

  const startNewBlock = (entry: VoiceLogEntry) => {
    if (current && current.entries.length > 0) blocks.push(current);
    const baseId = entry.session_id ?? "orphan";
    current = {
      sessionId: `${baseId}@${entry.timestamp}`,
      startedAt: entry.timestamp,
      entries: [],
    };
  };

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
        entry.session_id !== current.sessionId.split("@")[0] &&
        current.entries.length > 0);

    if (newSession || !current) {
      startNewBlock(entry);
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

function meaningfulConversationEntries(entries: VoiceLogEntry[]): VoiceLogEntry[] {
  return entries.filter((e) => {
    if (e.role !== "user" && e.role !== "assistant") return false;
    if (isGreetingNoise(e)) return false;
    if (e.role === "user") return e.text.trim().length > 0;
    return e.text.trim().length >= 20;
  });
}

function listAvailableConversationTimes(entries: VoiceLogEntry[], limit = 6): string {
  const meaningful = meaningfulConversationEntries(entries);

  if (meaningful.length === 0) {
    return "No Q&A turns logged yet — ask me something first, then try again with a time like \"5:11 AM\".";
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
    return `• ${formatLogTime(e.timestamp)} — ${roleLabel(e.role)}: "${preview}"`;
  });

  return [
    "Logged times you can ask about (use AM/PM, e.g. \"what did you say at 9:26 AM\"):",
    ...lines,
  ].join("\n");
}

function describeNearestTimes(
  entries: VoiceLogEntry[],
  hour: number,
  minute: number
): string {
  const meaningful = meaningfulConversationEntries(entries);
  if (meaningful.length === 0) return "";

  const target = hour * 60 + minute;
  let before: VoiceLogEntry | null = null;
  let after: VoiceLogEntry | null = null;

  for (const entry of meaningful) {
    const d = new Date(entry.timestamp);
    const value = d.getHours() * 60 + d.getMinutes();
    if (value < target && (!before || value > new Date(before.timestamp).getHours() * 60 + new Date(before.timestamp).getMinutes())) {
      before = entry;
    }
    if (value > target && (!after || value < new Date(after.timestamp).getHours() * 60 + new Date(after.timestamp).getMinutes())) {
      after = entry;
    }
  }

  const hints: string[] = [];
  if (before) {
    hints.push(
      `Closest earlier log: ${formatLogTime(before.timestamp)} — ${roleLabel(before.role)}: "${before.text.slice(0, 60).trim()}${before.text.length > 60 ? "…" : ""}"`
    );
  }
  if (after) {
    hints.push(
      `Closest later log: ${formatLogTime(after.timestamp)} — ${roleLabel(after.role)}: "${after.text.slice(0, 60).trim()}${after.text.length > 60 ? "…" : ""}"`
    );
  }

  if (hints.length === 0) return "";
  return hints.join("\n");
}

function answerAtTime(
  entries: VoiceLogEntry[],
  hour: number,
  minute: number,
  options?: { sessionLabel?: string }
): string {
  const matched = entriesAtExactMinute(entries, hour, minute)
    .filter(isConversationEntry)
    .filter((entry) => !isGreetingNoise(entry));

  const timeLabel = formatTimeMeridiem(hour, minute);
  const scopeNote = options?.sessionLabel
    ? ` in ${options.sessionLabel}`
    : " in any logged session";

  if (matched.length === 0) {
    return [
      `There was nothing logged at exactly ${timeLabel}${scopeNote}. I only answer from the JSONL transcript — no guesses.`,
      describeNearestTimes(entries, hour, minute),
      listAvailableConversationTimes(entries),
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const when = formatLogClock(matched[0].timestamp);
  const lines = matched.map(formatConversationLine);
  const header = options?.sessionLabel
    ? `Exact conversation at ${timeLabel} (${when}) in ${options.sessionLabel}:`
    : `Exact conversation at ${timeLabel} (${when}) — your prompt and my reply, in order:`;

  return [header, ...lines].join("\n");
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
    const turns = meaningfulConversationEntries(block.entries);
    const sampleTimes = turns
      .slice(0, 3)
      .map((e) => formatLogTime(e.timestamp))
      .join(", ");
    const turnLine =
      turns.length > 0
        ? `${turns.length} logged turn${turns.length === 1 ? "" : "s"}${sampleTimes ? ` at ${sampleTimes}` : ""}`
        : "no conversation logged yet";
    return `Session ${i + 1} — started ${formatLogClock(block.startedAt)} — ${turnLine}`;
  });

  return [
    `I have ${blocks.length} logged session${blocks.length === 1 ? "" : "s"}:`,
    ...lines,
    'Ask "what did you say at 5:11 AM", "was there anything at 3 PM", or "what did you say in session 2 at 9:26 AM".',
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
    case "time": {
      let searchEntries = entries;
      let sessionLabel: string | undefined;

      if (intent.sessionIndex || intent.sessionWhich) {
        const resolved = resolveSessionEntries(blocks, {
          sessionIndex: intent.sessionIndex,
          sessionWhich: intent.sessionWhich,
        });
        if (!resolved) {
          return `That session was not found. I have ${blocks.length} logged session${blocks.length === 1 ? "" : "s"}.`;
        }
        searchEntries = resolved.entries;
        sessionLabel = resolved.label;
      }

      return answerAtTime(searchEntries, intent.hour, intent.minute, {
        sessionLabel,
      });
    }
    case "time_recent":
      return answerRecentTime(entries);
    case "list_times":
      return listAvailableConversationTimes(entries, 10);
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
