import type { AgentContext } from "@/lib/types";
import { nebiusReflectionAgent } from "@/lib/llm/nebiusAgents";
import { AGENT_NAMES } from "./names";
import { finishStep, createStep, simulateAgentDelay } from "./utils";

export async function runRiskAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    AGENT_NAMES.risk,
    "dgx",
    "Validating decisions and confidence thresholds..."
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
  finishStep(
    ctx.timeline,
    step,
    `Risk review: ${approved}/${ctx.risks.length} asset groups approved`
  );
  return ctx;
}

export async function runReflectionAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    AGENT_NAMES.reflection,
    "synthesis",
    "Reviewing agent consensus and plan quality..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(300);

  const lowConf = ctx.circular.filter((o) => o.confidence < 0.75);
  const reuseCount = ctx.circular.filter((o) =>
    ["reuse", "repair", "donate"].includes(o.action)
  ).length;

  ctx.reflection =
    lowConf.length > 0
      ? `Reflection: ${lowConf.length} groups flagged for secondary review. Overall strategy prioritises circular outcomes with ${reuseCount}/${ctx.circular.length} groups routed away from landfill.`
      : `Reflection: High consensus across agents. ${reuseCount}/${ctx.circular.length} asset groups achieve circular outcomes with strong confidence.`;

  const nebiusReflection = await nebiusReflectionAgent(ctx);
  ctx.nebius = {
    ...ctx.nebius,
    jobs: {
      carbon: ctx.nebius?.jobs.carbon ?? "demo",
      reflection: nebiusReflection.status,
      backup: ctx.nebius?.jobs.backup ?? "demo",
    },
    reflectionInsight: nebiusReflection.insight || ctx.nebius?.reflectionInsight,
    model: nebiusReflection.model ?? ctx.nebius?.model,
  };

  const reflectionMessage =
    nebiusReflection.status === "live"
      ? "Plan review complete — local consensus + Nebius cloud critique"
      : "Plan review complete — recommendations validated";

  finishStep(ctx.timeline, step, reflectionMessage);
  return ctx;
}

export async function runDecisionSynthesizer(
  ctx: AgentContext
): Promise<AgentContext> {
  const step = createStep(
    AGENT_NAMES.synthesizer,
    "synthesis",
    "Aggregating lifecycle, carbon, economic, and matching outputs..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(400);

  finishStep(
    ctx.timeline,
    step,
    "Unified recovery plan synthesised — ready for edge delivery"
  );
  return ctx;
}
