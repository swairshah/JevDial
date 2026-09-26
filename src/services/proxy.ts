export const proxy = {
  available: false,
  hasJevKey: false,
  hasLlmKey: false
};

interface Health {
  ok?: boolean;
  has_key?: boolean;
  has_llm_key?: boolean;
}

export async function detectProxy(): Promise<void> {
  if (!location.protocol.startsWith('http')) return;
  try {
    const r = await fetch('/api/jev/health', { cache: 'no-store', signal: AbortSignal.timeout(900) });
    if (!r.ok) return;
    const d = (await r.json()) as Health;
    proxy.available = !!d.ok;
    proxy.hasJevKey = !!d.has_key;
    proxy.hasLlmKey = !!d.has_llm_key;
  } catch {}
}
