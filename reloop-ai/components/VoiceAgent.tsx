"use client";

import { useEffect, useState } from "react";
import { Volume2, Loader2, AlertCircle, History, HardDrive } from "lucide-react";
import {
  appendLocalSessionLogs,
  buildMemoryView,
  loadLocalSessionLogs,
  mergeSessionLogs,
} from "@/lib/voice/localMemory";
import type { VoiceLogEntry, VoiceMemoryView } from "@/lib/voice/types";

async function loadMergedMemory(): Promise<VoiceMemoryView> {
  const localEntries = loadLocalSessionLogs();

  try {
    const res = await fetch("/api/voice/history");
    if (!res.ok) throw new Error("Server history unavailable");
    const data = (await res.json()) as {
      entries?: VoiceLogEntry[];
      recent?: VoiceLogEntry[];
    };
    const serverEntries = data.entries ?? data.recent ?? [];
    const merged = mergeSessionLogs(serverEntries, localEntries);
    saveMergedToLocal(merged);
    return buildMemoryView(merged);
  } catch {
    return buildMemoryView(localEntries);
  }
}

function saveMergedToLocal(entries: VoiceLogEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("reloop_voice_session_logs", JSON.stringify(entries.slice(-200)));
  } catch {
    // ignore quota errors
  }
}

export function VoiceAgent({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [mode, setMode] = useState<"elevenlabs" | "demo">("elevenlabs");
  const [error, setError] = useState<string | null>(null);
  const [memory, setMemory] = useState<VoiceMemoryView | null>(() => {
    if (typeof window === "undefined") return null;
    return buildMemoryView(loadLocalSessionLogs());
  });

  useEffect(() => {
    void loadMergedMemory().then(setMemory);
  }, []);

  async function speak() {
    if (!text || speaking) return;
    setSpeaking(true);
    setError(null);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      let data: {
        mode?: string;
        audio?: string;
        message?: string;
        loggedEntries?: VoiceLogEntry[];
      };
      try {
        data = await res.json();
      } catch {
        setError(`Voice API returned invalid response (HTTP ${res.status}).`);
        setSpeaking(false);
        return;
      }

      if (data.mode === "elevenlabs" && data.audio) {
        setMode("elevenlabs");

        if (data.loggedEntries?.length) {
          const merged = appendLocalSessionLogs(data.loggedEntries);
          setMemory(buildMemoryView(merged));
        }

        const audio = new Audio(data.audio);
        audio.onended = () => {
          setSpeaking(false);
          void loadMergedMemory().then(setMemory);
        };
        audio.onerror = () => {
          setSpeaking(false);
          setError("Failed to play ElevenLabs audio in browser.");
        };
        await audio.play();
        return;
      }

      setMode("demo");
      setError(
        data.message ||
          "ElevenLabs unavailable. Check ELEVEN_API_KEY in .env.local and restart npm run dev."
      );
      setSpeaking(false);
    } catch (err) {
      setSpeaking(false);
      setError(err instanceof Error ? err.message : "Voice request failed");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-emerald-400" />
          Voice Operations Agent
        </h3>
        <span className="text-xs text-zinc-500">
          {mode === "elevenlabs" ? "ElevenLabs" : "ElevenLabs (not configured)"}
        </span>
      </div>

      {memory && memory.sessionCount > 0 && (
        <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
            <History className="h-3.5 w-3.5" />
            Remembers {memory.sessionCount} previous session
            {memory.sessionCount !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            Saved in localStorage + server log
          </p>
          {memory.summary && (
            <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{memory.summary}</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-amber-400 mb-3 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
      <p className="text-sm text-zinc-300 mb-4 italic">&ldquo;{text}&rdquo;</p>
      <button
        onClick={speak}
        disabled={speaking || !text}
        className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {speaking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
        {speaking ? "Speaking..." : "Play Voice Summary"}
      </button>

      {memory && memory.recent.length > 0 && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="text-xs text-zinc-500 mb-2">Recent session memory</p>
          <ul className="space-y-1.5 max-h-28 overflow-y-auto">
            {memory.recent.slice(0, 4).map((entry, i) => (
              <li key={`${entry.timestamp}-${i}`} className="text-xs text-zinc-400 truncate">
                <span className="text-zinc-600">
                  {new Date(entry.timestamp).toLocaleString()} ·
                </span>{" "}
                {entry.text.slice(0, 100)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
