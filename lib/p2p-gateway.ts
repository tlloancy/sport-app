import 'server-only';

import fs from 'fs';
import path from 'path';

type P2pNative = {
  create_peer: () => Promise<string>;
  seed_blob: (peer: string, hash: string, data: Buffer) => void;
  fetch_blob: (local: string, remote: string, hash: string) => Promise<Buffer>;
  peer_endpoint: (peer: string) => string;
};

let native: P2pNative | null | undefined;
let loadError: string | null = null;
let gatewayPeerId: string | null = null;
let gatewayInit: Promise<string | null> | null = null;

function coreP2pRoot(): string {
  return process.env.CORE_P2P_ROOT ?? path.join(process.cwd(), '../core-p2p');
}

function loadNative(): P2pNative | null {
  if (native !== undefined) {
    return native;
  }

  if (process.env.P2P_DISABLED === '1' || process.env.P2P_TEST_MODE === '1') {
    loadError = 'p2p disabled by env';
    native = null;
    return null;
  }

  const addonPath = path.join(coreP2pRoot(), 'index.node');
  if (!fs.existsSync(addonPath)) {
    loadError = `missing native addon at ${addonPath}`;
    console.warn(`[p2p] ${loadError} — disk fallback only`);
    native = null;
    return null;
  }

  try {
    // Dynamic path — evaluated at runtime on Node only (native .node addon).
    const req = eval('require') as NodeRequire;
    native = req(addonPath) as P2pNative;
    return native;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.warn(`[p2p] failed to load native addon: ${loadError}`);
    native = null;
    return null;
  }
}

export function isP2pEnabled(): boolean {
  return loadNative() !== null;
}

export function p2pStatus(): { enabled: boolean; peerId: string | null; error: string | null } {
  return {
    enabled: isP2pEnabled(),
    peerId: gatewayPeerId,
    error: loadError,
  };
}

export async function getGatewayPeerId(): Promise<string | null> {
  if (gatewayPeerId) return gatewayPeerId;
  if (!gatewayInit) {
    gatewayInit = initGateway();
  }
  return gatewayInit;
}

async function initGateway(): Promise<string | null> {
  const n = loadNative();
  if (!n) return null;

  try {
    gatewayPeerId = await n.create_peer();
    const endpoint = n.peer_endpoint(gatewayPeerId);
    console.log(`[p2p] gateway peer ${gatewayPeerId} (${endpoint})`);
    return gatewayPeerId;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    console.error('[p2p] create_peer failed:', loadError);
    return null;
  }
}

/** Start gateway early on server boot (optional). */
export function warmGatewayPeer(): Promise<string | null> {
  return getGatewayPeerId();
}

export async function seedChunkToGateway(hash: string, data: Buffer): Promise<boolean> {
  const peerId = await getGatewayPeerId();
  const n = loadNative();
  if (!peerId || !n) return false;

  try {
    n.seed_blob(peerId, hash, data);
    return true;
  } catch (err) {
    console.error(`[p2p] seed_blob failed for ${hash.slice(0, 12)}…`, err);
    return false;
  }
}

export async function seedChunksFromDir(hashes: string[], dir: string): Promise<number> {
  let seeded = 0;
  for (const hash of hashes) {
    const file = path.join(dir, `${hash}.ts`);
    if (!fs.existsSync(file)) continue;
    const data = fs.readFileSync(file);
    if (await seedChunkToGateway(hash, data)) seeded += 1;
  }
  return seeded;
}

function extraRelayPeers(): string[] {
  const raw = process.env.RELAY_PEER_IDS ?? process.env.RELAY_PEER_ID ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDialablePeerId(id: string): boolean {
  return id.length > 20 && id !== 'local-peer';
}

/** Fetch via iroh: local gateway cache, then remote peers (race up to 3). */
export async function fetchChunkViaP2p(
  hash: string,
  peerIds: string[]
): Promise<Buffer | null> {
  const localId = await getGatewayPeerId();
  const n = loadNative();
  if (!localId || !n) return null;

  try {
    const cached = await n.fetch_blob(localId, localId, hash);
    return Buffer.from(cached);
  } catch {
    // not in local store
  }

  const remotes = Array.from(new Set([...peerIds, ...extraRelayPeers()])).filter(
    (id) => isDialablePeerId(id) && id !== localId
  );

  if (remotes.length === 0) return null;

  const racers = remotes.slice(0, 3).map(async (remote) => {
    const buf = await n.fetch_blob(localId, remote, hash);
    return Buffer.from(buf);
  });

  try {
    return await Promise.any(racers);
  } catch {
    return null;
  }
}
