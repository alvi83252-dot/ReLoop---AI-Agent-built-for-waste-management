"use client";

import type { PipelineResult } from "@/lib/types";

export function EnvironmentalChart({
  optimizations,
}: {
  optimizations: PipelineResult["optimizations"];
}) {
  const maxCarbon = Math.max(...optimizations.map((o) => o.carbonSavedKg), 1);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="font-semibold text-white mb-4">Carbon Savings by Asset Group</h3>
      <div className="space-y-3">
        {optimizations.map((opt, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span className="capitalize">{opt.action}</span>
              <span>{opt.carbonSavedKg.toLocaleString()} kg CO₂</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-1000"
                style={{ width: `${(opt.carbonSavedKg / maxCarbon) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
