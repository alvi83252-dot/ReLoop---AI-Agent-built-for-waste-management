"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Brain,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Mic,
  CheckCircle2,
  Radio,
} from "lucide-react";
import {
  buildMemoryView,
  loadLocalSessionLogs,
  mergeSessionLogs,
} from "@/lib/voice/localMemory";
import {
  buildSessionTimeline,
  type SessionTimelineBlock,
} from "@/lib/voice/sessionTimeline";
import type { VoiceLogEntry } from "@/lib/voice/types";
import type { VoiceSessionStats } from "@/lib/voice/sessionStats";
import { cn } from "@/lib/utils";
import { VoiceAskPanel } from "@/components/VoiceAskPanel";

const REFRESH_MS = 12_000;

interface HistoryResponse {
  entries?: VoiceLogEntry[];
  stats?: VoiceSessionStats;
  summary?: string;
}

const STATUS_LABELS: Record<VoiceSessionStats["sessionStatus"], string> = {
  idle: "No autonomous session yet",
  running: "Autonomous session running",
  complete: "Session complete — memory retained",
  judge_qa: "Judge Q&A mode — ask about earlier events",
};

const STATUS_STYLES: Record<VoiceSessionStats["sessionStatus"], string> = {
  idle: "border-zinc-700 bg-zinc-900/40 text-zinc-400",
  running: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  complete: "border-green-500/40 bg-green-500/10 text-green-400",
  judge_qa: "border-lime-500/40 bg-lime-500/10 text-lime-300",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function truncate(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function VoiceSessionMemory({
  contextSummary,
}: {
  contextSummary?: string;
}) {
  const [stats, setStats] = useState<VoiceSessionStats | null>(null);
  const [summary, setSummary] = useState("");
  const [recent, setRecent] = useState<VoiceLogEntry[]>([]);
  const [sessions, setSessions] = useState<SessionTimelineBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/voice/history", { cache: "no-store" });
      const data = (await res.json()) as HistoryResponse;
      const serverEntries = data.entries ?? [];
      const merged = mergeSessionLogs(serverEntries, loadLocalSessionLogs());
      const view = buildMemoryView(merged);

      setStats(data.stats ?? null);
      setSummary(data.summary || view.summary);
      setRecent(view.recent);
      setSessions(buildSessionTimeline(merged));
    } catch {
      const local = loadLocalSessionLogs();
      const view = buildMemoryView(local);
      setSummary(view.summary);
      setRecent(view.recent);
      setSessions(buildSessionTimeline(local));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);

    const onUpdate = () => void refresh();
    window.addEventListener("reloop-voice-log-updated", onUpdate);

    return () => {
      clearInterval(timer);
      window.removeEventListener("reloop-voice-log-updated", onUpdate);
    };
  }, [refresh]);

  const status = stats?.sessionStatus ?? "idle";

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2 text-sm sm:text-base">
            <Brain className="h-4 w-4 text-lime-400" />
            Voice Session Memory
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            ElevenLabs prize · Nemotron + JSONL long-term context for judge Q&A
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </div>

      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-xs font-medium mb-4",
          STATUS_STYLES[status]
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {status === "running" || status === "judge_qa" ? (
            <Radio className="h-3.5 w-3.5 animate-pulse" />
          ) : status === "complete" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          {STATUS_LABELS[status]}
        </span>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Sessions" value={String(stats.sessionCount)} />
          <StatCard label="Log entries" value={String(stats.entryCount)} />
          <StatCard
            label="Duration"
            value={
              stats.durationMinutes != null
                ? `${stats.durationMinutes} min`
                : "—"
            }
            icon={<Clock className="h-3 w-3" />}
          />
          <StatCard
            label="Nemotron turns"
            value={String(stats.nemotronTurns)}
          />
          <StatCard label="User prompts" value={String(stats.userTurns)} />
          <StatCard
            label="Spoken replies"
            value={String(stats.assistantTurns)}
          />
          <StatCard label="Judge Q&A" value={String(stats.judgeQaTurns)} />
          <StatCard
            label="Judge ready"
            value={stats.judgeReady ? "Yes" : "Need more turns"}
            highlight={stats.judgeReady}
          />
        </div>
      ) : (
        <p className="text-sm text-zinc-500 mb-4">
          Start the 75-minute voice agent to populate session logs.
        </p>
      )}

      {summary && (
        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{summary}</p>
      )}

      {sessions.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Previous sessions — what was said and when
            </h4>
            {sessions.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllSessions((v) => !v)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 shrink-0"
              >
                {showAllSessions ? "Show fewer" : `Show all ${sessions.length}`}
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
            {(showAllSessions ? sessions : sessions.slice(0, 3)).map((session) => {
              const isOpen =
                expandedSessionId === session.blockKey ||
                (expandedSessionId === null && session.index === sessions[0]?.index);

              return (
                <div
                  key={session.blockKey}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSessionId((current) =>
                        current === session.blockKey ? null : session.blockKey
                      )
                    }
                    className="w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-zinc-900/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200">
                        Session {session.index}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Started {session.startedLabel}
                        {session.turnCount > 0
                          ? ` · ${session.turnCount} logged turn${session.turnCount === 1 ? "" : "s"}`
                          : " · no conversation yet"}
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600 shrink-0 pt-0.5">
                      {isOpen ? "Hide" : "Show"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-zinc-800 px-3 py-2 space-y-2">
                      {session.lines.length === 0 ? (
                        <p className="text-xs text-zinc-500 py-1">
                          No prompts or replies logged in this session yet.
                        </p>
                      ) : (
                        session.lines.map((line, lineIndex) => (
                          <div
                            key={`${session.blockKey}-${lineIndex}-${line.timestamp}`}
                            className="rounded-md border border-zinc-800/80 bg-zinc-950/60 px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                              <span className="text-[11px] font-mono text-emerald-400/90">
                                {line.timeLabel}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] uppercase tracking-wider font-medium",
                                  line.role === "user"
                                    ? "text-sky-400"
                                    : "text-lime-400"
                                )}
                              >
                                {line.roleLabel}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                              {line.text}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-600 mt-3">
            Ask the live agent: &quot;What did you say at 5:11 AM?&quot;, &quot;Was there anything at 3 PM?&quot;, or &quot;What happened in session 2?&quot;
          </p>
        </div>
      ) : (
        !loading && (
          <p className="text-sm text-zinc-500 mb-4">
            Previous sessions will appear here with exact timestamps once you use the live voice agent or Ask once.
          </p>
        )
      )}

      {stats?.recentRecommendations && stats.recentRecommendations.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Recent recommendations
          </h4>
          <ul className="space-y-2">
            {stats.recentRecommendations.map((rec) => (
              <li
                key={rec.timestamp}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-300"
              >
                <span className="text-emerald-400/90 font-mono mr-2">
                  {formatTime(rec.timestamp)}
                </span>
                {truncate(rec.text, 200)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats?.lastUserPrompt && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs mb-4">
          <span className="text-zinc-500 block mb-1">Last prompt</span>
          <span className="text-zinc-300">{truncate(stats.lastUserPrompt, 220)}</span>
        </div>
      )}

      {recent.length > 0 && (
        <details className="mb-4 text-xs">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-400">
            Raw log events ({recent.length})
          </summary>
          <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
            {recent.map((entry) => (
              <li
                key={`${entry.timestamp}-${entry.role}-${entry.text.slice(0, 24)}`}
                className="flex gap-2 text-zinc-500"
              >
                <span className="shrink-0 text-zinc-600 font-mono">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="shrink-0 uppercase text-zinc-600 w-16">
                  {entry.role}
                </span>
                <span className="text-zinc-400 truncate">{entry.text}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <VoiceAskPanel contextSummary={contextSummary} />

      <p className="text-[11px] text-zinc-600 mt-4">
        Log file: <code className="text-zinc-500">data/voice_session_log.jsonl</code>
        {stats?.activeSessionId && (
          <> · Session <code className="text-zinc-500">{stats.activeSessionId}</code></>
        )}
      </p>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold mt-0.5",
          highlight ? "text-emerald-400" : "text-zinc-200"
        )}
      >
        {value}
      </p>
    </div>
  );
}
