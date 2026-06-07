import type { AgentContext } from "@/lib/types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function buildKnowledgeGraph(ctx: AgentContext) {
  const nodes = new Map<string, { id: string; label: string; type: string }>();
  const edges = new Map<string, { from: string; to: string; label: string }>();

  nodes.set("company", {
    id: "company",
    label: "Canary Wharf Tech Ltd",
    type: "organization",
  });

  const assetTotals = new Map<string, number>();
  ctx.inventory.forEach((item) => {
    assetTotals.set(
      item.deviceType,
      (assetTotals.get(item.deviceType) ?? 0) + item.quantity
    );
  });

  for (const [deviceType, quantity] of assetTotals) {
    const assetId = `asset-${deviceType}`;
    nodes.set(assetId, {
      id: assetId,
      label: `${quantity.toLocaleString()}× ${deviceType}`,
      type: "asset",
    });
    edges.set(`company|${assetId}`, {
      from: "company",
      to: assetId,
      label: "owns",
    });
  }

  const routes = new Map<
    string,
    {
      deviceType: string;
      action: string;
      destination: string;
      quantity: number;
      carbon: number;
      value: number;
    }
  >();

  ctx.inventory.forEach((item, idx) => {
    const opt = ctx.circular[idx];
    if (!opt) return;

    const key = `${item.deviceType}|${opt.action}|${opt.destination}`;
    const route = routes.get(key) ?? {
      deviceType: item.deviceType,
      action: opt.action,
      destination: opt.destination,
      quantity: 0,
      carbon: 0,
      value: 0,
    };

    route.quantity += item.quantity;
    route.carbon += opt.carbonSavedKg;
    route.value += opt.valueRecoveredGBP;
    routes.set(key, route);
  });

  for (const route of routes.values()) {
    const assetId = `asset-${route.deviceType}`;
    const destId = `dest-${slugify(route.destination)}`;
    const outcomeId = `outcome-${slugify(route.destination)}-${route.action}`;

    nodes.set(destId, {
      id: destId,
      label: route.destination,
      type: "destination",
    });

    nodes.set(outcomeId, {
      id: outcomeId,
      label: `${route.carbon.toLocaleString()} kg CO₂ · £${route.value.toLocaleString()}`,
      type: "outcome",
    });

    edges.set(`${assetId}|${destId}|${route.action}`, {
      from: assetId,
      to: destId,
      label: `${route.action} · ${route.quantity.toLocaleString()} units`,
    });

    edges.set(`${destId}|${outcomeId}`, {
      from: destId,
      to: outcomeId,
      label: "achieves",
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  };
}
