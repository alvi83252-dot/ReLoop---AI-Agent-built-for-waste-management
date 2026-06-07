"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { ReLoopLogo } from "@/components/ReLoopLogo";
import { AgentTimeline } from "@/components/AgentTimeline";
import { ImpactCounter } from "@/components/ImpactCounter";
import { ArchitectureFlow } from "@/components/ArchitectureFlow";
import { ReportPanel } from "@/components/ReportPanel";
import { SponsorBadges, EdgeBadge } from "@/components/SponsorBadges";
import { EnvironmentalChart } from "@/components/EnvironmentalChart";
import { VoiceAgent } from "@/components/VoiceAgent";
import { VoiceSessionMemory } from "@/components/VoiceSessionMemory";
import { KnowledgeGraphViz } from "@/components/KnowledgeGraphViz";
import { LondonDataPanel } from "@/components/LondonDataPanel";
import { InventoryUpload } from "@/components/InventoryUpload";
import { HardwareStatusBar } from "@/components/HardwareStatusBar";
import { DEMO_COMPANY } from "@/lib/data/demoInventory";
import { edgeDGXRouter } from "@/lib/edge-dgx-router";
import type { InventoryItem, PipelineResult } from "@/lib/types";

type HardwareLoopMeta = {
  edgeTier: "zgx" | "local";
  dgxTier: "dgx" | "local";
  executionTier: "zgx" | "local";
};

export default function ReLoopDashboard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [liveSteps, setLiveSteps] = useState<PipelineResult["timeline"]>([]);
  const [activeArchStep, setActiveArchStep] = useState(-1);
  const [edgeActive, setEdgeActive] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventorySource, setInventorySource] = useState<"demo" | "upload" | null>(null);
  const [nemoclawStatus, setNemoclawStatus] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setLiveSteps([]);
    setActiveArchStep(0);
    setEdgeActive(true);
    setNemoclawStatus(null);

    try {
      const pipelineResult = await edgeDGXRouter.runFullLoop(
        inventory,
        inventorySource ?? "demo"
      ) as PipelineResult & {
        hardware?: HardwareLoopMeta;
        nemoclaw?: { usedNemoclaw: boolean; source: string; insight: string };
        nebiusBackup?: {
          status: "live" | "demo" | "error";
          summary: string;
          model?: string;
          jobs?: { carbon: string; reflection: string; backup: string };
        };
      };

      const statusParts: string[] = [];
      const hw = pipelineResult.hardware;
      if (hw) {
        statusParts.push(
          `Loop: ZGX ${hw.edgeTier === "zgx" ? "live" : "local"} → DGX ${hw.dgxTier === "dgx" ? "live" : "local"} → ZGX ${hw.executionTier === "zgx" ? "live" : "local"}`
        );
      } else {
        const nemoclaw = pipelineResult.nemoclaw;
        if (nemoclaw?.usedNemoclaw) {
          statusParts.push(`NemoClaw (${nemoclaw.source})`);
        } else {
          statusParts.push("DGX local orchestration");
        }
      }

      const nb = pipelineResult.nebiusBackup;
      if (nb?.status === "live") {
        statusParts.push(`Nebius cloud backup live${nb.model ? ` (${nb.model})` : ""}`);
      } else if (nb?.status === "demo") {
        statusParts.push("Nebius local fallback");
      } else if (nb?.status === "error") {
        statusParts.push("Nebius unavailable");
      }

      setNemoclawStatus(statusParts.join(" · "));

      for (let i = 0; i < pipelineResult.timeline.length; i++) {
        setLiveSteps(pipelineResult.timeline.slice(0, i + 1));
        setActiveArchStep(Math.min(i, 8));
        await new Promise((r) => setTimeout(r, 200));
      }

      setResult(pipelineResult);
      setActiveArchStep(8);
    } catch (err) {
      console.error(err);
      setNemoclawStatus(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [inventory, inventorySource]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <ReLoopLogo size={44} />
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Before waste becomes waste, ReLoop finds its next life.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
            <HardwareStatusBar />
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-start sm:justify-end w-full">
            <EdgeBadge active={edgeActive} />
            {result?.demoMode && (
              <span className="text-xs rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 px-3 py-1">
                Demo Mode — No API keys required
              </span>
            )}
            {nemoclawStatus && (
              <span className="text-xs rounded-full border border-green-500/30 bg-green-500/10 text-green-400 px-3 py-1">
                {nemoclawStatus}
              </span>
            )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="min-w-0">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl sm:text-3xl font-bold leading-tight"
            >
              Recyclops
            </motion.h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-3 sm:mt-4 leading-relaxed">
              {DEMO_COMPANY.name} plans to dispose of enterprise IT assets.
              Upload your inventory CSV/JSON or London recycling data — then run
              analysis via NemoClaw + Nemotron and the ZGX → DGX → ZGX agent loop.
            </p>

            <div className="mt-6">
              <InventoryUpload
                disabled={loading}
                onInventoryChange={(items, source) => {
                  setInventory(items);
                  setInventorySource(source);
                  setResult(null);
                }}
              />
            </div>

            <p className="text-xs text-zinc-500 mt-3">
              {DEMO_COMPANY.borough}, London · {DEMO_COMPANY.employees} employees
            </p>

            <button
              onClick={runAnalysis}
              disabled={loading || inventory.length === 0 || !inventorySource}
              className="mt-6 flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 sm:px-6 py-3 text-sm sm:text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              {loading
                ? "Running NemoClaw + ZGX → DGX → ZGX..."
                : inventorySource
                  ? "Run Recovery Analysis"
                  : "Choose upload or demo data first"}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4 min-w-0 overflow-hidden">
            <h3 className="text-sm font-medium text-zinc-400 mb-2 text-center">
              System Architecture
            </h3>
            <ArchitectureFlow activeStep={activeArchStep} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Sponsor Integrations
          </h3>
          <SponsorBadges />
        </section>

        <VoiceSessionMemory contextSummary={result?.voiceSummary} />

        {(loading || liveSteps.length > 0) && (
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ChevronRight className="h-5 w-5 text-emerald-400" />
              Live Agent Timeline
            </h3>
            <AgentTimeline steps={liveSteps} />
          </section>
        )}

        {result && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-lg font-semibold mb-4">Environmental & Economic Impact</h3>
              <ImpactCounter summary={result.summary} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <VoiceAgent
                key={`voice-${inventorySource ?? "none"}-${result.summary.totalDevices}-${result.voiceSummary.length}`}
                text={result.voiceSummary}
              />
              <LondonDataPanel />
            </div>

            <EnvironmentalChart
              inventory={result.inventory}
              optimizations={result.optimizations}
            />

            <div>
              <h3 className="text-lg font-semibold mb-4">Recovery Reports</h3>
              <ReportPanel result={result} />
            </div>

            <KnowledgeGraphViz graph={result.knowledgeGraph} />

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
              <strong className="text-zinc-300">System loop complete:</strong>{" "}
              Inventory {inventorySource === "upload" ? "uploaded" : "dummy demo"} →
              NemoClaw/Nemotron → ZGX Nano edge scan → DGX Spark orchestration →
              edge execution → reports + voice output.
            </div>
          </motion.section>
        )}
      </main>

      <footer className="border-t border-zinc-800 mt-12 py-6 text-center text-xs text-zinc-600">
        ReLoop AI · NVIDIA Hack for Impact London · Urban Operations + Economic Systems
      </footer>
    </div>
  );
}
