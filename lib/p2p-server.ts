import fs from 'fs';
import path from 'path';
import { fetchChunkViaP2p, seedChunkToGateway } from '@/lib/p2p-gateway';

const CHUNK_DIRS = [
  path.join(process.cwd(), 'public/chunks'),
  path.join(process.cwd(), 'public/test-player/chunks'),
];

/**
 * Server-side chunk delivery: iroh P2P first, then on-disk fallback.
 * Browser still uses HTTP via /api/p2p/chunk.
 */
export async function fetchChunkServer(hash: string, peerIds: string[]): Promise<Buffer> {
  const fromP2p = await fetchChunkViaP2p(hash, peerIds);
  if (fromP2p) {
    return fromP2p;
  }

  for (const dir of CHUNK_DIRS) {
    const file = path.join(dir, `${hash}.ts`);
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file);
      void seedChunkToGateway(hash, data);
      return data;
    }
  }

  throw new Error(`chunk not found: ${hash}`);
}

export function chunkStorageDir(): string {
  const dir = CHUNK_DIRS[0]!;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
