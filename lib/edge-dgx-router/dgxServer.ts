import type { AssetPayload, InventoryItem, NebiusBackup, PipelineResult } from "@/lib/types";
import { getDgxOrchestratorUrl } from "@/lib/config/hardware";
import { runAgentPipeline } from "@/lib/agents";
import { buildAggregatedRecoveryPlan, buildVoiceSummaryFromResult } from "@/lib/agents/reportAgent";
import { analyzeInventoryWithNemoclaw } from "@/lib/nemoclaw/client";
import { runNebiusForPipelineResult } from "@/lib/llm/nebiusAgents";

/** Server-side: run DGX orchestration on DGX Spark service or local Next.js agents. */
export async function runDgxOrchestration(payload: {
  assets: AssetPayload[];
  inventory: InventoryItem[];
  source?: "demo" | "upload";
  useNemoclaw?: boolean;
}): Promise<
  PipelineResult & {
    hardwareTier: "dgx" | "local";
    nemoclaw?: unknown;
    nebiusBackup: NebiusBackup;
  }
> {
  const dgxUrl = getDgxOrchestratorUrl();
  const useNemoclaw = payload.useNemoclaw !== false;

  if (dgxUrl) {
    try {
      const res = await fetch(`${dgxUrl}/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(120_000),
      });

      if (res.ok) {
        let result = (await res.json()) as PipelineResult;
        const { result: enriched, nebiusBackup } = await runNebiusForPipelineResult(
          result,
          "DGX Spark live orchestration"
        );
        result = enriched;

        return {
          ...result,
          voiceSummary: buildVoiceSummaryFromResult(
            result.inventory,
            result.optimizations,
            payload.source ?? "demo"
          ),
          reports: {
            ...result.reports,
            recoveryPlan: buildAggregatedRecoveryPlan(
              result.inventory,
              result.optimizations
            ),
          },
          hardwareTier: "dgx",
          nebiusBackup,
        };
      }
    } catch (error) {
      console.warn("DGX orchestrator unavailable, using local fallback:", error);
    }
  }

  const nemoclaw = useNemoclaw
    ? await analyzeInventoryWithNemoclaw(payload.inventory)
    : { usedNemoclaw: false, insight: "", source: "fallback" as const };

  let pipeline = await runAgentPipeline(payload.inventory, {
    source: payload.source ?? "demo",
  });

  if (nemoclaw.insight) {
    pipeline.reports.reflectionNotes = [
      pipeline.reports.reflectionNotes,
      `NemoClaw / Nemotron analysis (${nemoclaw.source}):`,
      nemoclaw.insight,
    ].join("\n\n");
  }

  return {
    ...pipeline,
    hardwareTier: "local",
    nemoclaw,
  };
}
