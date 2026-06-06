import type { AgentContext } from "@/lib/types";

export function buildKnowledgeGraph(ctx: AgentContext) {
  const nodes: { id: string; label: string; type: string }[] = [];
  const edges: { from: string; to: string; label: string }[] = [];

  nodes.push({ id: "company", label: "Canary Wharf Tech Ltd", type: "organization" });

  ctx.inventory.forEach((item, idx) => {
    const assetId = `asset-${item.deviceType}`;
    if (!nodes.find((n) => n.id === assetId)) {
      nodes.push({
        id: assetId,
        label: `${item.quantity}× ${item.deviceType}`,
        type: "asset",
      });
      edges.push({ from: "company", to: assetId, label: "owns" });
    }

    const opt = ctx.circular[idx];
    if (opt) {
      const destId = `dest-${idx}`;
      nodes.push({
        id: destId,
        label: opt.destination,
        type: "destination",
      });
      edges.push({
        from: assetId,
        to: destId,
        label: opt.action,
      });

      const outcomeId = `outcome-${idx}`;
      nodes.push({
        id: outcomeId,
        label: `${opt.carbonSavedKg}kg CO₂ · £${opt.valueRecoveredGBP}`,
        type: "outcome",
      });
      edges.push({
        from: destId,
        to: outcomeId,
        label: "achieves",
      });
    }
  });

  return { nodes, edges };
}
