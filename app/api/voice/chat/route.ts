import { NextResponse } from "next/server";
import { getElevenLabsConfig } from "@/lib/env/elevenlabs";
import { askNemotronChat, type NemotronChatResult } from "@/lib/nemoclaw/chat";
import { synthesizeVoiceResponse } from "@/lib/voice/elevenLabsTts";
import {
  answerFromSessionMemory,
  detectMemoryIntent,
  questionLooksSessionMemoryBased,
  questionLooksTimeBased,
} from "@/lib/voice/memoryAnswer";
import {
  getPriorSessionSummary,
  getSessionCount,
  loadConversationHistory,
  loadFullVoiceSession,
  logVoiceEvent,
  newSessionId,
} from "@/lib/voice/memory";

export const runtime = "nodejs";

type LiveTurn = { role: string; content: string };

const NEMOTRON_CHAT_TIMEOUT_MS = 8_000;

async function askWithTimeout(
  question: string,
  history: LiveTurn[],
  memorySummary: string,
  contextSummary?: string
): Promise<NemotronChatResult> {
  return Promise.race([
    askNemotronChat(question, history, memorySummary, contextSummary),
    new Promise<NemotronChatResult>((resolve) => {
      setTimeout(
        () =>
          resolve({
            reply: "",
            engine: "memory",
            error: "Nemotron timed out — using session memory",
          }),
        NEMOTRON_CHAT_TIMEOUT_MS
      );
    }),
  ]);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = String(body.question ?? "").trim();
    const contextSummary = body.contextSummary
      ? String(body.contextSummary)
      : undefined;
    const inputSource = body.inputSource ? String(body.inputSource) : "text";
    const isLiveStart = Boolean(body.isLiveStart);
    const liveHistory = Array.isArray(body.liveHistory)
      ? (body.liveHistory as LiveTurn[]).filter(
          (t) => t?.role && typeof t.content === "string" && t.content.trim()
        )
      : [];

    if (!question && !isLiveStart) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    const sessionId = body.liveSessionId
      ? String(body.liveSessionId)
      : newSessionId();
    const loggedEntries = [];
    const memorySummary = getPriorSessionSummary();
    const serverHistory = loadConversationHistory();
    const history = [...serverHistory, ...liveHistory].slice(-40);
    const allEntries = loadFullVoiceSession();
    const sessionCount = getSessionCount();

    if (isLiveStart) {
      loggedEntries.push(
        logVoiceEvent(
          "event",
          "Live voice agent session started on dashboard",
          {
            mode: "live_agent",
            prior_sessions: sessionCount,
            restored_turns: history.length,
          },
          sessionId
        )
      );

      const greeting =
        sessionCount > 0 || history.length > 0
          ? `ReLoop voice agent online. I remember ${Math.max(sessionCount, 1)} prior session${sessionCount === 1 ? "" : "s"} and ${history.length} conversation turns. Ask by clock time with AM or PM, like "what did you say at 5:11 AM", or ask about a previous session.`
          : "ReLoop voice agent online. Run a recovery analysis first, or ask me about London circular economy routing for enterprise IT assets.";

      loggedEntries.push(
        logVoiceEvent(
          "assistant",
          greeting,
          { mode: "live_agent", engine: "system", type: "greeting" },
          sessionId
        )
      );

      const { apiKey, voiceId, modelId } = getElevenLabsConfig();
      const voicePayload = apiKey
        ? await synthesizeVoiceResponse(apiKey, voiceId, modelId, greeting)
        : { mode: "browser" as const, text: greeting, message: "Browser voice" };

      return NextResponse.json({
        reply: greeting,
        engine: "system",
        sessionId,
        liveSessionId: sessionId,
        memorySummary: memorySummary || null,
        loggedEntries,
        isGreeting: true,
        ...voicePayload,
      });
    }

    loggedEntries.push(
      logVoiceEvent(
        "user",
        question,
        { mode: "live_agent", input_source: inputSource },
        sessionId
      )
    );

    const intent = detectMemoryIntent(question);
    let reply = "";
    let engine = "memory";

    // Session/time queries use JSONL logs only — never guess from other sessions
    if (
      intent.type !== "topic" ||
      questionLooksTimeBased(question) ||
      questionLooksSessionMemoryBased(question)
    ) {
      reply = answerFromSessionMemory(question, allEntries);
    } else {
      const nemotron = await askWithTimeout(
        question,
        history,
        memorySummary,
        contextSummary
      );

      reply = nemotron.reply.trim();
      engine = nemotron.engine;

      if (!reply) {
        reply = answerFromSessionMemory(question, allEntries);
        engine = "memory";
      }
    }

    loggedEntries.push(
      logVoiceEvent(
        "assistant",
        reply,
        { mode: "live_agent", engine },
        sessionId
      )
    );

    const { apiKey, voiceId, modelId } = getElevenLabsConfig();
    const voicePayload = apiKey
      ? await synthesizeVoiceResponse(apiKey, voiceId, modelId, reply)
      : {
          mode: "browser" as const,
          text: reply,
          message: "ElevenLabs not configured — using browser voice.",
        };

    if (voicePayload.mode === "elevenlabs") {
      loggedEntries.push(
        logVoiceEvent(
          "event",
          "Live agent response spoken via ElevenLabs",
          { mode: "live_agent", voice: "elevenlabs" },
          sessionId
        )
      );
    } else {
      loggedEntries.push(
        logVoiceEvent(
          "event",
          "Live agent response spoken via browser voice",
          { mode: "live_agent", voice: "browser" },
          sessionId
        )
      );
    }

    return NextResponse.json({
      question,
      reply,
      engine,
      sessionId,
      liveSessionId: sessionId,
      memorySummary: memorySummary || null,
      loggedEntries,
      ...voicePayload,
    });
  } catch (error) {
    console.error("Voice chat error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Voice chat failed",
      },
      { status: 500 }
    );
  }
}
