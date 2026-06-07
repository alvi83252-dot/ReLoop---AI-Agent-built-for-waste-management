"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Volume2,
  Loader2,
  AlertCircle,
  Pause,
  Square,
  Play,
} from "lucide-react";
import { appendLocalSessionLogs } from "@/lib/voice/localMemory";
import type { VoiceLogEntry } from "@/lib/voice/types";

type PlaybackState = "idle" | "loading" | "playing" | "paused";
type VoiceMode = "elevenlabs" | "browser" | "demo";

export function VoiceAgent({ text }: { text: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserTextRef = useRef<string>("");
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [mode, setMode] = useState<VoiceMode>("elevenlabs");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stopBrowserSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
    stopBrowserSpeech();
    setPlayback("idle");
  }, [stopBrowserSpeech]);

  const speakWithBrowser = useCallback(
    (speechText: string) =>
      new Promise<void>((resolve, reject) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          reject(new Error("Browser speech synthesis is not available."));
          return;
        }

        stopBrowserSpeech();
        browserTextRef.current = speechText;

        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error("Browser speech playback failed."));

        window.speechSynthesis.speak(utterance);
      }),
    [stopBrowserSpeech]
  );

  useEffect(() => {
    stopPlayback();
    setError(null);
    setNotice(null);
  }, [text, stopPlayback]);

  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  async function loadAndPlay() {
    if (!text.trim()) return;

    setError(null);
    setPlayback("loading");

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      let data: {
        mode?: string;
        audio?: string;
        text?: string;
        message?: string;
        loggedEntries?: VoiceLogEntry[];
      };

      try {
        data = await res.json();
      } catch {
        setError(`Voice API returned invalid response (HTTP ${res.status}).`);
        setPlayback("idle");
        return;
      }

      if (data.loggedEntries?.length) {
        appendLocalSessionLogs(data.loggedEntries);
        window.dispatchEvent(new CustomEvent("reloop-voice-log-updated"));
      }

      if (data.mode === "browser" && data.text?.trim()) {
        setMode("browser");
        setNotice(data.message ?? "Using browser voice — ElevenLabs unavailable.");
        setError(null);
        stopPlayback();
        setPlayback("playing");

        await speakWithBrowser(data.text);
        setPlayback("idle");
        return;
      }

      if (data.mode !== "elevenlabs" || !data.audio) {
        setMode("demo");
        setError(
          data.message ||
            "ElevenLabs unavailable. Check ELEVEN_API_KEY in .env.local and restart npm run dev."
        );
        setPlayback("idle");
        return;
      }

      setMode("elevenlabs");
      setNotice(null);

      stopPlayback();

      const audio = new Audio(data.audio);
      audioRef.current = audio;

      audio.onended = () => {
        audioRef.current = null;
        setPlayback("idle");
      };
      audio.onerror = () => {
        audioRef.current = null;
        setPlayback("idle");
        setError("Failed to play ElevenLabs audio in browser.");
      };

      await audio.play();
      setPlayback("playing");
    } catch (err) {
      setPlayback("idle");
      setError(err instanceof Error ? err.message : "Voice request failed");
    }
  }

  async function playOrResume() {
    if (playback === "paused" && audioRef.current) {
      try {
        await audioRef.current.play();
        setPlayback("playing");
        setError(null);
      } catch {
        setError("Could not resume playback.");
      }
      return;
    }

    if (playback === "paused" && mode === "browser") {
      try {
        setPlayback("playing");
        await speakWithBrowser(browserTextRef.current || text);
        setPlayback("idle");
      } catch {
        setError("Could not resume browser speech.");
        setPlayback("idle");
      }
      return;
    }

    if (playback === "idle") {
      await loadAndPlay();
    }
  }

  function pause() {
    if (mode === "browser" && playback === "playing") {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.pause();
        setPlayback("paused");
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio || playback !== "playing") return;
    audio.pause();
    setPlayback("paused");
  }

  function stop() {
    stopPlayback();
  }

  const isLoading = playback === "loading";
  const isPlaying = playback === "playing";
  const isPaused = playback === "paused";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2 text-sm sm:text-base">
          <Volume2 className="h-4 w-4 text-emerald-400" />
          Voice Operations Agent
        </h3>
        <span className="text-xs text-zinc-500">
          {mode === "elevenlabs"
            ? "ElevenLabs · current analysis"
            : mode === "browser"
              ? "Browser voice · ElevenLabs blocked"
              : "ElevenLabs (not configured)"}
        </span>
      </div>

      {notice && (
        <p className="text-xs text-sky-400 mb-4 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {notice}
        </p>
      )}

      {error && (
        <p className="text-xs text-amber-400 mb-4 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void playOrResume()}
          disabled={!text || isLoading || isPlaying}
          className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 min-w-[120px]"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPaused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          {isLoading ? "Loading..." : isPaused ? "Continue" : "Play summary"}
        </button>

        <button
          type="button"
          onClick={pause}
          disabled={!isPlaying}
          className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 min-w-[100px]"
        >
          <Pause className="h-4 w-4" />
          Pause
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={!isPlaying && !isPaused}
          className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 min-w-[100px]"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        {isPlaying
          ? "Speaking your latest inventory analysis…"
          : isPaused
            ? "Playback paused — press Continue or Stop."
            : "Plays a summary built from your current uploaded or demo inventory run."}
      </p>
    </div>
  );
}
