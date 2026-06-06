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
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="font-semibold text-white mb-4">
        Knowledge Graph — Assets → Destinations → Outcomes
      </h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {graph.nodes.map((node) => (
          <div
            key={node.id}
            className={`rounded-lg border px-3 py-1.5 text-xs ${typeColors[node.type] ?? "bg-zinc-800"}`}
          >
            {node.label}
          </div>
        ))}
      </div>
      <div className="space-y-1 text-xs text-zinc-500 font-mono">
        {graph.edges.map((edge, i) => (
          <div key={i}>
            {edge.from} —[{edge.label}]→ {edge.to}
          </div>
        ))}
      </div>
    </div>
  );
}
