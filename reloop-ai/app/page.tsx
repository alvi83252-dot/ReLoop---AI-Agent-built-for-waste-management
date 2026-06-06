"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  Recycle,
  ChevronRight,
  Upload,
} from "lucide-react";
import { AgentTimeline } from "@/components/AgentTimeline";
import { ImpactCounter } from "@/components/ImpactCounter";
import { ArchitectureFlow } from "@/components/ArchitectureFlow";
import { ReportPanel } from "@/components/ReportPanel";
import { SponsorBadges, EdgeBadge } from "@/components/SponsorBadges";
import { EnvironmentalChart } from "@/components/EnvironmentalChart";
import { VoiceAgent } from "@/components/VoiceAgent";
import { KnowledgeGraphViz } from "@/components/KnowledgeGraphViz";
import { LondonDataPanel } from "@/components/LondonDataPanel";
import { DEMO_INVENTORY, DEMO_COMPANY } from "@/lib/data/demoInventory";
import { edgeDGXRouter } from "@/lib/edge-dgx-router";
import type { PipelineResult } from "@/lib/types";

export default function ReLoopDashboard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [liveSteps, setLiveSteps] = useState<PipelineResult["timeline"]>([]);
  const [activeArchStep, setActiveArchStep] = useState(-1);
  const [edgeActive, setEdgeActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setLiveSteps([]);
    setActiveArchStep(0);
    setEdgeActive(true);
    setError(null);

    try {
      const pipelineResult = await edgeDGXRouter.runFullLoop(DEMO_INVENTORY);

      for (let i = 0; i < pipelineResult.timeline.length; i++) {
        setLiveSteps(pipelineResult.timeline.slice(0, i + 1));
        setActiveArchStep(Math.min(i, 8));
        await new Promise((r) => setTimeout(r, 200));
      }

      setResult(pipelineResult);
      setActiveArchStep(8);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected orchestration error";
      console.error(message, err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Recycle className="h-7 w-7 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight">
                ReLoop <span className="text-emerald-400">AI</span>
              </h1>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Before waste becomes waste, ReLoop finds its next life.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <EdgeBadge active={edgeActive} />
            {result?.demoMode && (
              <span className="text-xs rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 px-3 py-1">
                Demo Mode — No API keys required
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero + CTA */}
        <section className="grid lg:grid-cols-2 gap-8 items-start">
          <div>
            {error && (
              <div className="rounded-xl border border-red-700 bg-red-950/70 px-4 py-3 text-sm text-red-300 mb-4">
                <strong className="font-semibold">Analysis failed:</strong> {error}
              </div>
            )}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold leading-tight"
            >
              Autonomous circular-economy intelligence for London
            </motion.h2>
            <p className="text-zinc-400 mt-4 leading-relaxed">
              {DEMO_COMPANY.name} plans to dispose of enterprise IT assets.
              ReLoop&apos;s multi-agent system analyses, optimises, and redirects
              them before they become waste — powered by NVIDIA edge + DGX compute.
            </p>

            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                <Upload className="h-4 w-4" /> Demo Inventory
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {DEMO_INVENTORY.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between rounded-lg bg-zinc-800/50 px-3 py-2"
                  >
                    <span className="text-zinc-400 capitalize">{item.deviceType}s</span>
                    <span className="font-mono text-emerald-400">{item.quantity}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                {DEMO_COMPANY.borough}, London · {DEMO_COMPANY.employees} employees
              </p>
            </div>

            <button
              onClick={runAnalysis}
              disabled={loading}
              className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              {loading ? "Running ZGX → DGX → ZGX Loop..." : "Run Recovery Analysis"}
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-2 text-center">
              System Architecture
            </h3>
            <ArchitectureFlow activeStep={activeArchStep} />
          </div>
        </section>

        {/* Sponsors */}
        <section>
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">
            Sponsor Integrations
          </h3>
          <SponsorBadges />
        </section>

        {/* Live timeline */}
        {(loading || liveSteps.length > 0) && (
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ChevronRight className="h-5 w-5 text-emerald-400" />
              Live Agent Timeline
            </h3>
            <AgentTimeline steps={liveSteps} />
          </section>
        )}

        {/* Results */}
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

            <div className="grid lg:grid-cols-2 gap-6">
              <VoiceAgent text={result.voiceSummary} />
              <LondonDataPanel />
            </div>

            <EnvironmentalChart optimizations={result.optimizations} />

            <div>
              <h3 className="text-lg font-semibold mb-4">Recovery Reports</h3>
              <ReportPanel result={result} />
            </div>

            <KnowledgeGraphViz graph={result.knowledgeGraph} />

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-sm text-zinc-500">
              <strong className="text-zinc-300">System loop complete:</strong> ZGX Nano edge scan →
              DGX Spark multi-agent orchestration → Decision synthesis → ZGX edge execution →
              Reports + voice output. Cloud backup via Nebius available when configured.
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
