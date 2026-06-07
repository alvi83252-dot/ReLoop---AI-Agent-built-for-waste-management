"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  Radio,
  Send,
  AlertCircle,
  Square,
  Bot,
} from "lucide-react";
import { appendLocalSessionLogs } from "@/lib/voice/localMemory";
import type { VoiceLogEntry } from "@/lib/voice/types";
import { cn } from "@/lib/utils";

interface ChatResponse {
  question?: string;
  reply?: string;
  engine?: string;
  mode?: string;
  audio?: string;
  text?: string;
  message?: string;
  error?: string;
  loggedEntries?: VoiceLogEntry[];
  liveSessionId?: string;
  isGreeting?: boolean;
}

interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  engine?: string;
}

type AgentPhase = "idle" | "listening" | "thinking" | "speaking";

interface VoiceAskPanelProps {
  contextSummary?: string;
}

export function VoiceAskPanel({ contextSummary }: VoiceAskPanelProps) {
  const [liveMode, setLiveMode] = useState(false);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const liveActiveRef = useRef(false);
  const liveSessionIdRef = useRef<string | null>(null);
  const liveHistoryRef = useRef<ConversationTurn[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackGenRef = useRef(0);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const stopCurrentAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  }, []);

  const abortPlayback = useCallback(() => {
    playbackGenRef.current += 1;
    stopCurrentAudio();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
  }, [stopCurrentAudio]);

  const speakBrowser = useCallback(
    (text: string, generation: number) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);

        const finish = () => {
          window.clearInterval(watch);
          resolve();
        };

        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.speak(utterance);

        const watch = window.setInterval(() => {
          if (playbackGenRef.current !== generation) {
            window.speechSynthesis?.cancel();
            finish();
          }
        }, 100);
      }),
    []
  );

  const playResponse = useCallback(
    async (data: ChatResponse) => {
      const generation = playbackGenRef.current;
      stopCurrentAudio();

      try {
        if (data.mode === "elevenlabs" && data.audio) {
          await new Promise<void>((resolve) => {
            const audio = new Audio(data.audio);
            audioRef.current = audio;

            const finish = () => {
              window.clearInterval(watch);
              if (audioRef.current === audio) audioRef.current = null;
              resolve();
            };

            audio.onended = finish;
            audio.onerror = finish;

            const watch = window.setInterval(() => {
              if (playbackGenRef.current !== generation) {
                audio.onended = null;
                audio.onerror = null;
                audio.pause();
                audio.currentTime = 0;
                if (audioRef.current === audio) audioRef.current = null;
                window.clearInterval(watch);
                resolve();
              }
            }, 100);

            void audio.play().catch(finish);
          });
          return;
        }

        const speechText = data.text ?? data.reply ?? "";
        if (speechText.trim() && playbackGenRef.current === generation) {
          if (data.message) setNotice(data.message);
          await speakBrowser(speechText, generation);
        }
      } catch {
        if (data.reply && !data.message && playbackGenRef.current === generation) {
          setNotice("Reply ready — audio playback blocked in browser.");
        }
      }
    },
    [speakBrowser, stopCurrentAudio]
  );

  const persistLogs = useCallback((entries?: VoiceLogEntry[]) => {
    if (entries?.length) {
      appendLocalSessionLogs(entries);
      window.dispatchEvent(new CustomEvent("reloop-voice-log-updated"));
    }
  }, []);

  const callChat = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextSummary,
          liveSessionId: liveSessionIdRef.current,
          liveHistory: liveHistoryRef.current.map((t) => ({
            role: t.role,
            content: t.content,
          })),
          ...payload,
        }),
      });
      const data = (await res.json()) as ChatResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Voice chat failed");
      }
      if (data.liveSessionId) {
        liveSessionIdRef.current = data.liveSessionId;
      }
      persistLogs(data.loggedEntries);
      return data;
    },
    [contextSummary, persistLogs]
  );

  const appendTurn = useCallback((turn: ConversationTurn) => {
    liveHistoryRef.current = [...liveHistoryRef.current, turn].slice(-30);
    setConversation((prev) => [...prev, turn]);
  }, []);

  const listenWithBrowserStt = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Win = window as any;
      const SpeechRecognition =
        Win.SpeechRecognition ?? Win.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        resolve(null);
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = "en-GB";
      recognition.interimResults = false;
      recognition.continuous = false;

      let settled = false;
      const finish = (text: string | null) => {
        if (settled) return;
        settled = true;
        resolve(text);
      };

      recognition.onresult = (event: {
        results: { [index: number]: { [index: number]: { transcript?: string } } };
      }) => {
        const text = event.results[0]?.[0]?.transcript?.trim() ?? "";
        finish(text || null);
      };
      recognition.onerror = () => finish(null);
      recognition.onend = () => {
        recognitionRef.current = null;
        if (!settled) finish(null);
      };

      try {
        recognition.start();
      } catch {
        finish(null);
      }

      setTimeout(() => {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }, 9000);
    });
  }, []);

  const listenWithMic = useCallback(async (): Promise<string | null> => {
    const browserText = await listenWithBrowserStt();
    if (browserText) return browserText;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      return await new Promise((resolve) => {
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;

          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          if (blob.size === 0) {
            resolve(null);
            return;
          }

          const form = new FormData();
          form.append("audio", blob, "question.webm");
          try {
            const res = await fetch("/api/voice/transcribe", {
              method: "POST",
              body: form,
            });
            const data = (await res.json()) as { text?: string };
            resolve(data.text?.trim() || null);
          } catch {
            resolve(null);
          }
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 5500);
      });
    } catch {
      return null;
    }
  }, [listenWithBrowserStt]);

  const handleTurn = useCallback(
    async (prompt: string, inputSource: string) => {
      if (!prompt.trim()) return;

      if (!liveSessionIdRef.current) {
        liveSessionIdRef.current = `live-${Date.now().toString(36)}`;
      }

      appendTurn({ role: "user", content: prompt.trim() });
      setPhase("thinking");
      setError(null);
      setNotice(null);

      try {
        const data = await callChat({ question: prompt.trim(), inputSource });
        const reply = data.reply ?? "";
        if (!reply.trim()) {
          throw new Error("Agent returned an empty reply.");
        }
        appendTurn({ role: "assistant", content: reply, engine: data.engine });
        setPhase("speaking");
        await playResponse(data);
        if (inputSource === "text") {
          setQuestion("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Agent failed");
      } finally {
        if (!liveActiveRef.current) {
          setPhase("idle");
        }
      }
    },
    [appendTurn, callChat, playResponse]
  );

  const runLiveLoop = useCallback(async () => {
    while (liveActiveRef.current) {
      setPhase("listening");
      const heard = await listenWithMic();
      if (!liveActiveRef.current) break;
      if (!heard?.trim()) {
        if (liveActiveRef.current) {
          setNotice("Didn't catch that — listening again…");
        }
        continue;
      }
      setNotice(null);
      await handleTurn(heard, "live_mic");
      if (!liveActiveRef.current) break;
      await new Promise((r) => setTimeout(r, 400));
    }
    setPhase("idle");
  }, [handleTurn, listenWithMic]);

  const startLiveAgent = useCallback(async () => {
    setError(null);
    setNotice(null);
    liveActiveRef.current = true;
    setLiveMode(true);
    liveSessionIdRef.current = `live-${Date.now().toString(36)}`;
    liveHistoryRef.current = [];
    setConversation([]);

    try {
      setPhase("thinking");
      const data = await callChat({ isLiveStart: true });
      const greeting = data.reply ?? "";
      if (greeting) {
        appendTurn({ role: "assistant", content: greeting, engine: "system" });
      }
      setPhase("speaking");
      await playResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start live agent");
      liveActiveRef.current = false;
      setLiveMode(false);
      setPhase("idle");
      return;
    }

    if (liveActiveRef.current) {
      void runLiveLoop();
    }
  }, [appendTurn, callChat, playResponse, runLiveLoop]);

  const stopLiveAgent = useCallback(() => {
    liveActiveRef.current = false;
    setLiveMode(false);
    abortPlayback();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase("idle");
    setNotice("Live agent stopped.");
  }, [abortPlayback]);

  useEffect(() => {
    return () => {
      liveActiveRef.current = false;
      abortPlayback();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [abortPlayback]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation, phase]);

  const isBusy = phase === "thinking" || phase === "speaking";

  return (
    <div className="mt-4 pt-4 border-t border-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            Live Voice Agent
          </h4>
          <p className="text-xs text-zinc-500 mt-1">
            Speak naturally — ask by session number or clock time from the logs.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs",
            phase === "idle" && "border-zinc-700 text-zinc-500",
            phase === "listening" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
            phase === "thinking" && "border-amber-500/40 bg-amber-500/10 text-amber-400",
            phase === "speaking" && "border-sky-500/40 bg-sky-500/10 text-sky-300",
            liveMode && phase === "idle" && "border-green-500/40 bg-green-500/10 text-green-400"
          )}
        >
          {(phase === "listening" || liveMode) && phase !== "thinking" && phase !== "speaking" && (
            <Radio className="h-3 w-3 animate-pulse" />
          )}
          {!liveMode && phase === "idle" && "Offline"}
          {phase === "listening" && "Listening…"}
          {phase === "thinking" && "Thinking…"}
          {phase === "speaking" && "Speaking…"}
          {liveMode && phase === "idle" && "Live"}
        </span>
      </div>

      {notice && (
        <p className="text-xs text-sky-400 mb-2 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {notice}
        </p>
      )}

      {error && (
        <p className="text-xs text-amber-400 mb-2 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {!liveMode ? (
          <button
            type="button"
            onClick={() => void startLiveAgent()}
            disabled={isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Mic className="h-4 w-4" />
            Start live agent
          </button>
        ) : (
          <button
            type="button"
            onClick={stopLiveAgent}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            <Square className="h-4 w-4" />
            Stop live agent
          </button>
        )}

        {!liveMode && (
          <button
            type="button"
            onClick={() => void handleTurn(question, "text")}
            disabled={!question.trim() || isBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Ask once
          </button>
        )}
      </div>

      {!liveMode && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && question.trim() && !isBusy) {
                void handleTurn(question, "text");
              }
            }}
            placeholder="List all sessions · What did you say at 3:45 PM? · Session 2 transcript"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
            disabled={isBusy}
          />
        </div>
      )}

      {liveMode && phase === "listening" && (
        <p className="text-xs text-emerald-400 mb-3 flex items-center gap-1.5">
          <MicOff className="h-3.5 w-3.5" />
          Speak now — the agent will answer then listen again automatically.
        </p>
      )}

      {conversation.length > 0 || isBusy ? (
        <div
          ref={threadRef}
          className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
        >
          {conversation.map((turn, i) => (
            <div
              key={`${i}-${turn.role}-${turn.content.slice(0, 20)}`}
              className={cn(
                "text-xs rounded-lg px-3 py-2",
                turn.role === "user"
                  ? "border border-zinc-800 bg-zinc-900/60 text-zinc-300"
                  : "border border-emerald-900/30 bg-emerald-950/20 text-zinc-200"
              )}
            >
              <span
                className={
                  turn.role === "user" ? "text-zinc-500" : "text-emerald-500"
                }
              >
                {turn.role === "user"
                  ? "You"
                  : `Agent${turn.engine ? ` · ${turn.engine}` : ""}`}
                :{" "}
              </span>
              {turn.content}
            </div>
          ))}
          {phase === "thinking" && (
            <div className="text-xs text-amber-400 flex items-center gap-1.5 px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Agent is thinking…
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
