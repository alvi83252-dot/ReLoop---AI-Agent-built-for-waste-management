import type { AgentContext } from "@/lib/types";
import { completeStep, createStep, simulateAgentDelay } from "./utils";

export async function runLifecycleAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Lifecycle Agent",
    "dgx",
    "DGX Spark: predicting remaining useful life and repairability..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(500);

  ctx.lifecycle = ctx.inventory.map((item) => {
    const remainingYears = Math.max(
      0.5,
      8 - item.estimatedAgeYears * (1.1 - item.conditionScore * 0.3)
    );
    const repairability = item.deviceType === "server" ? 0.65 : 0.82;
    const reusePotential = Math.min(
      0.95,
      item.conditionScore * 0.7 + repairability * 0.3
    );

    return {
      deviceType: item.deviceType,
      quantity: item.quantity,
      remainingYears: Math.round(remainingYears * 10) / 10,
      repairability: Math.round(repairability * 100) / 100,
      reusePotential: Math.round(reusePotential * 100) / 100,
    };
  });

  ctx.timeline.push(
    completeStep(
      step,
      `Lifecycle analysis: avg ${(
        ctx.lifecycle.reduce(
          (s, l) => s + (l.remainingYears as number),
          0
        ) / ctx.lifecycle.length
      ).toFixed(1)} years remaining useful life`
    )
  );
  return ctx;
}
