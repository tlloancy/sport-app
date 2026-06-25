import fs from 'fs';
import path from 'path';

const CHUNK_DIR = path.join(process.cwd(), 'public/test-player/chunks');

/**
 * Server-side chunk delivery for the browser player.
 * Chunks are fetched via /api/p2p/chunk — in production this wraps native iroh (Node addon).
 * Player tests use on-disk fixtures (P2P_TEST_MODE=1).
 */
export async function fetchChunkServer(hash: string, peerIds: string[]): Promise<Buffer> {
  void peerIds;
  const file = path.join(CHUNK_DIR, `${hash}.ts`);
  if (!fs.existsSync(file)) {
    throw new Error(`chunk not found: ${hash}`);
  }
  return fs.readFileSync(file);
}
