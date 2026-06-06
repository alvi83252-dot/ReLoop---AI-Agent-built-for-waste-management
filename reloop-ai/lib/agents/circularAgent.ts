import type { AgentContext, RecoveryAction } from "@/lib/types";
import { OptimizationResultSchema } from "@/lib/types";
import { pickDestination } from "@/lib/simulation/londonData";
import { completeStep, createStep, simulateAgentDelay } from "./utils";

function decideAction(
  conditionScore: number,
  reusePotential: number,
  deviceType: string
): RecoveryAction {
  if (reusePotential > 0.75 && conditionScore > 0.7) return "reuse";
  if (conditionScore > 0.55 && reusePotential > 0.5) return "repair";
  if (conditionScore > 0.45) return "resell";
  if (deviceType === "laptop" && conditionScore > 0.35) return "donate";
  return "recycle";
}

export async function runCircularAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Circular Economy Agent",
    "dgx",
    "Optimising highest-value circular outcomes across asset portfolio..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(450);

  ctx.circular = ctx.inventory.map((item, idx) => {
    const lifecycle = ctx.lifecycle[idx] as {
      reusePotential: number;
    };
    const action = decideAction(
      item.conditionScore,
      lifecycle?.reusePotential ?? 0.5,
      item.deviceType
    );
    const confidence = Math.min(
      0.97,
      0.65 + item.conditionScore * 0.25 + (lifecycle?.reusePotential ?? 0) * 0.1
    );

    return OptimizationResultSchema.parse({
      action,
      confidence: Math.round(confidence * 100) / 100,
      carbonSavedKg: 0,
      valueRecoveredGBP: 0,
      destination: pickDestination(item.deviceType, action),
      reasoning: `${action} maximises circular value for ${item.quantity} ${item.deviceType}s`,
    });
  });

  ctx.timeline.push(
    completeStep(step, "Circular routing decisions computed for all asset groups")
  );
  return ctx;
}

export async function runCarbonAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Carbon Impact Agent",
    "dgx",
    "Simulating carbon savings using London emissions datasets..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(400);

  const { estimateCarbonForItem } = await import("@/lib/simulation/londonData");

  ctx.carbon = ctx.inventory.map((item, idx) => {
    const saved = estimateCarbonForItem(item);
    const opt = ctx.circular[idx];
    if (opt) opt.carbonSavedKg = saved;
    return {
      deviceType: item.deviceType,
      quantity: item.quantity,
      carbonSavedKg: saved,
      landfillAvoidedKg: Math.round(saved * 0.04),
    };
  });

  const totalCarbon = ctx.carbon.reduce(
    (s, c) => s + (c.carbonSavedKg as number),
    0
  );
  ctx.timeline.push(
    completeStep(step, `Carbon forecast: ${totalCarbon.toLocaleString()} kg CO₂ saved vs disposal`)
  );
  return ctx;
}

export async function runEconomicAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Economic Agent",
    "dgx",
    "Calculating recovery value and avoided replacement costs..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(400);

  const valueMap: Record<string, number> = {
    laptop: 95,
    monitor: 45,
    switch: 120,
    server: 380,
    tablet: 60,
    phone: 40,
    networking: 80,
  };

  ctx.economic = ctx.inventory.map((item, idx) => {
    const unitValue = (valueMap[item.deviceType] ?? 50) * item.conditionScore;
    const recovered = Math.round(item.quantity * unitValue);
    const opt = ctx.circular[idx];
    if (opt) opt.valueRecoveredGBP = recovered;
    return {
      deviceType: item.deviceType,
      quantity: item.quantity,
      resaleValueGBP: recovered,
      avoidedReplacementCostGBP: Math.round(recovered * 1.4),
    };
  });

  const totalValue = ctx.economic.reduce(
    (s, e) => s + (e.resaleValueGBP as number),
    0
  );
  ctx.timeline.push(
    completeStep(step, `Economic recovery: £${totalValue.toLocaleString()} potential value`)
  );
  return ctx;
}
