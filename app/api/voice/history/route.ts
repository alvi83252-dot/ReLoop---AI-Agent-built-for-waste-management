import { NextResponse } from "next/server";
import {
  getPriorSessionSummary,
  getRecentVoiceSessions,
  getSessionCount,
  getSessionStats,
  loadConversationHistory,
  loadFullVoiceSession,
} from "@/lib/voice/memory";
import { buildSessionTimeline } from "@/lib/voice/sessionTimeline";

export const runtime = "nodejs";

export async function GET() {
  const entries = loadFullVoiceSession();
  const history = loadConversationHistory();
  const summary = getPriorSessionSummary();
  const recent = getRecentVoiceSessions(8);
  const stats = getSessionStats();
  const sessions = buildSessionTimeline(entries);

  return NextResponse.json({
    count: entries.length,
    sessionCount: getSessionCount(),
    summary,
    history,
    recent,
    entries,
    stats,
    sessions,
  });
}
