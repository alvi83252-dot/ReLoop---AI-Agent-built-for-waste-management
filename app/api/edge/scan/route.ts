import { NextResponse } from "next/server";
import { InventoryItemSchema } from "@/lib/types";
import { runZgxEdgeScan } from "@/lib/edge-dgx-router/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const inventory = (data.inventory ?? []).map(
      (item: unknown, idx: number) =>
        InventoryItemSchema.parse({
          ...(item as object),
          id: (item as { id?: string }).id ?? `scan-${idx}`,
        })
    );

    const { assets, tier } = await runZgxEdgeScan(inventory);

    return NextResponse.json({
      status: "edge_scan_complete",
      tier,
      processedAt: tier === "zgx" ? "ZGX_NANO" : "ZGX_NANO_LOCAL",
      acceleration: tier === "zgx" ? "NVIDIA CUDA / TensorRT / PyTorch" : "local-simulated",
      hardware: "HP ZGX Nano AI Station",
      assets,
      confidence: 0.82,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Edge scan failed" },
      { status: 500 }
    );
  }
}
