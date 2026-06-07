import { getLondonContext } from "@/lib/simulation/londonData";

export function LondonDataPanel() {
  const data = getLondonContext();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="font-semibold text-white mb-3">London Open Data Context</h3>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-zinc-500 text-xs">Recycling Rate (avg)</p>
          <p className="text-white font-medium">
            {(data.recyclingRates.boroughAverage * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-zinc-500 text-xs">Commercial E-waste</p>
          <p className="text-white font-medium">
            {data.householdWaste.commercialEwasteTonnes.toLocaleString()} t/yr
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-zinc-500 text-xs">PM2.5 (annual mean)</p>
          <p className="text-white font-medium">
            {data.airQuality.pm25AnnualMeanUgM3} µg/m³
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-zinc-500 text-xs">NO₂ (annual mean)</p>
          <p className="text-white font-medium">
            {data.airQuality.no2AnnualMeanUgM3} µg/m³
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-zinc-500 text-xs">E-waste recovery potential</p>
          <p className="text-white font-medium">
            {(data.recyclingRates.ewasteRecoveryPotential * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-3">
          <p className="text-zinc-500 text-xs">Energy efficiency gain</p>
          <p className="text-white font-medium">
            +{data.energyEfficiency.modernDeviceEfficiencyGainPercent}% modern vs legacy
          </p>
        </div>
      </div>
    </div>
  );
}
