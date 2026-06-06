export type VoiceLogRole = "system" | "user" | "assistant" | "event" | "error";

export interface VoiceLogEntry {
  timestamp: string;
  role: VoiceLogRole;
  text: string;
  session_id?: string;
  meta?: Record<string, unknown>;
}

export interface VoiceMemoryView {
  sessionCount: number;
  summary: string;
  recent: VoiceLogEntry[];
  entries: VoiceLogEntry[];
}
