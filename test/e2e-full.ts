import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import {
  actorStoreRootForPds,
  announcePeerId,
  createAccountOnPds,
  getComments,
  getFeed,
  postComment,
  publishPerformance,
} from '../lib/atproto';
import { chunkVideoFile } from '../lib/chunker';

const require = createRequire(__filename);
const CORE_P2P = path.resolve(__dirname, '../../core-p2p');
const { createPeer, fetchChunk } = require(path.join(CORE_P2P, 'test/peer-node.js'));
const { seed_blob } = require(path.join(CORE_P2P, 'index.node'));

const PDS_1 = process.env.PDS_1_URL ?? process.env.PDS_A_URL ?? 'http://localhost:2583';
const PDS_2 = process.env.PDS_2_URL ?? process.env.PDS_B_URL ?? 'http://localhost:2584';
const PASSWORD = 'testpass-e2e-full';

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function main() {
  const samplePath = path.resolve(__dirname, 'fixtures/sample.mp4');
  if (!fs.existsSync(samplePath)) {
    throw new Error(`missing fixture: ${samplePath}`);
  }

  const chunkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-chunks-'));
  const peers: Array<{ close(): Promise<void> }> = [];

  try {
    // ── Machine A — PDS_A ──────────────────────────────────────────────
    const accountA = await createAccountOnPds(
      PDS_1,
      `e2e-a-${crypto.randomBytes(3).toString('hex')}.test`,
      PASSWORD,
      undefined,
      actorStoreRootForPds(PDS_1)
    );
    if (!accountA.agent) throw new Error('machine A: no agent');

    const { videoHash, chunkManifest } = chunkVideoFile(samplePath, chunkDir);
    const hashes = JSON.parse(chunkManifest) as string[];
    const segments = hashes.map((hash) => ({
      hash,
      bytes: fs.readFileSync(path.join(chunkDir, `${hash}.ts`)),
    }));

    const peerA = await createPeer();
    peers.push(peerA);
    for (const seg of segments) {
      if (sha256(seg.bytes) !== seg.hash) {
        throw new Error(`segment hash mismatch: ${seg.hash}`);
      }
      seed_blob(peerA.id, seg.hash, seg.bytes);
    }

    await announcePeerId(accountA.agent, peerA.id);

    const performanceUri = await publishPerformance(accountA.agent, {
      movement: 'snatch',
      value: 35,
      unit: 'kg',
      videoHash,
      chunkManifest,
      createdAt: new Date().toISOString(),
    });

    console.log('PASS [1/5] performance published on PDS_A');

    // ── Machine B — reads federated feed (PDS_A + PDS_B) ───────────────
    const feed = await getFeed('snatch', 'T2', [PDS_1, PDS_2]);
    const onFeed = feed.find((item) => item.uri === performanceUri);
    if (!onFeed || onFeed.record.tranche !== 'T2' || onFeed.record.value !== 35) {
      console.error('FAIL [2/5]: performance not in T2 feed', { onFeed, feedLen: feed.length });
      process.exit(1);
    }
    console.log('PASS [2/5] performance visible on PDS_B feed — tranche T2');

    // ── Machine B — stream via P2P (no central video server) ─────────
    const peerB = await createPeer();
    peers.push(peerB);

    const streamStart = Date.now();
    const first = await fetchChunk(hashes[0]!, [peerA], peerB);
    const streamMs = Date.now() - streamStart;
    if (sha256(first) !== hashes[0]) {
      console.error('FAIL [3/5]: first chunk hash mismatch');
      process.exit(1);
    }
    if (streamMs >= 3000) {
      console.error(`FAIL [3/5]: stream too slow (${streamMs}ms >= 3000ms)`);
      process.exit(1);
    }

    for (let i = 1; i < hashes.length; i += 1) {
      const chunk = await fetchChunk(hashes[i]!, [peerA], peerB);
      if (sha256(chunk) !== hashes[i]) {
        console.error(`FAIL [3/5]: chunk ${i} hash mismatch`);
        process.exit(1);
      }
    }
    console.log(`PASS [3/5] video streamed in ${streamMs}ms — no central server`);

    // ── Machine A offline — Machine C fetches from Machine B ───────────
    await peerA.close();

    const peerC = await createPeer();
    peers.push(peerC);

    for (const hash of hashes) {
      const chunk = await fetchChunk(hash, [peerB], peerC);
      if (sha256(chunk) !== hash) {
        console.error('FAIL [4/5]: chunk hash mismatch after peer_a disconnect');
        process.exit(1);
      }
    }
    console.log('PASS [4/5] video available after peer_a disconnect');

    // ── Machine B comments — Machine C reads via PDS_B only ──────────
    const accountB = await createAccountOnPds(
      PDS_2,
      `e2e-b-${crypto.randomBytes(3).toString('hex')}.test`,
      PASSWORD,
      undefined,
      actorStoreRootForPds(PDS_2)
    );
    if (!accountB.agent) throw new Error('machine B: no agent');

    const commentText = `e2e-comment-${crypto.randomBytes(4).toString('hex')}`;
    await postComment(accountB.agent, performanceUri, commentText);

    const comments = await getComments(performanceUri, [PDS_2]);
    if (!comments.some((c) => c.record.text === commentText)) {
      console.error('FAIL [5/5]: comment not visible via PDS_B only', comments);
      process.exit(1);
    }
    console.log('PASS [5/5] comment cross-PDS visible');

    console.log('');
    console.log('ALL TESTS PASSED — VICTORY');
  } finally {
    for (const peer of peers) {
      try {
        await peer.close();
      } catch {
        // ignore shutdown errors
      }
    }
    fs.rmSync(chunkDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
