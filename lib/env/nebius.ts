/** Nebius Token Factory — OpenAI-compatible cloud inference. */

export function getNebiusConfig() {
  const apiKey = process.env.NEBIUS_API_KEY?.trim() || "";

  const baseUrl = (
    process.env.NEBIUS_BASE_URL?.trim() ||
    "https://api.tokenfactory.nebius.com/v1"
  ).replace(/\/$/, "");

  const model =
    process.env.NEBIUS_MODEL?.trim() ||
    "meta-llama/Meta-Llama-3.1-8B-Instruct";

  return { apiKey, baseUrl, model };
}

export function isNebiusConfigured(): boolean {
  return Boolean(getNebiusConfig().apiKey);
}
