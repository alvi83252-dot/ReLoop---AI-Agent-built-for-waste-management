import type { InventoryItem } from "@/lib/types";

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
