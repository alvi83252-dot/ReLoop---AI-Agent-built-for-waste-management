"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Cpu,
  Cloud,
  GitMerge,
  Zap,
} from "lucide-react";
import type { AgentStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const layerIcons = {
  edge: Cpu,
  dgx: Cloud,
  synthesis: GitMerge,
  execution: Zap,
};

const layerColors = {
  edge: "text-emerald-400 border-emerald-500/40",
  dgx: "text-green-400 border-green-500/40",
  synthesis: "text-lime-400 border-lime-500/40",
  execution: "text-teal-400 border-teal-500/40",
};

export function AgentTimeline({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const Icon = layerIcons[step.layer];
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "flex gap-3 rounded-lg border bg-zinc-900/60 p-3",
              layerColors[step.layer]
            )}
          >
            <div className="mt-0.5">
              {step.status === "complete" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : step.status === "running" ? (
                <Loader2 className="h-5 w-5 animate-spin text-green-400" />
              ) : (
                <Circle className="h-5 w-5 text-zinc-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="font-medium text-white text-sm">{step.agent}</span>
                <span className="text-xs uppercase tracking-wider text-zinc-500">
                  {step.layer}
                </span>
                {step.confidence && (
                  <span className="text-xs text-emerald-400">
                    {Math.round(step.confidence * 100)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">{step.message}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
