import type { AgentContext, InventoryItem, NebiusBackup, PipelineResult } from "@/lib/types";
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
import { AGENT_NAMES } from "./names";
import { resetStepCounter } from "./utils";
import { buildKnowledgeGraph } from "@/lib/graph/knowledgeGraph";
import { nebiusPipelineBackup } from "@/lib/llm/nebiusAgents";
import { isNebiusConfigured } from "@/lib/env/nebius";

function buildNebiusBackup(ctx: AgentContext): NebiusBackup {
  const jobs = ctx.nebius?.jobs ?? {
    carbon: "demo" as const,
    reflection: "demo" as const,
    backup: "demo" as const,
  };
  const anyLive = jobs.carbon === "live" || jobs.reflection === "live" || jobs.backup === "live";

  return {
    status: anyLive ? "live" : jobs.backup === "error" ? "error" : "demo",
    model: ctx.nebius?.model,
    summary:
      ctx.nebius?.backupSummary ??
      (isNebiusConfigured()
        ? "Nebius cloud backup completed."
        : "Nebius cloud backup idle — local London datasets and rule-based agents used."),
    carbonInsight: ctx.nebius?.carbonInsight,
    reflectionInsight: ctx.nebius?.reflectionInsight,
    jobs,
  };
}

function mergeNebiusReports(
  reports: PipelineResult["reports"],
  ctx: AgentContext
): PipelineResult["reports"] {
  let { carbonReport, reflectionNotes } = reports;

  if (ctx.nebius?.carbonInsight) {
    carbonReport = [
      carbonReport,
      "",
      `Nebius Carbon Impact Agent (cloud${ctx.nebius.model ? ` — ${ctx.nebius.model}` : ""}):`,
      ctx.nebius.carbonInsight,
    ].join("\n");
  }

  if (ctx.nebius?.reflectionInsight) {
    reflectionNotes = [
      reflectionNotes,
      "",
      `Nebius Reflection Agent (cloud${ctx.nebius.model ? ` — ${ctx.nebius.model}` : ""}):`,
      ctx.nebius.reflectionInsight,
    ].join("\n");
  }

  if (ctx.nebius?.backupSummary && ctx.nebius.jobs.backup === "live") {
    reflectionNotes = [
      reflectionNotes,
      "",
      "Nebius cloud backup confirmation:",
      ctx.nebius.backupSummary,
    ].join("\n");
  }

  return { ...reports, carbonReport, reflectionNotes };
}

export async function runAgentPipeline(
  inventory: InventoryItem[],
  options?: { source?: "demo" | "upload" }
): Promise<PipelineResult & { nebiusBackup: NebiusBackup }> {
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
  const { ctx: reportCtx, reports: baseReports } = await runReportAgent(ctx);

  const backup = await nebiusPipelineBackup(reportCtx, "DGX Spark local orchestration");
  reportCtx.nebius = {
    ...reportCtx.nebius,
    jobs: {
      carbon: reportCtx.nebius?.jobs.carbon ?? "demo",
      reflection: reportCtx.nebius?.jobs.reflection ?? "demo",
      backup: backup.status,
    },
    backupSummary: backup.summary,
    model: backup.model ?? reportCtx.nebius?.model,
  };

  const reports = mergeNebiusReports(baseReports, reportCtx);
  const nebiusBackup = buildNebiusBackup(reportCtx);

  const executionStep = {
    id: `edge-exec-${Date.now()}`,
    agent: AGENT_NAMES.edgeExecution,
    layer: "execution" as const,
    status: "complete" as const,
    message: "Recovery plan delivered on edge — reports and voice ready",
    timestamp: Date.now(),
  };
  reportCtx.timeline.push(executionStep);

  const summary = buildSummary(reportCtx);
  const knowledgeGraph = buildKnowledgeGraph(reportCtx);

  return {
    inventory,
    assetPayloads: reportCtx.assets,
    optimizations: reportCtx.circular,
    timeline: reportCtx.timeline,
    summary,
    reports,
    knowledgeGraph,
    voiceSummary: buildVoiceSummary(reportCtx, options?.source ?? "demo"),
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
    nebiusBackup,
  };
}
