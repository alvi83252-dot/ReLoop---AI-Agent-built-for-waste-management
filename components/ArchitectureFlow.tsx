"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

const stages = [
  { label: "Edge Intake (ZGX)", layer: "edge" },
  { label: "DGX Orchestrator", layer: "dgx" },
  { label: "Lifecycle", layer: "agent" },
  { label: "Carbon Analysis", layer: "agent" },
  { label: "Economic Value", layer: "agent" },
  { label: "Partner Matching", layer: "agent" },
  { label: "Decision Engine", layer: "synthesis" },
  { label: "Edge Delivery", layer: "edge" },
  { label: "Reports + Voice", layer: "output" },
];

export function ArchitectureFlow({ activeStep = -1 }: { activeStep?: number }) {
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex flex-col items-center w-full">
          <motion.div
            animate={{
              borderColor:
                i <= activeStep ? "rgb(118, 185, 0)" : "rgb(63, 63, 70)",
              backgroundColor:
                i <= activeStep ? "rgba(118, 185, 0, 0.1)" : "rgba(24, 24, 27, 0.6)",
            }}
            className="w-full max-w-md rounded-lg border-2 px-4 py-2 text-center text-sm text-zinc-200"
          >
            {stage.label}
          </motion.div>
          {i < stages.length - 1 && (
            <ArrowDown className="h-4 w-4 text-zinc-600 my-1" />
          )}
        </div>
      ))}
    </div>
  );
}
