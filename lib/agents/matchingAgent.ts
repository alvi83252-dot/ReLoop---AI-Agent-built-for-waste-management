import type { AgentContext } from "@/lib/types";
import { getLondonContext } from "@/lib/simulation/londonData";
import { completeStep, createStep, simulateAgentDelay } from "./utils";

export async function runMatchingAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    "Matching Agent",
    "dgx",
    "Matching assets to London refurbishers, schools, charities, and recyclers..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(450);

  const london = getLondonContext();

  ctx.matches = ctx.inventory.map((item, idx) => {
    const opt = ctx.circular[idx];
    return {
      deviceType: item.deviceType,
      quantity: item.quantity,
      destination: opt?.destination ?? london.destinations.refurbishers[0],
      action: opt?.action ?? "recycle",
      matchScore: Math.round((opt?.confidence ?? 0.7) * 100),
      borough: "Greater London",
    };
  });

  ctx.timeline.push(
    completeStep(step, `${ctx.matches.length} destination matches found across London network`)
  );
  return ctx;
}
