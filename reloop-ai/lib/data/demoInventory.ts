import type { DeviceType, InventoryItem } from "@/lib/types";

export const DEMO_INVENTORY: InventoryItem[] = [
  {
    id: "inv-laptops",
    deviceType: "laptop",
    quantity: 120,
    conditionScore: 0.72,
    estimatedAgeYears: 3.5,
    brand: "Mixed enterprise fleet",
    notes: "Dell Latitude & HP EliteBook, mostly functional",
  },
  {
    id: "inv-monitors",
    deviceType: "monitor",
    quantity: 35,
    conditionScore: 0.68,
    estimatedAgeYears: 4,
    brand: "Dell / LG",
    notes: "1080p office monitors, minor cosmetic wear",
  },
  {
    id: "inv-switches",
    deviceType: "switch",
    quantity: 15,
    conditionScore: 0.81,
    estimatedAgeYears: 2.5,
    brand: "Cisco / Netgear",
    notes: "Managed switches from office refresh",
  },
  {
    id: "inv-servers",
    deviceType: "server",
    quantity: 10,
    conditionScore: 0.55,
    estimatedAgeYears: 6,
    brand: "Dell PowerEdge",
    notes: "Decommissioned rack servers, some RAM upgrades possible",
  },
];

export const DEMO_COMPANY = {
  name: "Canary Wharf Tech Ltd",
  borough: "Tower Hamlets",
  postcode: "E14 5AB",
  employees: 850,
};

const DUMMY_PROFILES: Array<{
  deviceType: DeviceType;
  baseQty: number;
  qtyVariance: number;
  baseCondition: number;
  baseAge: number;
  brand: string;
  notes: string;
}> = [
  {
    deviceType: "laptop",
    baseQty: 120,
    qtyVariance: 25,
    baseCondition: 0.72,
    baseAge: 3.5,
    brand: "Mixed enterprise fleet",
    notes: "Dell Latitude & HP EliteBook, mostly functional",
  },
  {
    deviceType: "monitor",
    baseQty: 35,
    qtyVariance: 10,
    baseCondition: 0.68,
    baseAge: 4,
    brand: "Dell / LG",
    notes: "1080p office monitors, minor cosmetic wear",
  },
  {
    deviceType: "switch",
    baseQty: 15,
    qtyVariance: 5,
    baseCondition: 0.81,
    baseAge: 2.5,
    brand: "Cisco / Netgear",
    notes: "Managed switches from office refresh",
  },
  {
    deviceType: "server",
    baseQty: 10,
    qtyVariance: 4,
    baseCondition: 0.55,
    baseAge: 6,
    brand: "Dell PowerEdge",
    notes: "Decommissioned rack servers, some RAM upgrades possible",
  },
];

function jitter(value: number, range: number, min = 0): number {
  const next = value + (Math.random() * 2 - 1) * range;
  return Math.max(min, Math.round(next * 100) / 100);
}

/** Generate fresh dummy London enterprise inventory for demo runs. */
export function generateDummyInventory(): InventoryItem[] {
  const stamp = Date.now().toString(36);

  return DUMMY_PROFILES.map((profile, index) => ({
    id: `dummy-${profile.deviceType}-${stamp}-${index}`,
    deviceType: profile.deviceType,
    quantity: Math.max(
      1,
      Math.round(jitter(profile.baseQty, profile.qtyVariance, 1))
    ),
    conditionScore: Math.min(0.95, jitter(profile.baseCondition, 0.08, 0.35)),
    estimatedAgeYears: jitter(profile.baseAge, 1.2, 0.5),
    brand: profile.brand,
    notes: profile.notes,
  }));
}

export function summarizeInventory(items: InventoryItem[]): string {
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const groups = items.map((i) => `${i.quantity} ${i.deviceType}s`).join(", ");
  return `${total} devices (${groups})`;
}
