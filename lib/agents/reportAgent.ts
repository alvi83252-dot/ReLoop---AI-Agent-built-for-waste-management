import type { AgentContext, InventoryItem, OptimizationResult, PipelineResult } from "@/lib/types";
import {
  computeCircularScore,
  computeEnvironmentalScore,
  estimateLandfillAvoided,
} from "@/lib/simulation/londonData";
import { AGENT_NAMES } from "./names";
import { finishStep, createStep, simulateAgentDelay } from "./utils";

export async function runReportAgent(
  ctx: AgentContext
): Promise<{ ctx: AgentContext; reports: PipelineResult["reports"] }> {
  const step = createStep(
    AGENT_NAMES.reports,
    "execution",
    "Generating recovery, carbon, and economic reports..."
  );
  ctx.timeline.push(step);
  await simulateAgentDelay(350);

  const totalDevices = ctx.inventory.reduce((s, i) => s + i.quantity, 0);
  const rescued = ctx.circular.filter((o) => o.action !== "recycle").length;
  const carbonSaved = ctx.circular.reduce((s, o) => s + o.carbonSavedKg, 0);
  const valueRecovered = ctx.circular.reduce((s, o) => s + o.valueRecoveredGBP, 0);
  const landfillAvoided = ctx.inventory.reduce(
    (s, i) => s + estimateLandfillAvoided(i),
    0
  );

  const recoveryPlan = buildAggregatedRecoveryPlan(ctx.inventory, ctx.circular);

  const carbonReport = `Total CO₂ savings: ${carbonSaved.toLocaleString()} kg\nLandfill avoided: ${landfillAvoided.toLocaleString()} kg\nLondon PM2.5 impact reduction: estimated ${Math.round(carbonSaved * 0.002)} µg/m³ equivalent\nReuse vs new manufacturing ratio: 78% emissions reduction (London dataset)`;

  const economicReport = `Total recovery value: £${valueRecovered.toLocaleString()}\nAvoided replacement cost: £${Math.round(valueRecovered * 1.4).toLocaleString()}\nAverage per-device recovery: £${Math.round(valueRecovered / totalDevices)}\nNew economic opportunities: refurbishment contracts, donation tax relief, secondary market resale`;

  const reports = {
    recoveryPlan,
    carbonReport,
    economicReport,
    reflectionNotes: ctx.reflection,
  };

  finishStep(ctx.timeline, step, "Reports ready for stakeholder review");
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

function actionVerb(action: string): { verb: string; prep: string } {
  switch (action) {
    case "reuse":
      return { verb: "reuse", prep: "through" };
    case "repair":
      return { verb: "repair", prep: "via" };
    case "resell":
      return { verb: "resell", prep: "via" };
    case "donate":
      return { verb: "donate", prep: "to" };
    default:
      return { verb: "recycle", prep: "through" };
  }
}

export function buildAggregatedRecoveryPlan(
  inventory: InventoryItem[],
  circular: OptimizationResult[]
): string {
  if (inventory.length === 0) {
    return "No recovery routes — load inventory and run analysis first.";
  }

  const groups = new Map<
    string,
    {
      quantity: number;
      deviceType: string;
      action: string;
      destination: string;
      confidenceSum: number;
      rowCount: number;
    }
  >();

  inventory.forEach((item, idx) => {
    const opt = circular[idx];
    if (!opt) return;

    const key = `${item.deviceType}|${opt.action}|${opt.destination}`;
    const existing = groups.get(key) ?? {
      quantity: 0,
      deviceType: item.deviceType,
      action: opt.action,
      destination: opt.destination,
      confidenceSum: 0,
      rowCount: 0,
    };

    existing.quantity += item.quantity;
    existing.confidenceSum += opt.confidence;
    existing.rowCount += 1;
    groups.set(key, existing);
  });

  let lines = Array.from(groups.values())
    .sort((a, b) => b.quantity - a.quantity)
    .map((group) => {
      const confidence = Math.round((group.confidenceSum / group.rowCount) * 100);
      const rowNote =
        group.rowCount > 1 ? ` · ${group.rowCount} source rows merged` : "";
      return `• ${group.quantity.toLocaleString()}× ${group.deviceType}: ${group.action.toUpperCase()} → ${group.destination} (${confidence}% confidence)${rowNote}`;
    });

  if (lines.length > 8) {
    const byRoute = new Map<
      string,
      {
        quantity: number;
        deviceType: string;
        action: string;
        confidenceSum: number;
        rowCount: number;
        destinations: Set<string>;
      }
    >();

    inventory.forEach((item, idx) => {
      const opt = circular[idx];
      if (!opt) return;

      const key = `${item.deviceType}|${opt.action}`;
      const existing = byRoute.get(key) ?? {
        quantity: 0,
        deviceType: item.deviceType,
        action: opt.action,
        confidenceSum: 0,
        rowCount: 0,
        destinations: new Set<string>(),
      };

      existing.quantity += item.quantity;
      existing.confidenceSum += opt.confidence;
      existing.rowCount += 1;
      existing.destinations.add(opt.destination);
      byRoute.set(key, existing);
    });

    lines = Array.from(byRoute.values())
      .sort((a, b) => b.quantity - a.quantity)
      .map((group) => {
        const confidence = Math.round((group.confidenceSum / group.rowCount) * 100);
        const destination =
          group.destinations.size === 1
            ? [...group.destinations][0]
            : `${group.destinations.size} London partners`;
        return `• ${group.quantity.toLocaleString()}× ${group.deviceType}: ${group.action.toUpperCase()} → ${destination} (${confidence}% avg confidence)`;
      });
  }

  const header = `${inventory.length} source row${inventory.length !== 1 ? "s" : ""} → ${lines.length} recovery route${lines.length !== 1 ? "s" : ""}\n\n`;

  return header + lines.join("\n");
}

export function buildVoiceSummaryFromResult(
  inventory: InventoryItem[],
  optimizations: OptimizationResult[],
  source: "demo" | "upload" = "demo"
): string {
  return buildVoiceSummaryCore(inventory, optimizations, source);
}

function buildVoiceSummaryCore(
  inventory: InventoryItem[],
  circular: OptimizationResult[],
  source: "demo" | "upload"
): string {
  if (inventory.length === 0) {
    return "No inventory is loaded yet. Upload your file or choose demo data, run recovery analysis, then play the voice summary.";
  }

  const totalDevices = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const carbonSaved = circular.reduce((sum, opt) => sum + opt.carbonSavedKg, 0);
  const totalValue = circular.reduce((sum, opt) => sum + opt.valueRecoveredGBP, 0);
  const rescued = inventory.reduce((sum, item, idx) => {
    const action = circular[idx]?.action;
    return action && action !== "recycle" ? sum + item.quantity : sum;
  }, 0);

  const opening =
    source === "upload"
      ? `ReLoop has analysed your uploaded inventory: ${totalDevices.toLocaleString()} devices across ${inventory.length} asset group${inventory.length === 1 ? "" : "s"}.`
      : `ReLoop has completed analysis on ${totalDevices.toLocaleString()} devices in ${inventory.length} asset group${inventory.length === 1 ? "" : "s"}.`;

  const groups = new Map<
    string,
    { quantity: number; deviceType: string; action: string; destination: string }
  >();

  inventory.forEach((item, idx) => {
    const opt = circular[idx];
    if (!opt) return;
    const key = `${item.deviceType}|${opt.action}|${opt.destination}`;
    const existing = groups.get(key) ?? {
      quantity: 0,
      deviceType: item.deviceType,
      action: opt.action,
      destination: opt.destination,
    };
    existing.quantity += item.quantity;
    groups.set(key, existing);
  });

  const recommendations = Array.from(groups.values())
    .sort((a, b) => b.quantity - a.quantity)
    .map((group) => {
      const { verb, prep } = actionVerb(group.action);
      const label = `${group.quantity.toLocaleString()} ${group.deviceType}${group.quantity === 1 ? "" : "s"}`;

      if (group.action === "donate") {
        return `Donate ${label} ${prep} ${group.destination}.`;
      }
      if (group.action === "recycle") {
        return `Send ${label} for responsible recycling ${prep} ${group.destination}.`;
      }
      return `Recommend ${verb === "resell" ? "reselling" : verb === "reuse" ? "reusing" : verb === "repair" ? "repairing" : "recycling"} ${label} ${prep} ${group.destination}.`;
    });

  const detail = recommendations.slice(0, 5).join(" ");
  const overflow =
    recommendations.length > 5
      ? ` A further ${recommendations.length - 5} recovery routes follow the same circular logic.`
      : "";

  const closing = `Overall, ${rescued.toLocaleString()} devices are kept out of landfill. Expected carbon savings are ${carbonSaved.toLocaleString()} kilograms, with an estimated recovery value of ${totalValue.toLocaleString()} pounds sterling.`;

  return `${opening} ${detail}${overflow} ${closing}`;
}

export function buildVoiceSummary(
  ctx: AgentContext,
  source: "demo" | "upload" = "demo"
): string {
  return buildVoiceSummaryCore(ctx.inventory, ctx.circular, source);
}
