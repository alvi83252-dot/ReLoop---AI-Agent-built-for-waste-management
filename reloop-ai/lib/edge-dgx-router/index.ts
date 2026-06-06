import type { AssetPayload, PipelineResult } from "@/lib/types";
import type { InventoryItem } from "@/lib/types";

export class EdgeDGXRouter {
  private edgeMode: "ZGX_NANO" | "LOCAL_LAPTOP" = "ZGX_NANO";

  setEdgeMode(mode: "ZGX_NANO" | "LOCAL_LAPTOP") {
    this.edgeMode = mode;
  }

  async edgeScan(input: InventoryItem[]): Promise<AssetPayload[]> {
    await this.simulateEdgeInference();

    return input.map((item) => ({
      deviceType: item.deviceType,
      conditionScore: item.conditionScore,
      estimatedAge: item.estimatedAgeYears,
      quantity: item.quantity,
      location: "edge" as const,
      processedAt: this.edgeMode,
      confidence: Math.round((0.78 + item.conditionScore * 0.15) * 100) / 100,
    }));
  }

  async sendToDGX(payload: {
    assets: AssetPayload[];
    inventory: InventoryItem[];
    source?: "demo" | "upload";
  }): Promise<PipelineResult> {
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
    impact: PipelineResult["summary"];
  }> {
    await this.simulateEdgeInference(300);

    return {
      status: "executed_on_zgx",
      impact: plan.summary,
    };
  }

  async runFullLoop(
    inventory: InventoryItem[],
    source: "demo" | "upload" = "demo"
  ): Promise<PipelineResult> {
    const assets = await this.edgeScan(inventory);
    const result = await this.sendToDGX({ assets, inventory, source });
    await this.executeEdgeDecision(result);
    return result;
  }

  private async simulateEdgeInference(ms = 500): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const edgeDGXRouter = new EdgeDGXRouter();
