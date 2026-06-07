import type { AgentStep } from "@/lib/types";

let stepCounter = 0;

export function createStep(
  agent: string,
  layer: AgentStep["layer"],
  message: string,
  status: AgentStep["status"] = "running",
  output?: Record<string, unknown>,
  confidence?: number
): AgentStep {
  return {
    id: `step-${++stepCounter}`,
    agent,
    layer,
    status,
    message,
    timestamp: Date.now(),
    confidence,
    output,
  };
}

export function completeStep(step: AgentStep, message?: string): AgentStep {
  return {
    ...step,
    status: "complete",
    message: message ?? step.message,
  };
}

/** Replace the running step in-place so the timeline never shows duplicate entries. */
export function finishStep(
  timeline: AgentStep[],
  step: AgentStep,
  message?: string
): void {
  const completed = completeStep(step, message);
  const index = timeline.findIndex((entry) => entry.id === step.id);
  if (index >= 0) {
    timeline[index] = completed;
  } else {
    timeline.push(completed);
  }
}

export function resetStepCounter() {
  stepCounter = 0;
}

export async function simulateAgentDelay(ms = 400): Promise<void> {
  const fast = process.env.ANALYSIS_FAST_MODE === "true";
  const scaled = fast ? Math.min(ms, 80) : Math.round(ms * 0.35);
  await new Promise((resolve) => setTimeout(resolve, scaled));
}
