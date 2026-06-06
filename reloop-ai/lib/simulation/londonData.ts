import londonData from "@/data/london-datasets.json";
import type { DeviceType, InventoryItem } from "@/lib/types";

const CARBON_FACTORS = londonData.carbonEmissions.itLifecycleEmissionsKgPerDevice as Record<
  DeviceType,
  number
>;

export function getLondonContext() {
  return londonData;
}

export function estimateCarbonForItem(item: InventoryItem): number {
  const base = CARBON_FACTORS[item.deviceType] ?? 200;
  const reuseMultiplier = londonData.carbonEmissions.reuseSavingsMultiplier;
  const conditionBonus = item.conditionScore * 0.15;
  return Math.round(
    item.quantity * base * reuseMultiplier * (0.85 + conditionBonus)
  );
}

export function estimateLandfillAvoided(item: InventoryItem): number {
  const kgPerDevice: Record<DeviceType, number> = {
    laptop: 2.4,
    monitor: 5.8,
    switch: 1.2,
    server: 18,
    tablet: 0.5,
    phone: 0.2,
    networking: 3,
  };
  return Math.round(item.quantity * (kgPerDevice[item.deviceType] ?? 2));
}

export function pickDestination(
  deviceType: DeviceType,
  action: string
): string {
  const dest = londonData.destinations;
  if (action === "donate") {
    return deviceType === "laptop"
      ? dest.schools[0]
      : dest.charities[Math.floor(Math.random() * dest.charities.length)];
  }
  if (action === "reuse" || action === "repair" || action === "resell") {
    return dest.refurbishers[Math.floor(Math.random() * dest.refurbishers.length)];
  }
  return dest.recyclers[Math.floor(Math.random() * dest.recyclers.length)];
}

export function computeEnvironmentalScore(
  carbonSaved: number,
  landfillAvoided: number,
  devicesRescued: number
): number {
  const carbonScore = Math.min(40, (carbonSaved / 500) * 40);
  const landfillScore = Math.min(30, (landfillAvoided / 200) * 30);
  const deviceScore = Math.min(30, (devicesRescued / 180) * 30);
  return Math.round(carbonScore + landfillScore + deviceScore);
}

export function computeCircularScore(
  reuseRatio: number,
  avgConfidence: number
): number {
  return Math.round(reuseRatio * 60 + avgConfidence * 40);
}
