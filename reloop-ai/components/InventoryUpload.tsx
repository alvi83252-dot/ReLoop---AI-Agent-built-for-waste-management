"use client";

import { useRef, useState } from "react";
import { FileUp, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import type { InventoryItem } from "@/lib/types";
import {
  generateDummyInventory,
  summarizeInventory,
} from "@/lib/data/demoInventory";
import { INVENTORY_CSV_TEMPLATE, parseInventoryFile } from "@/lib/inventory/parseUpload";
import { cn } from "@/lib/utils";

export type InventorySource = "demo" | "upload" | null;

interface InventoryUploadProps {
  onInventoryChange: (
    items: InventoryItem[],
    source: "demo" | "upload",
    label: string
  ) => void;
  disabled?: boolean;
}

export function InventoryUpload({
  onInventoryChange,
  disabled,
}: InventoryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeOption, setActiveOption] = useState<InventorySource>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const items = await parseInventoryFile(file);
      const label = `${file.name} · ${summarizeInventory(items)}`;
      setActiveOption("upload");
      setStatusLabel(label);
      onInventoryChange(items, "upload", label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid inventory file");
    }
  }

  function generateDemoData() {
    setError(null);
    const items = generateDummyInventory();
    const label = `Generated dummy data · ${summarizeInventory(items)}`;
    setActiveOption("demo");
    setStatusLabel(label);
    onInventoryChange(items, "demo", label);
  }

  function downloadTemplate() {
    const blob = new Blob([INVENTORY_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reloop-inventory-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-300">Choose inventory source</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Pick one option, then run recovery analysis.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Option 1 — Upload */}
        <label
          className={cn(
            "flex flex-col rounded-lg border border-dashed p-4 cursor-pointer transition-colors",
            activeOption === "upload"
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-zinc-700 bg-zinc-950/50 hover:border-emerald-500/30"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileUp className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Option 1 — Upload file</span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            CSV or JSON with deviceType, quantity, conditionScore, estimatedAgeYears
          </p>
          <span className="text-xs text-zinc-400 inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Click to browse
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>

        {/* Option 2 — Generate dummy data */}
        <button
          type="button"
          onClick={generateDemoData}
          disabled={disabled}
          className={cn(
            "flex flex-col rounded-lg border border-dashed p-4 text-left transition-colors",
            activeOption === "demo"
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-zinc-700 bg-zinc-950/50 hover:border-emerald-500/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Option 2 — Demo data</span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Generate dummy London enterprise inventory (laptops, monitors, switches, servers)
          </p>
          <span className="text-xs text-emerald-400">Generate & use dummy data</span>
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={disabled}
          className="text-xs rounded-lg border border-zinc-700 px-2 py-1 text-zinc-400 hover:text-white"
        >
          Download CSV template
        </button>
      </div>

      {statusLabel && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-emerald-400 font-medium">
              {activeOption === "upload" ? "File loaded" : "Dummy data ready"}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">{statusLabel}</p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-amber-400">{error}</p>}
    </div>
  );
}
