import type { AgentContext } from "@/lib/types";
import { getLondonContext } from "@/lib/simulation/londonData";
import { AGENT_NAMES } from "./names";
import { finishStep, createStep, simulateAgentDelay } from "./utils";

export async function runMatchingAgent(ctx: AgentContext): Promise<AgentContext> {
  const step = createStep(
    AGENT_NAMES.matching,
    "dgx",
    "Matching assets to London refurbishers, schools, and recyclers..."
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

  finishStep(
    ctx.timeline,
    step,
    `${ctx.matches.length} destination matches found across London`
  );
  return ctx;
}
