import { NextResponse } from "next/server";
import https from "node:https";
import { getElevenLabsConfig } from "@/lib/env/elevenlabs";
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

/** HTTPS request using system-friendly TLS (works behind corporate proxies on Windows). */
function elevenLabsTts(
  voiceId: string,
  apiKey: string,
  text: string,
  modelId: string
): Promise<Buffer> {
  const body = JSON.stringify({ text, model_id: modelId });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.elevenlabs.io",
        path: `/v1/text-to-speech/${voiceId}`,
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "xi-api-key": apiKey,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(buffer);
            return;
          }
          reject(
            new Error(
              `ElevenLabs HTTP ${res.statusCode}: ${buffer.toString("utf8").slice(0, 300)}`
            )
          );
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
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

    const audioBuffer = await elevenLabsTts(voiceId, apiKey, text, modelId);
    const base64 = audioBuffer.toString("base64");

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
      audio: `data:audio/mpeg;base64,${base64}`,
      text,
      voiceId,
      sessionId,
      rememberedSessions: sessionCount,
      priorSummary: priorSummary || null,
      loggedEntries,
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
