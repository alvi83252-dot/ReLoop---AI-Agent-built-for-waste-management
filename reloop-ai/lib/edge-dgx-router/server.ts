import type { AssetPayload, InventoryItem } from "@/lib/types";
import { getZgxServiceUrl } from "@/lib/config/hardware";

interface EdgeScanItemResult {
  device_type: string;
  condition_score: number;
  estimated_age: number;
  quantity: number;
  confidence: number;
  processed_by: string;
  demo_mode: boolean;
}

/** Server-side: run batch edge inference on ZGX PyTorch service or local fallback. */
export async function runZgxEdgeScan(
  inventory: InventoryItem[]
): Promise<{ assets: AssetPayload[]; tier: "zgx" | "local" }> {
  const zgxUrl = getZgxServiceUrl();

  if (zgxUrl) {
    try {
      const res = await fetch(`${zgxUrl}/edge/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory: inventory.map((item) => ({
            device_type: item.deviceType,
            condition_score: item.conditionScore,
            estimated_age: item.estimatedAgeYears,
            quantity: item.quantity,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          assets: EdgeScanItemResult[];
          processed_at?: string;
        };
        return {
          tier: "zgx",
          assets: data.assets.map((a) => ({
            deviceType: a.device_type,
            conditionScore: a.condition_score,
            estimatedAge: a.estimated_age,
            quantity: a.quantity,
            location: "edge" as const,
            processedAt: data.processed_at ?? "ZGX_NANO",
            confidence: a.confidence,
          })),
        };
      }
    } catch (error) {
      console.warn("ZGX edge scan failed, using local fallback:", error);
    }
  }

  return {
    tier: "local",
    assets: inventory.map((item) => ({
      deviceType: item.deviceType,
      conditionScore: item.conditionScore,
      estimatedAge: item.estimatedAgeYears,
      quantity: item.quantity,
      location: "edge" as const,
      processedAt: "ZGX_NANO_LOCAL",
      confidence: Math.round((0.78 + item.conditionScore * 0.15) * 100) / 100,
    })),
  };
}

export async function runZgxEdgeExecute(summary: Record<string, unknown>): Promise<{
  status: string;
  tier: "zgx" | "local";
}> {
  const zgxUrl = getZgxServiceUrl();

  if (zgxUrl) {
    try {
      const res = await fetch(`${zgxUrl}/edge/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = await res.json();
        return { status: data.status ?? "executed_on_zgx", tier: "zgx" };
      }
    } catch (error) {
      console.warn("ZGX edge execute failed, using local fallback:", error);
    }
  }

  return { status: "executed_on_zgx_local", tier: "local" };
}
