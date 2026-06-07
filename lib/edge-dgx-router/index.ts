import type { AssetPayload, InventoryItem, PipelineResult } from "@/lib/types";

export interface HardwareLoopMeta {
  edgeTier: "zgx" | "local";
  dgxTier: "dgx" | "local";
  executionTier: "zgx" | "local";
}

export class EdgeDGXRouter {
  async edgeScan(input: InventoryItem[]): Promise<{
    assets: AssetPayload[];
    tier: HardwareLoopMeta["edgeTier"];
  }> {
    const response = await fetch("/api/edge/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inventory: input }),
    });

    if (!response.ok) {
      throw new Error("Edge scan failed");
    }

    const data = await response.json();
    return {
      assets: data.assets,
      tier: data.tier ?? "local",
    };
  }

  async sendToDGX(payload: {
    assets: AssetPayload[];
    inventory: InventoryItem[];
    source?: "demo" | "upload";
  }): Promise<PipelineResult & { hardwareTier?: string; nemoclaw?: unknown }> {
    const response = await fetch("/api/dgx/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        useNemoclaw: true,
      }),
    });

    if (!response.ok) {
      throw new Error("DGX orchestration failed");
    }

    return response.json();
  }

  async executeEdgeDecision(plan: PipelineResult): Promise<{
    status: string;
    tier: HardwareLoopMeta["executionTier"];
  }> {
    const response = await fetch("/api/edge/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: plan.summary }),
    });

    if (!response.ok) {
      throw new Error("Edge execution failed");
    }

    return response.json();
  }

  async runFullLoop(
    inventory: InventoryItem[],
    source: "demo" | "upload" = "demo"
  ): Promise<PipelineResult & { hardware?: HardwareLoopMeta }> {
    const { assets, tier: edgeTier } = await this.edgeScan(inventory);
    const result = await this.sendToDGX({ assets, inventory, source });
    const { tier: executionTier } = await this.executeEdgeDecision(result);

    const dgxTier =
      (result as { hardwareTier?: string }).hardwareTier === "dgx" ? "dgx" : "local";

    return {
      ...result,
      assetPayloads: assets,
      hardware: {
        edgeTier,
        dgxTier,
        executionTier,
      },
    };
  }
}

export const edgeDGXRouter = new EdgeDGXRouter();
