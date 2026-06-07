import type { InventoryItem } from "@/lib/types";
import { summarizeInventory } from "@/lib/data/demoInventory";
import { getNebiusConfig, isNebiusConfigured } from "@/lib/env/nebius";

export interface NebiusInferenceResult {
  source: "nebius";
  status: "demo" | "live" | "error";
  insight: string;
  model?: string;
  error?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** OpenAI-compatible chat completion via Nebius Token Factory. */
export async function nebiusChatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number },
  modelOverride?: string
): Promise<string> {
  const { apiKey, baseUrl, model } = getNebiusConfig();
  const modelId = modelOverride ?? model;

  if (!apiKey) {
    throw new Error("NEBIUS_API_KEY not configured");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 600,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Nebius HTTP ${response.status}: ${raw.slice(0, 400)}`);
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
  };

  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("Nebius returned invalid JSON");
  }

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Nebius returned empty completion");
  }

  return content;
}

/** Check Nebius connectivity (lists models when key is valid). */
export async function checkNebiusHealth(): Promise<{
  configured: boolean;
  online: boolean;
  model: string;
  detail?: string;
}> {
  const { apiKey, baseUrl, model } = getNebiusConfig();

  if (!apiKey) {
    return { configured: false, online: false, model };
  }

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        configured: true,
        online: false,
        model,
        detail: `HTTP ${response.status}`,
      };
    }

    return {
      configured: true,
      online: true,
      model,
      detail: "Nebius Token Factory connected",
    };
  } catch (error) {
    return {
      configured: true,
      online: false,
      model,
      detail: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/** Cloud backup analysis for circular-economy routing when DGX/edge need LLM support. */
export async function nebiusAnalyzeCircularInventory(
  inventory: InventoryItem[]
): Promise<NebiusInferenceResult> {
  const { model } = getNebiusConfig();

  if (!isNebiusConfigured()) {
    return {
      source: "nebius",
      status: "demo",
      insight: "",
    };
  }

  if (inventory.length === 0) {
    return {
      source: "nebius",
      status: "demo",
      insight: "",
    };
  }

  const inventorySummary = summarizeInventory(inventory);
  const sampleRows = inventory
    .slice(0, 8)
    .map(
      (item) =>
        `- ${item.quantity}× ${item.deviceType}, condition ${Math.round(item.conditionScore * 100)}%, age ${item.estimatedAgeYears}y${item.notes ? ` (${item.notes})` : ""}`
    )
    .join("\n");

  try {
    const insight = await nebiusChatCompletion(
      [
        {
          role: "system",
          content:
            "You are ReLoop AI, an expert on London circular economy and IT asset recovery. " +
            "Give clear, actionable advice on reuse, repair, donate, resell, and recycle. " +
            "Use short bullet points. Mention carbon savings and GBP recovery when relevant.",
        },
        {
          role: "user",
          content:
            `Analyse this inventory for a London organisation and recommend circular economy actions.\n\n` +
            `Summary: ${inventorySummary}\n\nSample rows:\n${sampleRows}\n\n` +
            `Provide 3–5 bullet recommendations under 220 words.`,
        },
      ],
      { maxTokens: 500, temperature: 0.35 }
    );

    return {
      source: "nebius",
      status: "live",
      insight,
      model,
    };
  } catch (error) {
    console.warn("Nebius circular inventory analysis failed:", error);
    return {
      source: "nebius",
      status: "error",
      insight: "",
      model,
      error: error instanceof Error ? error.message : "Nebius inference failed",
    };
  }
}

/**
 * Nebius cloud backup inference hook (legacy entry point).
 * Prefer nebiusAnalyzeCircularInventory when inventory is available.
 */
export async function nebiusBackupInference(payload: {
  inventory?: InventoryItem[];
  inventorySize?: number;
}): Promise<NebiusInferenceResult & { result?: unknown }> {
  if (payload.inventory?.length) {
    return nebiusAnalyzeCircularInventory(payload.inventory);
  }

  if (!isNebiusConfigured()) {
    return {
      source: "nebius",
      status: "demo",
      insight: "",
      result: {
        message: "Nebius cloud backup available when NEBIUS_API_KEY is configured",
        inventorySize: payload.inventorySize ?? 0,
      },
    };
  }

  return {
    source: "nebius",
    status: "demo",
    insight: "",
    result: { message: "Provide inventory array for Nebius analysis", payload },
  };
}
