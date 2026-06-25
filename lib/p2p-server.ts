import fs from 'fs';
import path from 'path';

const CHUNK_DIRS = [
  path.join(process.cwd(), 'public/chunks'),
  path.join(process.cwd(), 'public/test-player/chunks'),
];

/**
 * Server-side chunk delivery for the browser player.
 * Chunks are fetched via /api/p2p/chunk — in production this wraps native iroh (Node addon).
 * Player tests use on-disk fixtures (P2P_TEST_MODE=1).
 */
export async function fetchChunkServer(hash: string, peerIds: string[]): Promise<Buffer> {
  void peerIds;
  for (const dir of CHUNK_DIRS) {
    const file = path.join(dir, `${hash}.ts`);
    if (fs.existsSync(file)) {
      return fs.readFileSync(file);
    }
  }
  throw new Error(`chunk not found: ${hash}`);
}

export function chunkStorageDir(): string {
  const dir = CHUNK_DIRS[0]!;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
