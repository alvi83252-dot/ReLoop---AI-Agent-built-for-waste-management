import type { AgentContext, AssetPayload, InventoryItem } from "@/lib/types";
import { AssetPayloadSchema } from "@/lib/types";
import { completeStep, createStep, simulateAgentDelay } from "./utils";

export async function runAssetIntakeAgent(
  ctx: AgentContext
): Promise<AgentContext> {
  const step = createStep(
    "Asset Intake Agent",
    "edge",
    "Scanning inventory on HP ZGX Nano — extracting device types, age, condition..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(600);

  const assets: AssetPayload[] = ctx.inventory.flatMap((item) =>
    Array.from({ length: Math.min(item.quantity, 5) }, (_, i) =>
      AssetPayloadSchema.parse({
        deviceType: item.deviceType,
        conditionScore: item.conditionScore + (i % 3) * 0.02 - 0.02,
        estimatedAge: item.estimatedAgeYears,
        quantity: Math.ceil(item.quantity / 5),
        location: "edge" as const,
        processedAt: "ZGX_NANO",
        confidence: 0.78 + item.conditionScore * 0.15,
      })
    )
  );

  ctx.assets = assets;
  ctx.timeline.push(
    completeStep(step, `Edge scan complete: ${ctx.inventory.length} asset groups classified via TensorRT`)
  );
  return ctx;
}

export function aggregateAssets(inventory: InventoryItem[]): AssetPayload[] {
  return inventory.map((item) =>
    AssetPayloadSchema.parse({
      deviceType: item.deviceType,
      conditionScore: item.conditionScore,
      estimatedAge: item.estimatedAgeYears,
      quantity: item.quantity,
      location: "edge",
      processedAt: "ZGX_NANO",
      confidence: 0.82,
    })
  );
}
