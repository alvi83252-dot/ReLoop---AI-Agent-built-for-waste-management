"use client";

import { useEffect, useState } from "react";
import { Cpu, Cloud } from "lucide-react";

interface HardwareStatus {
  zgx: { online: boolean; configured: boolean; label: string };
  dgx: { online: boolean; configured: boolean; label: string };
  loop: string;
}

export function HardwareStatusBar() {
  const [status, setStatus] = useState<HardwareStatus | null>(null);

  useEffect(() => {
    fetch("/api/hardware/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
          status.zgx.online
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : status.zgx.configured
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-zinc-700 text-zinc-500"
        }`}
      >
        <Cpu className="h-3 w-3" />
        ZGX {status.zgx.online ? "live" : status.zgx.configured ? "offline" : "local sim"}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
          status.dgx.online
            ? "border-green-500/40 bg-green-500/10 text-green-400"
            : status.dgx.configured
              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
              : "border-zinc-700 text-zinc-500"
        }`}
      >
        <Cloud className="h-3 w-3" />
        DGX {status.dgx.online ? "live" : status.dgx.configured ? "offline" : "local sim"}
      </span>
      <span className="text-zinc-600 self-center">{status.loop}</span>
    </div>
  );
}
