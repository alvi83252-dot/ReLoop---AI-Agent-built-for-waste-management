import type { DeviceType, InventoryItem } from "@/lib/types";
import { InventoryItemSchema } from "@/lib/types";

const DEVICE_ALIASES: Record<string, DeviceType> = {
  laptop: "laptop",
  laptops: "laptop",
  notebook: "laptop",
  notebooks: "laptop",
  macbook: "laptop",
  chromebook: "laptop",
  ultrabook: "laptop",
  portable: "laptop",
  monitor: "monitor",
  monitors: "monitor",
  display: "monitor",
  displays: "monitor",
  screen: "monitor",
  screens: "monitor",
  lcd: "monitor",
  led: "monitor",
  television: "monitor",
  tv: "monitor",
  switch: "switch",
  switches: "switch",
  router: "switch",
  routers: "switch",
  hub: "switch",
  server: "server",
  servers: "server",
  rack: "server",
  blade: "server",
  poweredge: "server",
  tablet: "tablet",
  tablets: "tablet",
  ipad: "tablet",
  phone: "phone",
  phones: "phone",
  mobile: "phone",
  smartphone: "phone",
  handset: "phone",
  iphone: "phone",
  android: "phone",
  networking: "networking",
  network: "networking",
  printer: "networking",
  desktop: "networking",
  pc: "networking",
  computer: "networking",
  computers: "networking",
  ict: "networking",
  it: "networking",
  electronics: "networking",
  electronic: "networking",
  ewaste: "networking",
  "e-waste": "networking",
  wee: "networking",
  weee: "networking",
  hardware: "networking",
  equipment: "networking",
  peripheral: "networking",
  appliance: "networking",
  electrical: "networking",
  mixed: "networking",
  other: "networking",
  miscellaneous: "networking",
  unknown: "networking",
};

const DEVICE_COLUMN_KEYS = new Set([
  "devicetype",
  "device",
  "type",
  "assettype",
  "asset",
  "category",
  "material",
  "wastetype",
  "wastestream",
  "stream",
  "item",
  "product",
  "equipment",
  "equipmenttype",
  "description",
  "assetcategory",
  "itemcategory",
  "producttype",
  "classname",
  "class",
]);

const QUANTITY_COLUMN_KEYS = new Set([
  "quantity",
  "qty",
  "count",
  "units",
  "volume",
  "number",
  "amount",
  "items",
  "volume tonnes",
  "tonnes",
  "tonne",
  "tonnage",
  "weight",
  "weightkg",
  "mass",
  "total",
  "num",
]);

const DEVICE_PATTERNS: { type: DeviceType; pattern: RegExp }[] = [
  { type: "laptop", pattern: /\b(laptop|notebook|macbook|chromebook|ultrabook)\b/i },
  { type: "monitor", pattern: /\b(monitor|display|screen|lcd|led panel|television|\btv\b)\b/i },
  { type: "switch", pattern: /\b(network switch|switch|router|\bnas\b)\b/i },
  { type: "server", pattern: /\b(server|rack|blade|data\s*cent|poweredge)\b/i },
  { type: "tablet", pattern: /\b(tablet|ipad|surface pro)\b/i },
  { type: "phone", pattern: /\b(phone|smartphone|mobile handset|iphone|android phone)\b/i },
  {
    type: "networking",
    pattern:
      /\b(network|firewall|access point|printer|desktop|\bpc\b|computer|it equipment|ict|electronics|e-waste|ewaste|weee|wee|hardware|peripheral|toner|keyboard|mouse)\b/i,
  },
];

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/^\uFEFF/, "").replace(/[^a-z0-9]/g, "");
}

function parseNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inferDeviceTypeFromText(text: string): DeviceType | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  const aliasKey = normalized.replace(/[^a-z0-9-]/g, "");
  if (DEVICE_ALIASES[aliasKey]) return DEVICE_ALIASES[aliasKey];

  for (const [alias, type] of Object.entries(DEVICE_ALIASES)) {
    if (normalized.includes(alias)) return type;
  }

  for (const { type, pattern } of DEVICE_PATTERNS) {
    if (pattern.test(text)) return type;
  }

  return null;
}

function resolveDeviceType(raw: Record<string, unknown>): DeviceType {
  for (const [key, value] of Object.entries(raw)) {
    const header = normalizeHeader(key);
    if (!DEVICE_COLUMN_KEYS.has(header) && !header.includes("device") && !header.includes("asset")) {
      continue;
    }
    const inferred = inferDeviceTypeFromText(String(value ?? ""));
    if (inferred) return inferred;
  }

  for (const value of Object.values(raw)) {
    const inferred = inferDeviceTypeFromText(String(value ?? ""));
    if (inferred) return inferred;
  }

  return "networking";
}

function getField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const [key, value] of Object.entries(row)) {
    const header = normalizeHeader(key);
    if (keys.some((k) => header === normalizeHeader(k) || header.includes(normalizeHeader(k)))) {
      return value;
    }
  }
  return undefined;
}

function extractQuantity(row: Record<string, unknown>): number {
  for (const [key, value] of Object.entries(row)) {
    const header = normalizeHeader(key);
    if (
      QUANTITY_COLUMN_KEYS.has(header) ||
      header.includes("quantity") ||
      header.includes("count") ||
      header.includes("units")
    ) {
      const n = parseNumber(value);
      if (n > 0) return Math.max(1, Math.round(n));
    }
  }

  for (const [key, value] of Object.entries(row)) {
    const header = normalizeHeader(key);
    if (header.includes("tonne") || header.includes("tonnage")) {
      const tonnes = parseNumber(value);
      if (tonnes > 0) return Math.max(1, Math.round(tonnes * 1000 / 25));
    }
    if (header.includes("weight") || header.endsWith("kg") || header === "mass") {
      const kg = parseNumber(value);
      if (kg > 0) return Math.max(1, Math.round(kg / 25));
    }
  }

  return 1;
}

function extractConditionScore(row: Record<string, unknown>): number {
  const raw = getField(row, [
    "conditionscore",
    "condition_score",
    "condition",
    "quality",
    "recyclingrate",
    "recycling_rate",
    "rate",
    "recoveryrate",
    "recovery_rate",
  ]);
  const value = parseNumber(raw);
  if (value <= 0) return 0.65;
  if (value > 1 && value <= 100) return Math.min(1, value / 100);
  return Math.min(1, Math.max(0, value));
}

function extractAge(row: Record<string, unknown>): number {
  const raw = getField(row, [
    "estimatedageyears",
    "estimated_age_years",
    "ageyears",
    "age",
    "years",
    "lifecycle",
  ]);
  const value = parseNumber(raw);
  return value > 0 ? value : 3;
}

function buildNotes(row: Record<string, unknown>): string | undefined {
  const borough = getField(row, ["borough", "area", "localauthority", "lad"]);
  const material = getField(row, ["material", "wastetype", "waste_type", "stream", "category"]);
  const year = getField(row, ["year", "financialyear", "fy"]);
  const extra = getField(row, ["notes", "comment", "description"]);

  const parts = [
    borough ? `Borough: ${borough}` : null,
    material ? `Material: ${material}` : null,
    year ? `Year: ${year}` : null,
    extra ? String(extra) : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function toInventoryItem(raw: Record<string, unknown>, index: number): InventoryItem {
  const deviceType = resolveDeviceType(raw);
  const quantity = extractQuantity(raw);
  const conditionScore = extractConditionScore(raw);
  const estimatedAgeYears = extractAge(raw);
  const brand = getField(raw, ["brand", "make", "manufacturer", "vendor"]);
  const notes = buildNotes(raw);

  return InventoryItemSchema.parse({
    id: String(getField(raw, ["id", "assetid", "asset_id", "sku"]) ?? `upload-${index}`),
    deviceType,
    quantity,
    conditionScore,
    estimatedAgeYears,
    brand: brand ? String(brand) : undefined,
    notes,
  });
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const delimiters = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;

  for (const delimiter of delimiters) {
    const count = parseDelimitedLine(headerLine, delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }

  return bestCount > 1 ? best : ",";
}

function rowFromHeaders(headers: string[], values: string[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  headers.forEach((header, idx) => {
    row[header] = values[idx] ?? "";
  });
  return row;
}

function isLondonRecyclingDataset(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeader);
  const hasLocation = normalized.some(
    (h) => h.includes("borough") || h === "area" || h.includes("localauthority") || h === "lad"
  );
  const hasWasteMetric = normalized.some(
    (h) =>
      h.includes("recycl") ||
      h.includes("waste") ||
      h.includes("tonne") ||
      h.includes("ewaste") ||
      h.includes("material") ||
      h.includes("stream")
  );
  const hasExplicitDevice = normalized.some(
    (h) => DEVICE_COLUMN_KEYS.has(h) || h.includes("devicetype") || h.includes("assettype")
  );

  return hasLocation && hasWasteMetric && !hasExplicitDevice;
}

export function parseInventoryCsv(text: string): InventoryItem[] {
  const cleaned = stripBom(text);
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map((h) =>
    h.replace(/^"|"$/g, "").trim()
  );
  const londonMode = isLondonRecyclingDataset(headers);
  const items: InventoryItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseDelimitedLine(lines[i], delimiter).map((v) => v.replace(/^"|"$/g, "").trim());
    if (values.every((v) => !v)) continue;

    const row = rowFromHeaders(headers, values);
    items.push(toInventoryItem(row, items.length));

    if (londonMode && items.length >= 500) break;
  }

  if (items.length === 0) {
    throw new Error("No valid inventory rows found in file");
  }

  return items;
}

function extractJsonRows(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    for (const key of ["inventory", "items", "data", "records", "results", "rows", "assets"]) {
      const candidate = obj[key];
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate as Record<string, unknown>[];
      }
    }
  }

  throw new Error(
    "JSON must be an array of rows or an object with inventory/items/data/records"
  );
}

export function parseInventoryJson(text: string): InventoryItem[] {
  const parsed = JSON.parse(stripBom(text)) as unknown;
  const rows = extractJsonRows(parsed);

  const items = rows
    .filter((row) => row && typeof row === "object")
    .map((row, i) => toInventoryItem(row as Record<string, unknown>, i));

  if (items.length === 0) {
    throw new Error("JSON file contains no inventory rows");
  }

  return items;
}

function detectFormat(text: string, fileName: string): "json" | "csv" {
  const trimmed = stripBom(text).trim();
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) return "csv";

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  return "csv";
}

export function parseInventoryText(text: string, fileName = "upload.csv"): InventoryItem[] {
  const format = detectFormat(text, fileName);
  return format === "json" ? parseInventoryJson(text) : parseInventoryCsv(text);
}

export function parseInventoryFile(file: File): Promise<InventoryItem[]> {
  return new Promise((resolve, reject) => {
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      reject(
        new Error(
          "Excel files are not read directly. Open in Excel/Sheets and export as CSV, then upload again."
        )
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer.slice(0, 4));
        if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
          reject(
            new Error(
              "This looks like an Excel/ZIP file. Save as CSV (.csv) and upload again."
            )
          );
          return;
        }

        const text = new TextDecoder("utf-8").decode(buffer);
        resolve(parseInventoryText(text, file.name));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to parse inventory file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export const INVENTORY_CSV_TEMPLATE = `deviceType,quantity,conditionScore,estimatedAgeYears,brand,notes
laptop,120,0.72,3.5,Mixed fleet,Functional enterprise laptops
monitor,35,0.68,4,Dell/LG,Office monitors
switch,15,0.81,2.5,Cisco,Managed switches
server,10,0.55,6,Dell PowerEdge,Decommissioned rack servers`;

export const LONDON_RECYCLING_CSV_TEMPLATE = `borough,material,tonnes,recycling_rate,year
Westminster,IT laptops,12.4,0.62,2024
Camden,Monitors and displays,4.1,0.58,2024
Southwark,Network switches,1.2,0.71,2024
Hackney,Server equipment,2.8,0.45,2024`;
