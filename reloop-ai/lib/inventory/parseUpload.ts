import type { DeviceType, InventoryItem } from "@/lib/types";
import { InventoryItemSchema } from "@/lib/types";

const DEVICE_ALIASES: Record<string, DeviceType> = {
  laptop: "laptop",
  laptops: "laptop",
  monitor: "monitor",
  monitors: "monitor",
  switch: "switch",
  switches: "switch",
  server: "server",
  servers: "server",
  tablet: "tablet",
  tablets: "tablet",
  phone: "phone",
  phones: "phone",
  networking: "networking",
};

function normalizeDeviceType(raw: string): DeviceType {
  const key = raw.trim().toLowerCase();
  const mapped = DEVICE_ALIASES[key];
  if (!mapped) {
    throw new Error(`Unknown device type: ${raw}`);
  }
  return mapped;
}

function toInventoryItem(raw: Record<string, unknown>, index: number): InventoryItem {
  const deviceRaw =
    raw.deviceType ?? raw.device_type ?? raw.type ?? raw.device ?? "";
  const quantity = Number(raw.quantity ?? raw.qty ?? raw.count ?? 1);
  const condition = Number(
    raw.conditionScore ?? raw.condition_score ?? raw.condition ?? 0.7
  );
  const age = Number(
    raw.estimatedAgeYears ?? raw.estimated_age_years ?? raw.age ?? raw.ageYears ?? 3
  );

  return InventoryItemSchema.parse({
    id: String(raw.id ?? `upload-${index}`),
    deviceType: normalizeDeviceType(String(deviceRaw)),
    quantity,
    conditionScore: condition > 1 ? condition / 100 : condition,
    estimatedAgeYears: age,
    brand: raw.brand ? String(raw.brand) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
  });
}

export function parseInventoryJson(text: string): InventoryItem[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed) ? parsed : (parsed as { inventory?: unknown[] }).inventory;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("JSON must be an array of inventory items or { inventory: [...] }");
  }

  return rows.map((row, i) => toInventoryItem(row as Record<string, unknown>, i));
}

export function parseInventoryCsv(text: string): InventoryItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const items: InventoryItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    items.push(toInventoryItem(row, i - 1));
  }

  return items;
}

export function parseInventoryFile(file: File): Promise<InventoryItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const name = file.name.toLowerCase();
        if (name.endsWith(".csv")) {
          resolve(parseInventoryCsv(text));
        } else if (name.endsWith(".json")) {
          resolve(parseInventoryJson(text));
        } else {
          // try JSON first, then CSV
          try {
            resolve(parseInventoryJson(text));
          } catch {
            resolve(parseInventoryCsv(text));
          }
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export const INVENTORY_CSV_TEMPLATE = `deviceType,quantity,conditionScore,estimatedAgeYears,brand,notes
laptop,120,0.72,3.5,Mixed fleet,Functional enterprise laptops
monitor,35,0.68,4,Dell/LG,Office monitors
switch,15,0.81,2.5,Cisco,Managed switches
server,10,0.55,6,Dell PowerEdge,Decommissioned rack servers`;
