const sponsors = [
  {
    name: "NVIDIA",
    role: "CUDA · TensorRT · NIM · DGX Acceleration",
    badge: "GPU AI",
  },
  {
    name: "HP ZGX Nano",
    role: "Edge AI Station — Local-first inference",
    badge: "Edge",
  },
  {
    name: "DGX Spark (Scan)",
    role: "Multi-agent orchestration & simulation",
    badge: "Core",
  },
  {
    name: "Nebius",
    role: "Cloud backup inference & model hosting",
    badge: "Cloud",
  },
  {
    name: "ElevenLabs",
    role: "Voice Operations Agent",
    badge: "Voice",
  },
];

export function SponsorBadges() {
  return (
    <div className="flex flex-wrap gap-3">
      {sponsors.map((s) => (
        <div
          key={s.name}
          className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-green-400">
              {s.badge}
            </span>
            <span className="font-semibold text-white text-sm">{s.name}</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">{s.role}</p>
        </div>
      ))}
    </div>
  );
}

export function EdgeBadge({ active }: { active?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 text-zinc-500"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`}
      />
      {active
        ? "Running on NVIDIA ZGX Nano AI Station"
        : "Edge AI Standby"}
    </div>
  );
}
