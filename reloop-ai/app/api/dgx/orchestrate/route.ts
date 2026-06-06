import { NextResponse } from "next/server";
import { runAgentPipeline } from "@/lib/agents";
import { nebiusBackupInference } from "@/lib/llm/nebius";
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

    const result = await runAgentPipeline(inventory);
    const nebius = await nebiusBackupInference({ inventorySize: inventory.length });

    return NextResponse.json({
      ...result,
      nebiusBackup: nebius,
      reasoningPath: result.timeline
        .filter((s) => s.layer === "dgx" || s.layer === "synthesis")
        .map((s) => s.message),
      hardware: {
        edge: "HP ZGX Nano AI Station",
        core: "NVIDIA DGX Spark (Scan)",
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
