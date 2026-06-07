"use client";

import { useRef, useState } from "react";
import { FileUp, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import type { InventoryItem } from "@/lib/types";
import {
  generateDummyInventory,
  summarizeInventory,
} from "@/lib/data/demoInventory";
import {
  INVENTORY_CSV_TEMPLATE,
  LONDON_RECYCLING_CSV_TEMPLATE,
  parseInventoryFile,
} from "@/lib/inventory/parseUpload";
import { InventoryPreview } from "@/components/InventoryPreview";
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
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [loadedItems, setLoadedItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const items = await parseInventoryFile(file);
      const summary = summarizeInventory(items);
      const label = `${file.name} · ${summary}`;
      setActiveOption("upload");
      setStatusLabel(`${file.name} · ${summary}`);
      setLoadedFileName(file.name);
      setLoadedItems(items);
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
    setLoadedFileName(null);
    setLoadedItems(items);
    onInventoryChange(items, "demo", label);
  }

  function downloadTemplate(kind: "inventory" | "london") {
    const content =
      kind === "london" ? LONDON_RECYCLING_CSV_TEMPLATE : INVENTORY_CSV_TEMPLATE;
    const filename =
      kind === "london"
        ? "reloop-london-recycling-template.csv"
        : "reloop-inventory-template.csv";
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 sm:p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-300">Choose inventory source</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Upload IT inventory or London recycling CSV/JSON — column names are auto-detected.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        {/* Option 1 — Upload */}
        <label
          className={cn(
            "flex flex-col self-start rounded-lg border border-dashed p-3 sm:p-4 cursor-pointer transition-colors w-full",
            activeOption === "upload"
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-zinc-700 bg-zinc-950/50 hover:border-emerald-500/30"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <FileUp className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Option 1 — Upload file</span>
          </div>
          <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
            CSV, TSV, TXT, or JSON — including London borough recycling data (material,
            tonnes, recycling_rate)
          </p>
          <span className="text-xs text-zinc-400 inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Click to browse
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,application/json"
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
            "flex flex-col self-start rounded-lg border border-dashed p-3 sm:p-4 text-left transition-colors w-full",
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

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={() => downloadTemplate("london")}
          disabled={disabled}
          className="text-xs rounded-lg border border-zinc-700 px-2.5 py-1.5 text-zinc-400 hover:text-white w-full sm:w-auto"
        >
          London recycling template
        </button>
        <button
          type="button"
          onClick={() => downloadTemplate("inventory")}
          disabled={disabled}
          className="text-xs rounded-lg border border-zinc-700 px-2.5 py-1.5 text-zinc-400 hover:text-white w-full sm:w-auto"
        >
          IT inventory template
        </button>
      </div>

      {statusLabel && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-emerald-400 font-medium">
              {activeOption === "upload" ? "File loaded" : "Dummy data ready"}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 break-words">{statusLabel}</p>
          </div>
        </div>
      )}

      {loadedItems.length > 0 && (
        <InventoryPreview
          items={loadedItems}
          sourceLabel={loadedFileName ?? "Demo inventory"}
        />
      )}

      {error && <p className="text-xs text-amber-400">{error}</p>}
    </div>
  );
}
