import type { InventoryItem } from "@/lib/types";

interface InventoryPreviewProps {
  items: InventoryItem[];
  sourceLabel?: string;
}

export function InventoryPreview({ items, sourceLabel }: InventoryPreviewProps) {
  const totalDevices = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2 bg-zinc-900/50">
        <p className="text-xs font-medium text-zinc-300">
          Loaded inventory · {items.length} row{items.length !== 1 ? "s" : ""} ·{" "}
          {totalDevices.toLocaleString()} devices
        </p>
        {sourceLabel && (
          <p className="text-xs text-zinc-500 truncate max-w-full">{sourceLabel}</p>
        )}
      </div>

      <div className="max-h-64 sm:max-h-72 overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Device</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Condition</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {items.map((item, index) => (
              <tr key={item.id} className="hover:bg-zinc-900/40">
                <td className="px-3 py-2 text-zinc-500">{index + 1}</td>
                <td className="px-3 py-2 text-white capitalize">{item.deviceType}</td>
                <td className="px-3 py-2 text-zinc-300">{item.quantity.toLocaleString()}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {Math.round(item.conditionScore * 100)}%
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {item.estimatedAgeYears}y
                </td>
                <td className="px-3 py-2 text-zinc-400 max-w-[220px] truncate" title={item.notes}>
                  {item.brand ? `${item.brand} · ` : ""}
                  {item.notes ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length > 8 && (
        <p className="text-[11px] text-zinc-600 px-3 py-1.5 border-t border-zinc-800">
          Scroll inside the box to view all {items.length} rows
        </p>
      )}
    </div>
  );
}
