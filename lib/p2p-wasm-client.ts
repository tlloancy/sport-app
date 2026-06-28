'use client';

type CoreP2pModule = {
  default: (moduleOrPath?: string) => Promise<void>;
  create_peer_wasm: () => Promise<string>;
  fetch_chunk_wasm: (remotePeerId: string, hash: string) => Promise<Uint8Array>;
  core_p2p_wasm_version?: () => string;
};

const WASM_BASE = '/core-p2p';
const WASM_JS = `${WASM_BASE}/core_p2p.js`;
const WASM_BIN = `${WASM_BASE}/core_p2p_bg.wasm`;

let modulePromise: Promise<CoreP2pModule | null> | null = null;
let localPeerId: string | null = null;

async function loadModule(): Promise<CoreP2pModule | null> {
  if (typeof window === 'undefined') return null;
  if (process.env.NEXT_PUBLIC_P2P_WASM_DISABLED === '1') return null;

  try {
    const res = await fetch(WASM_BIN, { method: 'HEAD' });
    if (!res.ok) {
      console.warn('[p2p-wasm] WASM binary missing at', WASM_BIN);
      return null;
    }
  } catch {
    return null;
  }

  try {
    const mod = (await import(/* webpackIgnore: true */ WASM_JS)) as CoreP2pModule;
    await mod.default(WASM_BIN);
    return mod;
  } catch (err) {
    console.warn('[p2p-wasm] module load failed', err);
    return null;
  }
}

/** Initialize browser iroh peer (relay-only). Safe to call multiple times. */
export async function ensureP2pWasm(): Promise<boolean> {
  if (localPeerId) return true;
  if (!modulePromise) {
    modulePromise = (async () => {
      const mod = await loadModule();
      if (!mod) return null;
      try {
        localPeerId = await mod.create_peer_wasm();
        console.info('[p2p-wasm] peer ready', localPeerId);
        return mod;
      } catch (err) {
        console.warn('[p2p-wasm] create_peer_wasm failed', err);
        return null;
      }
    })();
  }
  const mod = await modulePromise;
  return mod !== null && localPeerId !== null;
}

export function getLocalWasmPeerId(): string | null {
  return localPeerId;
}

/** Fetch chunk via browser iroh (relay). Tries peers in order. */
export async function fetchChunkViaWasm(
  hash: string,
  peers: string[]
): Promise<ArrayBuffer | null> {
  if (!(await ensureP2pWasm()) || !modulePromise) return null;
  const mod = await modulePromise;
  if (!mod) return null;

  const candidates = Array.from(
    new Set(peers.filter((p) => p && p !== 'local-peer'))
  );
  for (const peer of candidates) {
    try {
      const data = await mod.fetch_chunk_wasm(peer, hash);
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    } catch (err) {
      console.debug('[p2p-wasm] fetch failed for peer', peer.slice(0, 12), err);
    }
  }
  return null;
}
