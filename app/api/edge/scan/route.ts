import { NextResponse } from "next/server";
import { edgeDGXRouter } from "@/lib/edge-dgx-router";
import { InventoryItemSchema } from "@/lib/types";

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

    const assets = await edgeDGXRouter.edgeScan(inventory);

    return NextResponse.json({
      status: "edge_scan_complete",
      processedAt: "ZGX_NANO",
      acceleration: "NVIDIA TensorRT",
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
