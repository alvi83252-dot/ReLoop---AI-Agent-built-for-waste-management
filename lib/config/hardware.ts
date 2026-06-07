/** Hardware tier URLs — ZGX Nano (edge) and DGX Spark (core). */

export function getZgxServiceUrl(): string | null {
  const url =
    process.env.AI_SERVICE_URL?.trim() ||
    process.env.ZGX_SERVICE_URL?.trim() ||
    null;
  return url || null;
}

export function getDgxOrchestratorUrl(): string | null {
  const url =
    process.env.DGX_ORCHESTRATOR_URL?.trim() ||
    process.env.DGX_SERVICE_URL?.trim() ||
    null;
  return url || null;
}

export function isHardwareMode(): boolean {
  return Boolean(getZgxServiceUrl() || getDgxOrchestratorUrl());
}

export async function checkZgxHealth(): Promise<{
  online: boolean;
  url: string | null;
  detail?: Record<string, unknown>;
}> {
  const url = getZgxServiceUrl();
  if (!url) return { online: false, url: null };

  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { online: false, url };
    return { online: true, url, detail: await res.json() };
  } catch {
    return { online: false, url };
  }
}

export async function checkDgxHealth(): Promise<{
  online: boolean;
  url: string | null;
  detail?: Record<string, unknown>;
}> {
  const url = getDgxOrchestratorUrl();
  if (!url) return { online: false, url: null };

  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { online: false, url };
    return { online: true, url, detail: await res.json() };
  } catch {
    return { online: false, url };
  }
}
