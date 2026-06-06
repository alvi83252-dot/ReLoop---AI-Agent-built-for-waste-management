import type { AgentContext, PipelineResult } from "@/lib/types";
import {
  computeCircularScore,
  computeEnvironmentalScore,
  estimateLandfillAvoided,
} from "@/lib/simulation/londonData";
import { completeStep, createStep, simulateAgentDelay } from "./utils";

export async function runReportAgent(
  ctx: AgentContext
): Promise<{ ctx: AgentContext; reports: PipelineResult["reports"] }> {
  const step = createStep(
    "Report Generation Agent",
    "execution",
    "Generating recovery, carbon, and economic reports on ZGX Nano..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(350);

  const totalDevices = ctx.inventory.reduce((s, i) => s + i.quantity, 0);
  const carbonSaved = ctx.circular.reduce((s, o) => s + o.carbonSavedKg, 0);
  const valueRecovered = ctx.circular.reduce((s, o) => s + o.valueRecoveredGBP, 0);
  const landfillAvoided = ctx.inventory.reduce(
    (s, i) => s + estimateLandfillAvoided(i),
    0
  );

  const recoveryPlan = ctx.inventory
    .map((item, idx) => {
      const opt = ctx.circular[idx];
      return `• ${item.quantity}× ${item.deviceType}: ${opt.action.toUpperCase()} → ${opt.destination} (${Math.round(opt.confidence * 100)}% confidence)`;
    })
    .join("\n");

  const carbonReport = `Total CO₂ savings: ${carbonSaved.toLocaleString()} kg\nLandfill avoided: ${landfillAvoided.toLocaleString()} kg\nLondon PM2.5 impact reduction: estimated ${Math.round(carbonSaved * 0.002)} µg/m³ equivalent\nReuse vs new manufacturing ratio: 78% emissions reduction (London dataset)`;

  const economicReport = `Total recovery value: £${valueRecovered.toLocaleString()}\nAvoided replacement cost: £${Math.round(valueRecovered * 1.4).toLocaleString()}\nAverage per-device recovery: £${Math.round(valueRecovered / totalDevices)}\nNew economic opportunities: refurbishment contracts, donation tax relief, secondary market resale`;

  const reports = {
    recoveryPlan,
    carbonReport,
    economicReport,
    reflectionNotes: ctx.reflection,
  };

  ctx.timeline.push(
    completeStep(step, "Reports generated — recovery plan ready for stakeholder review")
  );
  return { ctx, reports };
}

export function buildSummary(ctx: AgentContext): PipelineResult["summary"] {
  const totalDevices = ctx.inventory.reduce((s, i) => s + i.quantity, 0);
  const devicesRescued = ctx.inventory
    .filter((_, idx) => ctx.circular[idx]?.action !== "recycle")
    .reduce((s, i) => s + i.quantity, 0);
  const carbonSaved = ctx.circular.reduce((s, o) => s + o.carbonSavedKg, 0);
  const valueRecovered = ctx.circular.reduce((s, o) => s + o.valueRecoveredGBP, 0);
  const landfillAvoided = ctx.inventory.reduce(
    (s, i) => s + estimateLandfillAvoided(i),
    0
  );
  const reuseRatio = devicesRescued / totalDevices;
  const avgConfidence =
    ctx.circular.reduce((s, o) => s + o.confidence, 0) / ctx.circular.length;

  return {
    totalDevices,
    devicesRescued,
    carbonSavedKg: carbonSaved,
    valueRecoveredGBP: valueRecovered,
    landfillAvoidedKg: landfillAvoided,
    circularEconomyScore: computeCircularScore(reuseRatio, avgConfidence),
    environmentalScore: computeEnvironmentalScore(
      carbonSaved,
      landfillAvoided,
      devicesRescued
    ),
  };
}

export function buildVoiceSummary(ctx: AgentContext): string {
  const laptops = ctx.inventory.find((i) => i.deviceType === "laptop");
  const laptopOpt = ctx.circular[ctx.inventory.findIndex((i) => i.deviceType === "laptop")];
  const totalValue = ctx.circular.reduce((s, o) => s + o.valueRecoveredGBP, 0);
  const refurbCount = ctx.circular.filter((o) =>
    ["reuse", "repair"].includes(o.action)
  ).reduce((s, _, idx) => s + ctx.inventory[idx].quantity, 0);

  if (laptops && laptopOpt) {
    const laptopRefurb = Math.round(laptops.quantity * laptopOpt.confidence * 0.85);
    return `${laptopRefurb} laptops should be refurbished. ${refurbCount} total devices routed to circular pathways. Estimated recovery value £${totalValue.toLocaleString()}. Carbon savings ${ctx.circular.reduce((s, o) => s + o.carbonSavedKg, 0).toLocaleString()} kilograms.`;
  }
  return `Analysis complete. ${refurbCount} devices should enter circular pathways. Estimated recovery value £${totalValue.toLocaleString()}.`;
}
