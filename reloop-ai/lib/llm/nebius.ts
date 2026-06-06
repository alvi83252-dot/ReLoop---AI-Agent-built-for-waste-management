import type { InventoryItem } from "@/lib/types";

const DEFAULT_ENDPOINT = "https://api.tokenfactory.nebius.com/v1";
const DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";

const MODEL_PREFERENCES = [
  "meta-llama/Meta-Llama-3.1-8B-Instruct",
  "meta-llama/Llama-3.3-70B-Instruct",
  "Qwen/Qwen2.5-72B-Instruct",
  "deepseek-ai/DeepSeek-R1-0528",
];

export const NEBIUS_REFLECTION_OFFLOAD_MESSAGE =
  "DGX local chain complete → offloading Reflection Agent to Nebius Token Factory";

export const NEBIUS_CARBON_OFFLOAD_MESSAGE =
  "DGX local chain complete → offloading Carbon Impact Agent to Nebius Token Factory";

let resolvedModel: string | null = null;

export interface NebiusConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

export function getNebiusConfig(): NebiusConfig | null {
  const apiKey = process.env.NEBIUS_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    endpoint: (process.env.NEBIUS_ENDPOINT ?? DEFAULT_ENDPOINT).replace(/\/$/, ""),
    model: process.env.NEBIUS_MODEL ?? DEFAULT_MODEL,
  };
}

export function isNebiusConfigured(): boolean {
  return getNebiusConfig() !== null;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function listNebiusModels(config: NebiusConfig): Promise<string[]> {
  try {
    const response = await fetch(`${config.endpoint}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((model) => model.id);
  } catch {
    return [];
  }
}

async function resolveNebiusModel(config: NebiusConfig): Promise<string> {
  if (resolvedModel) return resolvedModel;

  const available = await listNebiusModels(config);
  if (available.length === 0) {
    resolvedModel = config.model;
    return resolvedModel;
  }

  if (available.includes(config.model)) {
    resolvedModel = config.model;
    return resolvedModel;
  }

  for (const preferred of MODEL_PREFERENCES) {
    if (available.includes(preferred)) {
      resolvedModel = preferred;
      console.info("[Nebius] Auto-selected model:", resolvedModel);
      return resolvedModel;
    }
  }

  resolvedModel = available[0];
  console.info("[Nebius] Auto-selected model:", resolvedModel);
  return resolvedModel;
}

async function requestChatCompletion(
  config: NebiusConfig,
  model: string,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<{ content: string | null; status: number; errorText: string }> {
  const response = await fetch(`${config.endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    return { content: null, status: response.status, errorText: await response.text() };
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    content: data.choices?.[0]?.message?.content?.trim() ?? null,
    status: response.status,
    errorText: "",
  };
}

export async function nebiusChatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string | null> {
  const config = getNebiusConfig();
  if (!config) return null;

  try {
    let model = await resolveNebiusModel(config);
    let result = await requestChatCompletion(config, model, messages, options);

    if (
      result.status === 404 &&
      result.errorText.includes("does not exist")
    ) {
      resolvedModel = null;
      model = await resolveNebiusModel(config);
      result = await requestChatCompletion(config, model, messages, options);
    }

    if (!result.content) {
      console.error("[Nebius] API error:", result.status, result.errorText);
      return null;
    }

    return result.content;
  } catch (error) {
    console.error("[Nebius] request failed:", error);
    return null;
  }
}

function extractJsonBlock(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function nebiusBackupInference(payload: unknown): Promise<{
  source: "nebius";
  status: "demo" | "live" | "error";
  result: unknown;
}> {
  if (!isNebiusConfigured()) {
    return {
      source: "nebius",
      status: "demo",
      result: {
        message: "Nebius cloud backup available when NEBIUS_API_KEY is configured",
        payload,
      },
    };
  }

  const content = await nebiusChatCompletion([
    {
      role: "system",
      content:
        "You are ReLoop AI cloud overflow compute on Nebius. Summarise DGX offload status in 2 sentences for a hackathon demo.",
    },
    {
      role: "user",
      content: `Overflow backup request payload:\n${JSON.stringify(payload, null, 2)}`,
    },
  ]);

  if (!content) {
    return {
      source: "nebius",
      status: "error",
      result: { message: "Nebius backup inference unavailable", payload },
    };
  }

  return {
    source: "nebius",
    status: "live",
    result: { summary: content, payload },
  };
}

export async function nebiusCarbonAnalysis(
  inventory: InventoryItem[],
  localEstimates: number[]
): Promise<{
  status: "live" | "fallback";
  summary: string;
  estimates: number[];
}> {
  const localTotal = localEstimates.reduce((sum, value) => sum + value, 0);
  const fallbackSummary = `Carbon forecast: ${localTotal.toLocaleString()} kg CO₂ saved vs disposal (London dataset baseline)`;

  if (!isNebiusConfigured()) {
    return {
      status: "fallback",
      summary: fallbackSummary,
      estimates: localEstimates,
    };
  }

  const content = await nebiusChatCompletion([
    {
      role: "system",
      content:
        "You are the ReLoop Carbon Impact Agent running on Nebius cloud inference. Return JSON only with keys: summary (string), items (array of {id, carbonSavedKg, reasoning}). Use realistic IT asset lifecycle carbon estimates for London circular economy recovery.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "carbon_estimate",
        baselineKg: localEstimates,
        assets: inventory.map((item, idx) => ({
          id: item.id,
          type: item.deviceType,
          quantity: item.quantity,
          condition: item.conditionScore,
          age_years: item.estimatedAgeYears,
          baselineKg: localEstimates[idx],
        })),
      }),
    },
  ]);

  if (!content) {
    return {
      status: "fallback",
      summary: fallbackSummary,
      estimates: localEstimates,
    };
  }

  const parsed = extractJsonBlock(content) as {
    summary?: string;
    items?: Array<{ id?: string; carbonSavedKg?: number }>;
  } | null;

  if (!parsed?.items?.length) {
    return {
      status: "fallback",
      summary: content.slice(0, 280) || fallbackSummary,
      estimates: localEstimates,
    };
  }

  const byId = new Map(
    parsed.items
      .filter((item) => item.id && typeof item.carbonSavedKg === "number")
      .map((item) => [item.id as string, Math.round(item.carbonSavedKg as number)])
  );

  const estimates = inventory.map((item, idx) => byId.get(item.id) ?? localEstimates[idx]);

  return {
    status: "live",
    summary:
      parsed.summary ??
      `Nebius carbon forecast: ${estimates.reduce((sum, value) => sum + value, 0).toLocaleString()} kg CO₂ saved vs disposal`,
    estimates,
  };
}

export async function nebiusReflection(context: {
  inventoryCount: number;
  reuseCount: number;
  lowConfidenceCount: number;
  totalCarbonKg: number;
  totalValueGBP: number;
}): Promise<string | null> {
  if (!isNebiusConfigured()) return null;

  return nebiusChatCompletion([
    {
      role: "system",
      content:
        "You are the ReLoop Reflection Agent on Nebius. Write 2 concise sentences critiquing the multi-agent recovery plan.",
    },
    {
      role: "user",
      content: JSON.stringify(context),
    },
  ]);
}
