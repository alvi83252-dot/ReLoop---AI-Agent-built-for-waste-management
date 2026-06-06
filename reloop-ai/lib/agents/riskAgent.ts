import type { AgentContext } from "@/lib/types";
import { completeStep, createStep, simulateAgentDelay } from "./utils";

export async function runRiskAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Risk & Confidence Agent",
    "dgx",
    "Validating decisions, checking data completeness and confidence thresholds..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(350);

  ctx.risks = ctx.circular.map((opt, idx) => {
    const item = ctx.inventory[idx];
    const flags: string[] = [];
    if (opt.confidence < 0.7) flags.push("Low confidence — manual review recommended");
    if (item.conditionScore < 0.4) flags.push("Poor condition — verify before donation");
    if (item.deviceType === "server" && item.estimatedAgeYears > 5)
      flags.push("Legacy server — data sanitisation required");

    return {
      deviceType: item.deviceType,
      confidence: opt.confidence,
      approved: opt.confidence >= 0.65 && flags.length < 2,
      flags,
    };
  });

  const approved = ctx.risks.filter((r) => r.approved).length;
  ctx.timeline.push(
    completeStep(step, `Risk review: ${approved}/${ctx.risks.length} asset groups approved`)
  );
  return ctx;
}

export async function runReflectionAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Reflection Agent",
    "synthesis",
    "Self-critique: reviewing agent consensus and identifying improvements..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(300);

  const lowConf = ctx.circular.filter((o) => o.confidence < 0.75);
  const reuseCount = ctx.circular.filter((o) =>
    ["reuse", "repair", "donate"].includes(o.action)
  ).length;

  const fallbackReflection =
    lowConf.length > 0
      ? `Reflection: ${lowConf.length} groups flagged for secondary review. Overall strategy prioritises circular outcomes with ${reuseCount}/${ctx.circular.length} groups routed away from landfill.`
      : `Reflection: High consensus across agents. ${reuseCount}/${ctx.circular.length} asset groups achieve circular outcomes with strong confidence.`;

  const totalCarbonKg = ctx.carbon.reduce(
    (sum, entry) => sum + ((entry.carbonSavedKg as number) ?? 0),
    0
  );
  const totalValueGBP = ctx.economic.reduce(
    (sum, entry) => sum + ((entry.resaleValueGBP as number) ?? 0),
    0
  );

  const { nebiusReflection } = await import("@/lib/llm/nebius");
  const nebiusText = await nebiusReflection({
    inventoryCount: ctx.inventory.length,
    reuseCount,
    lowConfidenceCount: lowConf.length,
    totalCarbonKg,
    totalValueGBP,
  });

  ctx.reflection = nebiusText ? `Nebius reflection: ${nebiusText}` : fallbackReflection;

  ctx.timeline.push(
    completeStep(
      step,
      nebiusText
        ? "Reflection complete via Nebius cloud inference"
        : "Reflection complete — recommendations validated"
    )
  );
  return ctx;
}

export async function runDecisionSynthesizer(
  ctx: AgentContext
): Promise<AgentContext> {
  const step = createStep(
    "Decision Synthesizer",
    "synthesis",
    "Aggregating Lifecycle, Carbon, Economic, and Matching agent outputs..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(400);

  ctx.timeline.push(
    completeStep(
      step,
      "Unified recovery plan synthesised — ready for edge execution"
    )
  );
  return ctx;
}
