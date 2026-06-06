"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";

export function VoiceAgent({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [mode, setMode] = useState<"demo" | "elevenlabs">("demo");

  async function speak() {
    if (!text || speaking) return;
    setSpeaking(true);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setMode(data.mode === "elevenlabs" ? "elevenlabs" : "demo");

      if (data.audio) {
        const audio = new Audio(data.audio);
        audio.onended = () => setSpeaking(false);
        await audio.play();
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setSpeaking(false);
      }
    } catch {
      setSpeaking(false);
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
          {mode === "elevenlabs" ? "ElevenLabs" : "Demo (Browser TTS)"}
        </span>
      </div>
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
    </div>
  );
}
