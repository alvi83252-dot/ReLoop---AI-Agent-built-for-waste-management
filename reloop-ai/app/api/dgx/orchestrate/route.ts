import { NextResponse } from "next/server";
import { runDgxOrchestration } from "@/lib/edge-dgx-router/dgxServer";
import type { InventoryItem } from "@/lib/types";
import { InventoryItemSchema } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const inventory: InventoryItem[] = (data.inventory ?? []).map(
      (item: unknown, idx: number) =>
        InventoryItemSchema.parse({
          ...(item as object),
          id: (item as InventoryItem).id ?? `item-${idx}`,
        })
    );

    const result = await runDgxOrchestration({
      assets: data.assets ?? [],
      inventory,
      source: data.source,
      useNemoclaw: data.useNemoclaw !== false,
    });

    return NextResponse.json({
      ...result,
      reasoningPath: result.timeline
        .filter((s) => s.layer === "dgx" || s.layer === "synthesis")
        .map((s) => s.message),
      hardware: {
        edge: "HP ZGX Nano AI Station",
        core:
          result.hardwareTier === "dgx"
            ? "NVIDIA DGX Spark (Scan) — live"
            : "NVIDIA DGX Spark (local fallback)",
        acceleration: "CUDA / TensorRT / PyTorch",
        cloudBackup: "Nebius",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Orchestration failed" },
      { status: 500 }
    );
  }
}
