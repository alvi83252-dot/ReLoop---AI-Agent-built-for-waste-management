import { AGENT_NAMES } from "@/lib/agents/names";
import type { AgentStep } from "@/lib/types";

const RUNNING_PIPELINE: Array<{ agent: string; layer: AgentStep["layer"]; message: string }> = [
  { agent: AGENT_NAMES.assetIntake, layer: "edge", message: "Scanning inventory on ZGX edge…" },
  { agent: AGENT_NAMES.lifecycle, layer: "dgx", message: "Modelling device lifecycles…" },
  { agent: AGENT_NAMES.circular, layer: "dgx", message: "Optimising circular routes…" },
  { agent: AGENT_NAMES.carbon, layer: "dgx", message: "Estimating carbon savings…" },
  { agent: AGENT_NAMES.economic, layer: "dgx", message: "Calculating recovery value…" },
  { agent: AGENT_NAMES.matching, layer: "dgx", message: "Matching London partners…" },
  { agent: AGENT_NAMES.risk, layer: "dgx", message: "Reviewing risk and confidence…" },
  { agent: AGENT_NAMES.synthesizer, layer: "synthesis", message: "Synthesising recovery plan…" },
  { agent: AGENT_NAMES.reports, layer: "execution", message: "Generating reports and voice summary…" },
];

export function buildRunningTimeline(activeIndex: number): AgentStep[] {
  const capped = Math.max(0, Math.min(activeIndex, RUNNING_PIPELINE.length - 1));

  return RUNNING_PIPELINE.slice(0, capped + 1).map((entry, index) => ({
    id: `running-${index}`,
    agent: entry.agent,
    layer: entry.layer,
    status: index < capped ? "complete" : "running",
    message: entry.message,
    timestamp: Date.now(),
  }));
}
