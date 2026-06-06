import { NextResponse } from "next/server";
import { runZgxEdgeExecute } from "@/lib/edge-dgx-router/server";

export async function POST(req: Request) {
  try {
    const { summary } = await req.json();
    const { status, tier } = await runZgxEdgeExecute(summary ?? {});

    return NextResponse.json({
      status,
      tier,
      hardware: "HP ZGX Nano AI Station",
      message:
        tier === "zgx"
          ? "Recovery plan executed on ZGX Nano — reports and voice ready"
          : "Recovery plan executed locally (ZGX URL not configured)",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Edge execution failed" },
      { status: 500 }
    );
  }
}
