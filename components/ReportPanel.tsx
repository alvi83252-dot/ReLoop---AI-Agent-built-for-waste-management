import type { PipelineResult } from "@/lib/types";

export function ReportPanel({ result }: { result: PipelineResult }) {
  const tabs = [
    { title: "Recovery Plan", content: result.reports.recoveryPlan },
    { title: "Carbon Report", content: result.reports.carbonReport },
    { title: "Economic Report", content: result.reports.economicReport },
    { title: "Reflection", content: result.reports.reflectionNotes },
  ];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {tabs.map((tab) => (
        <div
          key={tab.title}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
        >
          <h3 className="font-semibold text-emerald-400 mb-3">{tab.title}</h3>
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
            {tab.content}
          </pre>
        </div>
      ))}
    </div>
  );
}
