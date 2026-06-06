import { NextResponse } from "next/server";
import {
  getPriorSessionSummary,
  getRecentVoiceSessions,
  getSessionCount,
  loadConversationHistory,
  loadFullVoiceSession,
} from "@/lib/voice/memory";

export const runtime = "nodejs";

export async function GET() {
  const entries = loadFullVoiceSession();
  const history = loadConversationHistory();
  const summary = getPriorSessionSummary();
  const recent = getRecentVoiceSessions(8);

  return NextResponse.json({
    count: entries.length,
    sessionCount: getSessionCount(),
    summary,
    history,
    recent,
    entries,
  });
}
