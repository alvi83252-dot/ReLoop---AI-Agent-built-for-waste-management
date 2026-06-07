"use client";

import type { InventoryItem, PipelineResult } from "@/lib/types";

interface ChartRow {
  label: string;
  carbonSavedKg: number;
  rows: number;
}

function aggregateCarbonRows(
  inventory: InventoryItem[],
  optimizations: PipelineResult["optimizations"]
): ChartRow[] {
  const byDevice = new Map<
    string,
    { carbon: number; rows: number; actions: Map<string, number> }
  >();

  inventory.forEach((item, index) => {
    const opt = optimizations[index];
    if (!opt) return;

    const existing = byDevice.get(item.deviceType) ?? {
      carbon: 0,
      rows: 0,
      actions: new Map<string, number>(),
    };

    existing.carbon += opt.carbonSavedKg;
    existing.rows += 1;
    existing.actions.set(opt.action, (existing.actions.get(opt.action) ?? 0) + 1);
    byDevice.set(item.deviceType, existing);
  });

  const rows: ChartRow[] = Array.from(byDevice.entries()).map(([deviceType, data]) => {
    const topAction = [...data.actions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const actionLabel =
      data.actions.size === 1 && topAction
        ? topAction
        : `${data.actions.size} routes`;

    return {
      label: `${deviceType} · ${actionLabel}`,
      carbonSavedKg: data.carbon,
      rows: data.rows,
    };
  });

  rows.sort((a, b) => b.carbonSavedKg - a.carbonSavedKg);

  if (rows.length <= 8) return rows;

  const top = rows.slice(0, 6);
  const rest = rows.slice(6);
  top.push({
    label: `Other · ${rest.length} groups`,
    carbonSavedKg: rest.reduce((sum, row) => sum + row.carbonSavedKg, 0),
    rows: rest.reduce((sum, row) => sum + row.rows, 0),
  });

  return top;
}

export function EnvironmentalChart({
  inventory,
  optimizations,
}: {
  inventory: InventoryItem[];
  optimizations: PipelineResult["optimizations"];
}) {
  const rows = aggregateCarbonRows(inventory, optimizations);
  const totalCarbon = rows.reduce((sum, row) => sum + row.carbonSavedKg, 0);
  const maxCarbon = Math.max(...rows.map((row) => row.carbonSavedKg), 1);
  const sourceRows = inventory.length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="font-semibold text-white">Carbon Savings by Asset Group</h3>
        <p className="text-xs text-zinc-500">
          {sourceRows} row{sourceRows !== 1 ? "s" : ""} → {rows.length} group
          {rows.length !== 1 ? "s" : ""} · {totalCarbon.toLocaleString()} kg CO₂ total
        </p>
      </div>

      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-xs text-zinc-400 mb-1 gap-2">
              <span className="capitalize truncate">{row.label}</span>
              <span className="shrink-0">{row.carbonSavedKg.toLocaleString()} kg CO₂</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-1000"
                style={{ width: `${(row.carbonSavedKg / maxCarbon) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
