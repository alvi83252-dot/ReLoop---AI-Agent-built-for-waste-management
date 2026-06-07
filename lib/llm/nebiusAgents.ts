import type { AgentContext, PipelineResult, NebiusBackup } from "@/lib/types";
import { summarizeInventory } from "@/lib/data/demoInventory";
import { getNebiusConfig, isNebiusConfigured } from "@/lib/env/nebius";
import { nebiusChatCompletion } from "@/lib/llm/nebius";

export type NebiusJobStatus = "live" | "demo" | "error";

let cachedAutoModel: string | null = null;

/** Pick a chat model from Nebius Token Factory (cached after first resolve). */
export async function resolveNebiusModel(): Promise<string> {
  const { model, apiKey, baseUrl } = getNebiusConfig();
  if (!apiKey) return model;
  if (cachedAutoModel && !/embed|embedding|rerank/i.test(cachedAutoModel)) {
    return cachedAutoModel;
  }
  cachedAutoModel = null;

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return model;

    const data = (await response.json()) as { data?: Array<{ id: string }> };
    const models = data.data ?? [];
    const chatModels = models.filter(
      (m) =>
        /instruct|nemotron|it$/i.test(m.id) &&
        !/embed|embedding|rerank|vision|audio|code-interpreter/i.test(m.id)
    );
    const preferred =
      chatModels.find((m) => /8b-instruct/i.test(m.id))?.id ??
      chatModels.find((m) => /8b.*instruct/i.test(m.id))?.id ??
      chatModels.find((m) => /27b|32b/i.test(m.id))?.id ??
      chatModels.find((m) => /instruct/i.test(m.id))?.id ??
      chatModels[0]?.id ??
      models.find((m) => /instruct/i.test(m.id))?.id ??
      models[0]?.id ??
      model;

    cachedAutoModel = preferred;
    return preferred;
  } catch {
    return model;
  }
}

async function nebiusComplete(
  system: string,
  user: string,
  maxTokens = 450
): Promise<{ status: NebiusJobStatus; text: string; model?: string; error?: string }> {
  if (!isNebiusConfigured()) {
    return { status: "demo", text: "" };
  }

  const model = await resolveNebiusModel();

  try {
    const text = await nebiusChatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { maxTokens, temperature: 0.35 },
      model
    );
    return { status: "live", text, model };
  } catch (error) {
    return {
      status: "error",
      text: "",
      model,
      error: error instanceof Error ? error.message : "Nebius request failed",
    };
  }
}

function buildPortfolioSummary(ctx: AgentContext): string {
  const totalCarbon = ctx.circular.reduce((s, o) => s + o.carbonSavedKg, 0);
  const totalValue = ctx.circular.reduce((s, o) => s + o.valueRecoveredGBP, 0);
  const routes = ctx.inventory
    .slice(0, 10)
    .map((item, i) => {
      const opt = ctx.circular[i];
      return `${item.quantity}× ${item.deviceType} → ${opt?.action ?? "pending"} (${Math.round((opt?.confidence ?? 0) * 100)}% conf)`;
    })
    .join("; ");

  return [
    `Inventory: ${summarizeInventory(ctx.inventory)}`,
    `Local CO₂ estimate: ${totalCarbon.toLocaleString()} kg`,
    `Local recovery value: £${totalValue.toLocaleString()}`,
    `Routes (sample): ${routes}`,
  ].join("\n");
}

/** Job 1 — Carbon Impact Agent cloud reasoning. */
export async function nebiusCarbonImpactAgent(
  ctx: AgentContext
): Promise<{ status: NebiusJobStatus; insight: string; model?: string }> {
  const result = await nebiusComplete(
    "You are the ReLoop Carbon Impact Agent using London IT lifecycle data. " +
      "Estimate CO₂ savings vs landfill/disposal for the asset portfolio. " +
      "Respond in 3–4 bullet points with kg CO₂ totals and per-device-type breakdown.",
    `Analyse carbon impact for this London enterprise IT disposal portfolio:\n\n${buildPortfolioSummary(ctx)}`
  );

  return { status: result.status, insight: result.text, model: result.model };
}

/** Job 2 — Reflection Agent cloud critique of the multi-agent plan. */
export async function nebiusReflectionAgent(
  ctx: AgentContext
): Promise<{ status: NebiusJobStatus; insight: string; model?: string }> {
  const lowConf = ctx.circular.filter((o) => o.confidence < 0.75).length;
  const reuseCount = ctx.circular.filter((o) =>
    ["reuse", "repair", "donate"].includes(o.action)
  ).length;

  const result = await nebiusComplete(
    "You are the ReLoop Reflection Agent. Critique the multi-agent circular economy plan: " +
      "confidence levels, reuse vs recycle routing, and whether totals are credible. " +
      "Be concise — 3–4 bullets, flag risks and improvements.",
    [
      `Local reflection draft: ${ctx.reflection}`,
      `Low-confidence groups: ${lowConf}`,
      `Circular routes (reuse/repair/donate): ${reuseCount}/${ctx.circular.length}`,
      buildPortfolioSummary(ctx),
    ].join("\n\n")
  );

  return { status: result.status, insight: result.text, model: result.model };
}

/** Job 3 — Post-pipeline cloud backup / overflow confirmation. */
export async function nebiusPipelineBackup(
  ctx: AgentContext,
  hardwareNote = "DGX Spark local orchestration"
): Promise<{ status: NebiusJobStatus; summary: string; model?: string }> {
  const totalDevices = ctx.inventory.reduce((s, i) => s + i.quantity, 0);
  const carbon = ctx.circular.reduce((s, o) => s + o.carbonSavedKg, 0);

  const result = await nebiusComplete(
    "You confirm a distributed ReLoop AI pipeline completed. " +
      "Write ONE short paragraph (max 80 words) confirming cloud backup inference ran " +
      "after local DGX orchestration. Mention carbon saved and device count.",
    [
      `Pipeline: ZGX edge → ${hardwareNote} → Nebius cloud backup.`,
      `Devices analysed: ${totalDevices.toLocaleString()}`,
      `Carbon saved (local agents): ${carbon.toLocaleString()} kg`,
      `Agent steps completed: ${ctx.timeline.length}`,
    ].join("\n"),
    180
  );

  if (result.status === "demo") {
    return {
      status: "demo",
      summary:
        "Nebius cloud backup idle — local London datasets and rule-based agents used.",
    };
  }

  if (result.status === "error") {
    return {
      status: "error",
      summary: "Nebius cloud backup unavailable — local pipeline results retained.",
      model: result.model,
    };
  }

  return { status: "live", summary: result.text, model: result.model };
}

/** Run all three Nebius jobs (carbon → reflection → backup). */
export async function runNebiusAgentJobs(
  ctx: AgentContext,
  hardwareNote?: string
): Promise<NebiusBackup> {
  if (!isNebiusConfigured()) {
    return {
      status: "demo",
      summary: "Nebius cloud backup idle — local London datasets and rule-based agents used.",
      jobs: { carbon: "demo", reflection: "demo", backup: "demo" },
    };
  }

  const [carbon, reflection, backup] = await Promise.all([
    nebiusCarbonImpactAgent(ctx),
    nebiusReflectionAgent(ctx),
    nebiusPipelineBackup(ctx, hardwareNote),
  ]);

  const anyLive =
    carbon.status === "live" ||
    reflection.status === "live" ||
    backup.status === "live";

  return {
    status: anyLive ? "live" : backup.status === "error" ? "error" : "demo",
    model: backup.model ?? carbon.model ?? reflection.model,
    summary: backup.summary,
    carbonInsight: carbon.insight || undefined,
    reflectionInsight: reflection.insight || undefined,
    jobs: {
      carbon: carbon.status,
      reflection: reflection.status,
      backup: backup.status,
    },
  };
}

/** Build AgentContext snapshot from a completed pipeline (for DGX Python path). */
export function pipelineToAgentContext(result: PipelineResult): AgentContext {
  return {
    inventory: result.inventory,
    assets: result.assetPayloads,
    lifecycle: [],
    circular: result.optimizations,
    carbon: result.optimizations.map((o, i) => ({
      deviceType: result.inventory[i]?.deviceType,
      carbonSavedKg: o.carbonSavedKg,
    })),
    economic: [],
    matches: [],
    risks: [],
    reflection: result.reports.reflectionNotes.split("\n\n")[0] ?? "",
    timeline: result.timeline,
  };
}

export async function runNebiusForPipelineResult(
  result: PipelineResult,
  hardwareNote?: string
): Promise<{ result: PipelineResult; nebiusBackup: NebiusBackup }> {
  const ctx = pipelineToAgentContext(result);
  const nebiusBackup = await runNebiusAgentJobs(ctx, hardwareNote);

  let reports = { ...result.reports };

  if (nebiusBackup.carbonInsight) {
    reports.carbonReport = [
      reports.carbonReport,
      "",
      `Nebius Carbon Impact Agent (cloud — ${nebiusBackup.model ?? "Token Factory"}):`,
      nebiusBackup.carbonInsight,
    ].join("\n");
  }

  if (nebiusBackup.reflectionInsight) {
    reports.reflectionNotes = [
      reports.reflectionNotes,
      "",
      `Nebius Reflection Agent (cloud — ${nebiusBackup.model ?? "Token Factory"}):`,
      nebiusBackup.reflectionInsight,
    ].join("\n");
  }

  if (nebiusBackup.summary && nebiusBackup.status === "live") {
    reports.reflectionNotes = [
      reports.reflectionNotes,
      "",
      "Nebius cloud backup confirmation:",
      nebiusBackup.summary,
    ].join("\n");
  }

  return {
    result: { ...result, reports },
    nebiusBackup,
  };
}
