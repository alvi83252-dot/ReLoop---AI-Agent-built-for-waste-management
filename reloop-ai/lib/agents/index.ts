import type { AgentContext, InventoryItem, PipelineResult } from "@/lib/types";
import { runAssetIntakeAgent } from "./assetAgent";
import {
  runCarbonAgent,
  runCircularAgent,
  runEconomicAgent,
} from "./circularAgent";
import { runLifecycleAgent } from "./lifecycleAgent";
import { runMatchingAgent } from "./matchingAgent";
import {
  runDecisionSynthesizer,
  runReflectionAgent,
  runRiskAgent,
} from "./riskAgent";
import {
  buildSummary,
  buildVoiceSummary,
  runReportAgent,
} from "./reportAgent";
import { resetStepCounter } from "./utils";
import { buildKnowledgeGraph } from "@/lib/graph/knowledgeGraph";

export async function runAgentPipeline(
  inventory: InventoryItem[]
): Promise<PipelineResult> {
  resetStepCounter();

  let ctx: AgentContext = {
    inventory,
    assets: [],
    lifecycle: [],
    circular: [],
    carbon: [],
    economic: [],
    matches: [],
    risks: [],
    reflection: "",
    timeline: [],
  };

  // Edge layer — ZGX Nano
  ctx = await runAssetIntakeAgent(ctx);

  // DGX Spark — parallel agent processing (sequential for demo visibility)
  ctx = await runLifecycleAgent(ctx);
  ctx = await runCircularAgent(ctx);
  ctx = await runCarbonAgent(ctx);
  ctx = await runEconomicAgent(ctx);
  ctx = await runMatchingAgent(ctx);
  ctx = await runRiskAgent(ctx);

  // Decision synthesis
  ctx = await runDecisionSynthesizer(ctx);
  ctx = await runReflectionAgent(ctx);

  // Edge execution + reports
  const { ctx: finalCtx, reports } = await runReportAgent(ctx);
  const executionStep = {
    id: `edge-exec-${Date.now()}`,
    agent: "Edge Execution Agent — ZGX Nano",
    layer: "execution" as const,
    status: "complete" as const,
    message: "Recovery plan executed on edge — reports and voice output ready",
    timestamp: Date.now(),
  };
  finalCtx.timeline.push(executionStep);

  const summary = buildSummary(finalCtx);
  const knowledgeGraph = buildKnowledgeGraph(finalCtx);

  return {
    inventory,
    assetPayloads: finalCtx.assets,
    optimizations: finalCtx.circular,
    timeline: finalCtx.timeline,
    summary,
    reports,
    knowledgeGraph,
    voiceSummary: buildVoiceSummary(finalCtx),
    sponsors: {
      edge: "HP ZGX Nano AI Station",
      core: "NVIDIA DGX Spark",
      inference: "NVIDIA CUDA / TensorRT",
      cloudBackup: "Nebius",
      voice: "ElevenLabs",
    },
    demoMode:
      !process.env.OPENAI_API_KEY &&
      !process.env.ELEVEN_API_KEY &&
      !process.env.ELEVENLABS_API_KEY &&
      !process.env.NEBIUS_API_KEY,
  };
}
