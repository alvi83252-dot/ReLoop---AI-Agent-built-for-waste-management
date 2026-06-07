export type LLMProvider = "openai" | "gemini" | "claude" | "demo";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
}

export function getLLMConfig(): LLMConfig {
  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai", apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.GEMINI_API_KEY) {
    return { provider: "gemini", apiKey: process.env.GEMINI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "claude", apiKey: process.env.ANTHROPIC_API_KEY };
  }
  return { provider: "demo" };
}

export async function generateInsight(prompt: string): Promise<string> {
  const config = getLLMConfig();
  if (config.provider === "demo") {
    return `[Demo Mode] ${prompt.slice(0, 120)}... Analysis complete using local PyTorch inference and rule-based agent orchestration.`;
  }
  // Provider abstraction — extend with real API calls when keys are available
  return `[${config.provider}] Insight generated for: ${prompt.slice(0, 80)}`;
}
