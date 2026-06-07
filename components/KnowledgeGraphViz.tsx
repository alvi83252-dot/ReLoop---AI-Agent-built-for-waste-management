import type { PipelineResult } from "@/lib/types";

const typeColors: Record<string, string> = {
  organization: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  asset: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
  destination: "bg-amber-500/20 border-amber-500/40 text-amber-300",
  outcome: "bg-purple-500/20 border-purple-500/40 text-purple-300",
};

export function KnowledgeGraphViz({
  graph,
}: {
  graph: PipelineResult["knowledgeGraph"];
}) {
  const labelFor = (id: string) =>
    graph.nodes.find((node) => node.id === id)?.label ?? id;

  const assetNodes = graph.nodes.filter((n) => n.type === "asset");
  const destNodes = graph.nodes.filter((n) => n.type === "destination");
  const outcomeNodes = graph.nodes.filter((n) => n.type === "outcome");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="font-semibold text-white">
          Knowledge Graph — Assets → Destinations → Outcomes
        </h3>
        <p className="text-xs text-zinc-500">
          {graph.nodes.length} nodes · {graph.edges.length} routes
        </p>
      </div>

      <div className="space-y-3 mb-4">
        {assetNodes.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1.5">
              Assets
            </p>
            <div className="flex flex-wrap gap-2">
              {graph.nodes
                .filter((n) => n.type === "organization" || n.type === "asset")
                .map((node) => (
                  <div
                    key={node.id}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${typeColors[node.type] ?? "bg-zinc-800"}`}
                  >
                    {node.label}
                  </div>
                ))}
            </div>
          </div>
        )}

        {destNodes.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1.5">
              Destinations ({destNodes.length})
            </p>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
              {destNodes.map((node) => (
                <div
                  key={node.id}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${typeColors.destination}`}
                >
                  {node.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {outcomeNodes.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1.5">
              Outcomes ({outcomeNodes.length})
            </p>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
              {outcomeNodes.map((node) => (
                <div
                  key={node.id}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${typeColors.outcome}`}
                >
                  {node.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-2">
          Routes
        </p>
        <div className="space-y-1.5 text-xs text-zinc-400 max-h-40 overflow-y-auto pr-1">
          {graph.edges.map((edge, i) => (
            <div key={`${edge.from}-${edge.to}-${i}`} className="leading-relaxed">
              <span className="text-zinc-300">{labelFor(edge.from)}</span>
              <span className="text-zinc-600"> —[{edge.label}]→ </span>
              <span className="text-zinc-300">{labelFor(edge.to)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
