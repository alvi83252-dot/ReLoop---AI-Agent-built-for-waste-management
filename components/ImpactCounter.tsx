"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Leaf, PoundSterling, Recycle, TrendingUp } from "lucide-react";
import type { PipelineResult } from "@/lib/types";

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export function ImpactCounter({ summary }: { summary: PipelineResult["summary"] }) {
  const cards = [
    {
      label: "CO₂ Saved",
      value: summary.carbonSavedKg,
      suffix: " kg",
      icon: Leaf,
      color: "from-emerald-600/20 to-emerald-900/10",
    },
    {
      label: "Value Recovered",
      value: summary.valueRecoveredGBP,
      prefix: "£",
      icon: PoundSterling,
      color: "from-green-600/20 to-green-900/10",
    },
    {
      label: "Devices Rescued",
      value: summary.devicesRescued,
      icon: Recycle,
      color: "from-lime-600/20 to-lime-900/10",
    },
    {
      label: "Circular Score",
      value: summary.circularEconomyScore,
      suffix: "/100",
      icon: TrendingUp,
      color: "from-teal-600/20 to-teal-900/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`rounded-xl border border-zinc-800 bg-gradient-to-br ${card.color} p-4`}
        >
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
            <card.icon className="h-4 w-4" />
            {card.label}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white break-words">
            <AnimatedNumber
              value={card.value}
              prefix={card.prefix}
              suffix={card.suffix}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
