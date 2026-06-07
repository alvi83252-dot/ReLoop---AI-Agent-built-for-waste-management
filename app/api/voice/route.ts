import { NextResponse } from "next/server";
import { getElevenLabsConfig } from "@/lib/env/elevenlabs";
import { synthesizeVoiceResponse } from "@/lib/voice/elevenLabsTts";
import {
  getPriorSessionSummary,
  getSessionCount,
  logVoiceEvent,
  newSessionId,
} from "@/lib/voice/memory";

export const runtime = "nodejs";

function getErrorCause(error: unknown): string | undefined {
  if (error instanceof Error && "cause" in error) {
    const cause = error.cause;
    if (cause instanceof Error) {
      return cause.message;
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { mode: "error", message: "No text provided", text: "" },
        { status: 400 }
      );
    }

    const { apiKey, voiceId, modelId } = getElevenLabsConfig();

    if (!apiKey) {
      return NextResponse.json({
        mode: "error",
        message:
          "ElevenLabs API key not configured. Add ELEVEN_API_KEY to .env.local and restart npm run dev.",
        text,
      });
    }

    const priorSummary = getPriorSessionSummary();
    const sessionId = newSessionId();
    const sessionCount = getSessionCount();
    const loggedEntries = [];

    if (priorSummary) {
      loggedEntries.push(
        logVoiceEvent("system", priorSummary, { type: "prior_context" }, sessionId)
      );
    }

    loggedEntries.push(
      logVoiceEvent(
        "event",
        "Voice summary played from dashboard",
        { session_number: sessionCount + 1, source: "web" },
        sessionId
      )
    );
    loggedEntries.push(
      logVoiceEvent("assistant", text, { source: "reloop_dashboard" }, sessionId)
    );

    const voicePayload = await synthesizeVoiceResponse(apiKey, voiceId, modelId, text);

    if (voicePayload.mode === "elevenlabs") {
      loggedEntries.push(
        logVoiceEvent(
          "event",
          "ElevenLabs audio synthesized successfully",
          { voiceId, chars: text.length },
          sessionId
        )
      );

      return NextResponse.json({
        mode: "elevenlabs",
        audio: voicePayload.audio,
        text,
        voiceId,
        sessionId,
        rememberedSessions: sessionCount,
        priorSummary: priorSummary || null,
        loggedEntries,
      });
    }

    loggedEntries.push(
      logVoiceEvent(
        "event",
        voicePayload.message.includes("blocked")
          ? "ElevenLabs free tier blocked — browser voice fallback"
          : "ElevenLabs unavailable — browser voice fallback",
        { error: voicePayload.message.slice(0, 300) },
        sessionId
      )
    );

    return NextResponse.json({
      mode: "browser",
      text,
      sessionId,
      rememberedSessions: sessionCount,
      priorSummary: priorSummary || null,
      loggedEntries,
      message: voicePayload.message.includes("blocked")
        ? "ElevenLabs free tier is disabled on this account (VPN/proxy or multiple free accounts). Using browser voice so you can still demo. For the prize, use a paid ElevenLabs key or disable VPN."
        : voicePayload.message,
    });
  } catch (error) {
    const cause = getErrorCause(error);
    const message =
      error instanceof Error ? error.message : "Voice synthesis failed";
    const sslHint =
      cause?.includes("certificate") || message.includes("certificate")
        ? " Restart with npm run dev (uses system CA store for ElevenLabs SSL)."
        : "";

    console.error("Voice route error:", error);

    return NextResponse.json({
      mode: "error",
      message: `${message}${sslHint}`,
    });
  }
}
