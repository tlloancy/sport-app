const cache = new Map<string, ArrayBuffer>();

/** Fetch a chunk via the P2P API route (server-side iroh in production). */
export async function fetchChunk(hash: string, peers: string[]): Promise<ArrayBuffer> {
  const cached = cache.get(hash);
  if (cached) return cached;

  const qs = new URLSearchParams({ hash, peers: peers.join(',') });
  const res = await fetch(`/api/p2p/chunk?${qs}`);
  if (!res.ok) {
    throw new Error(`chunk fetch failed: ${res.status}`);
  }
  const data = await res.arrayBuffer();
  cache.set(hash, data);
  return data;
}

/** Avoid same-subnet peer clustering — mirrors core-p2p selectDiversePeers. */
export function selectDiversePeers(peers: string[], n: number): string[] {
  const chosen: string[] = [];
  const seen = new Set<string>();

  for (const peer of peers) {
    if (chosen.length >= n) break;
    const subnet = peer.includes(':') ? peer.split(':').slice(-1)[0]! : peer;
    if (seen.has(subnet)) continue;
    seen.add(subnet);
    chosen.push(peer);
  }

  for (const peer of peers) {
    if (chosen.length >= n) break;
    if (!chosen.includes(peer)) chosen.push(peer);
  }

  return chosen.slice(0, n);
}

export function seedOnView(hash: string, data: ArrayBuffer): void {
  cache.set(hash, data);
}
