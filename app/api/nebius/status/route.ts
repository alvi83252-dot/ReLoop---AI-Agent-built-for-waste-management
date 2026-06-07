import { NextResponse } from "next/server";
import { checkNebiusHealth } from "@/lib/llm/nebius";

export const runtime = "nodejs";

export async function GET() {
  const health = await checkNebiusHealth();

  return NextResponse.json({
    nebius: {
      configured: health.configured,
      online: health.online,
      model: health.model,
      role: "Cloud backup inference (Nebius Token Factory)",
      detail:
        health.detail ??
        (health.configured
          ? "Nebius configured"
          : "Set NEBIUS_API_KEY in .env.local"),
    },
  });
}
