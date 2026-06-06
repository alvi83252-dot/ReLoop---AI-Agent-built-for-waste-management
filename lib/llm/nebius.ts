/**
 * Nebius cloud backup inference provider.
 * Used when edge/DGX local capacity is exceeded or for model hosting experiments.
 */
export async function nebiusBackupInference(payload: unknown): Promise<{
  source: "nebius";
  status: "demo" | "live";
  result: unknown;
}> {
  const apiKey = process.env.NEBIUS_API_KEY;

  if (!apiKey) {
    return {
      source: "nebius",
      status: "demo",
      result: {
        message: "Nebius cloud backup available when NEBIUS_API_KEY is configured",
        payload,
      },
    };
  }

  // Extend with Nebius API when key is provided
  return {
    source: "nebius",
    status: "live",
    result: { message: "Nebius inference routed", payload },
  };
}
