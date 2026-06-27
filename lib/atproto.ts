import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AtpAgent } from '@atproto/api';
import { getSigningDidKey, isValidDidDoc, type DidDocument } from '@atproto/common-web';
import { Secp256k1Keypair, verifySignature } from '@atproto/crypto';
import { verifySig } from '@atproto/crypto/dist/secp256k1/operations.js';
import { assignTranche } from '@/lib/tranches';

export const PERFORMANCE_LEXICON = 'app.sport.performance' as const;
export const COMMENT_LEXICON = 'app.sport.comment' as const;
export const PEER_LEXICON = 'app.sport.peer' as const;

export const DEFAULT_PDS_URL = process.env.PDS_URL ?? 'http://localhost:2583';

const DEFAULT_PDS_ACTOR_STORE =
  process.env.PDS_ACTOR_STORE ?? '/var/lib/docker/volumes/pds_local_data/_data/actors';

export const PDS2_ACTOR_STORE =
  process.env.PDS2_ACTOR_STORE ??
  '/var/lib/docker/volumes/pds_local_2_data/_data/actors';

export function actorStoreRootForPds(pdsUrl: string): string {
  if (pdsUrl.includes(':2584')) return PDS2_ACTOR_STORE;
  return DEFAULT_PDS_ACTOR_STORE;
}

/** Load the PDS-managed repo signing key (dev: local docker volume). */
export async function loadKeypairFromActorStore(
  did: string,
  actorStoreRoot = DEFAULT_PDS_ACTOR_STORE
): Promise<Secp256k1Keypair> {
  const didHash = crypto.createHash('sha256').update(did).digest('hex');
  const keyPath = path.join(actorStoreRoot, didHash.slice(0, 2), did, 'key');
  const privKey = await fs.readFile(keyPath);
  return Secp256k1Keypair.import(privKey, { exportable: true });
}

export interface PeerRecord {
  peerId: string;
  createdAt: string;
}

export interface LocalIdentity {
  did: string;
  handle?: string;
  keypair: Secp256k1Keypair;
  agent?: AtpAgent;
  peerId?: string;
}

export interface PerformanceRecord {
  movement: string;
  value: number;
  unit: 'kg' | 's' | 'm' | 'reps';
  videoHash: string;
  chunkManifest?: string;
  tranche?: string;
  createdAt: string;
}

export interface CommentRecord {
  performanceUri: string;
  text: string;
  createdAt: string;
}

export interface SignedBlob {
  blobHash: string;
  signature: string;
  did: string;
  publicKey: string;
}

/** Offline identity for step 5 — keypair + synthetic did:plc-style id. */
export async function createLocalIdentity(): Promise<LocalIdentity> {
  const keypair = await Secp256k1Keypair.create();
  const tag = crypto
    .createHash('sha256')
    .update(keypair.publicKeyBytes())
    .digest('base64url')
    .slice(0, 24);
  const did = `did:plc:${tag}`;
  return { did, keypair };
}

export async function createAccountOnPds(
  pdsUrl: string,
  handle: string,
  password: string,
  email?: string,
  actorStoreRoot = DEFAULT_PDS_ACTOR_STORE
): Promise<LocalIdentity> {
  const agent = new AtpAgent({ service: pdsUrl });
  await agent.createAccount({
    handle,
    password,
    email: email ?? `${handle.replace(/[^a-z0-9]/gi, '-')}@localhost.test`,
  });
  const did = agent.session?.did;
  if (!did) throw new Error('PDS did not return a DID');
  const keypair = await loadKeypairFromActorStore(did, actorStoreRoot);
  return { did, handle, keypair, agent };
}

export async function signBlob(
  did: string,
  keypair: Secp256k1Keypair,
  blobHash: string
): Promise<SignedBlob> {
  const payload = `${did}:${blobHash}`;
  const sig = await keypair.sign(new TextEncoder().encode(payload));
  return {
    blobHash,
    signature: Buffer.from(sig).toString('base64'),
    did,
    publicKey: keypair.publicKeyStr('hex'),
  };
}

export async function verifyBlobSignature(signed: SignedBlob): Promise<boolean> {
  const payload = new TextEncoder().encode(`${signed.did}:${signed.blobHash}`);
  const sig = Buffer.from(signed.signature, 'base64');
  const pub = new Uint8Array(Buffer.from(signed.publicKey, 'hex'));
  return verifySig(pub, payload, sig);
}

export { assignTranche } from '@/lib/tranches';

export async function publishPerformance(
  agent: AtpAgent,
  performance: PerformanceRecord
): Promise<string> {
  const tranche =
    performance.tranche ??
    assignTranche(performance.movement, performance.value, performance.unit);
  const record: PerformanceRecord = { ...performance, tranche };
  const res = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: PERFORMANCE_LEXICON,
    record: record as unknown as Record<string, unknown>,
  });
  return res.data.uri;
}

export async function getRecord(agent: AtpAgent, uri: string) {
  const withoutScheme = uri.replace(/^at:\/\//, '');
  const [did, collection, rkey] = withoutScheme.split('/');
  const res = await agent.com.atproto.repo.getRecord({ repo: did, collection, rkey });
  return res.data;
}

/** Resolve a DID document (PLC for did:plc, optional PDS fallback). */
export async function resolveDidDocument(
  did: string,
  pdsUrl?: string
): Promise<DidDocument | null> {
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`, {
      headers: { accept: 'application/did+ld+json, application/json' },
    });
    if (res.ok) {
      const doc = await res.json();
      if (isValidDidDoc(doc)) return doc;
    }
  }
  if (pdsUrl) {
    try {
      const agent = new AtpAgent({ service: pdsUrl });
      const { data } = await agent.com.atproto.identity.resolveDid({ did });
      if (data.didDoc && isValidDidDoc(data.didDoc)) return data.didDoc;
    } catch {
      // Local PDS often omits identity.resolveDid — PLC above covers did:plc.
    }
  }
  return null;
}

export async function verifyBlobSignatureAgainstDid(
  signed: SignedBlob,
  pdsUrl: string
): Promise<boolean> {
  const didDoc = await resolveDidDocument(signed.did, pdsUrl);
  if (!didDoc) return false;
  const didKey = getSigningDidKey(didDoc);
  if (!didKey) return false;
  const payload = new TextEncoder().encode(`${signed.did}:${signed.blobHash}`);
  const sig = Buffer.from(signed.signature, 'base64');
  return await verifySignature(didKey, payload, sig);
}

/** Publish the iroh peer id on the user's repo (latest wins on resolve). */
export async function announcePeerId(agent: AtpAgent, peerId: string): Promise<string> {
  const record: PeerRecord = {
    peerId,
    createdAt: new Date().toISOString(),
  };
  const res = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: PEER_LEXICON,
    record: record as unknown as Record<string, unknown>,
  });
  return res.data.uri;
}

/**
 * Resolve the latest iroh peer id for a DID by listing `app.sport.peer` records
 * on the PDS — no central registry, only the AT Protocol repo.
 */
export async function resolvePeerFromDID(did: string, pdsUrl: string): Promise<string | null> {
  const agent = new AtpAgent({ service: pdsUrl });
  const res = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection: PEER_LEXICON,
    limit: 100,
  });
  const latest = res.data.records
    .map((item) => item.value as unknown as PeerRecord)
    .filter((r) => typeof r.peerId === 'string' && typeof r.createdAt === 'string')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return latest[0]?.peerId ?? null;
}

/** List every repo DID on a PDS (local v0.5.x has sync.listRepos, not listReposByCollection). */
async function listAllRepoDids(agent: AtpAgent): Promise<string[]> {
  const dids: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await agent.com.atproto.sync.listRepos({ limit: 100, cursor });
    dids.push(...listed.data.repos.map((repo) => repo.did));
    cursor = listed.data.cursor;
  } while (cursor);
  return dids;
}

export async function getFeed(
  movement: string,
  tranche: string | undefined,
  pdsUrls: string[]
): Promise<Array<{ uri: string; record: PerformanceRecord; source: string }>> {
  const all: Array<{ uri: string; record: PerformanceRecord; source: string }> = [];

  for (const pdsUrl of pdsUrls) {
    const agent = new AtpAgent({ service: pdsUrl });
    const repoDids = await listAllRepoDids(agent);
    for (const did of repoDids) {
      const res = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: PERFORMANCE_LEXICON,
        limit: 100,
      });
      for (const item of res.data.records) {
        const record = item.value as unknown as PerformanceRecord;
        if (record.movement !== movement) continue;
        if (tranche && record.tranche !== tranche) continue;
        all.push({ uri: item.uri, record, source: pdsUrl });
      }
    }
  }

  return all.sort(
    (a, b) => new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
  );
}

export async function getLeaderboard(
  movement: string,
  tranche: string,
  pdsUrls: string[]
): Promise<Array<{ uri: string; record: PerformanceRecord }>> {
  const feed = await getFeed(movement, tranche, pdsUrls);
  return feed
    .map(({ uri, record }) => ({ uri, record }))
    .sort((a, b) => b.record.value - a.record.value);
}

export async function postComment(
  agent: AtpAgent,
  performanceUri: string,
  text: string
): Promise<string> {
  const record: CommentRecord = {
    performanceUri,
    text,
    createdAt: new Date().toISOString(),
  };
  const res = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: COMMENT_LEXICON,
    record: record as unknown as Record<string, unknown>,
  });
  return res.data.uri;
}

export async function getComments(
  performanceUri: string,
  pdsUrls: string[]
): Promise<
  Array<{ uri: string; record: CommentRecord; source: string; authorDid: string }>
> {
  const all: Array<{
    uri: string;
    record: CommentRecord;
    source: string;
    authorDid: string;
  }> = [];

  for (const pdsUrl of pdsUrls) {
    const agent = new AtpAgent({ service: pdsUrl });
    const repoDids = await listAllRepoDids(agent);
    for (const did of repoDids) {
      const res = await agent.com.atproto.repo.listRecords({
        repo: did,
        collection: COMMENT_LEXICON,
        limit: 100,
      });
      for (const item of res.data.records) {
        const record = item.value as unknown as CommentRecord;
        if (record.performanceUri !== performanceUri) continue;
        all.push({ uri: item.uri, record, source: pdsUrl, authorDid: did });
      }
    }
  }

  return all.sort(
    (a, b) =>
      new Date(a.record.createdAt).getTime() - new Date(b.record.createdAt).getTime()
  );
}

export async function getPerformanceByRkey(
  pdsUrl: string,
  did: string,
  rkey: string
): Promise<{ uri: string; record: PerformanceRecord }> {
  const agent = new AtpAgent({ service: pdsUrl });
  const res = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: PERFORMANCE_LEXICON,
    rkey,
  });
  return {
    uri: res.data.uri,
    record: res.data.value as unknown as PerformanceRecord,
  };
}

export function parsePerformanceUri(uri: string): { did: string; rkey: string } {
  const withoutScheme = uri.replace(/^at:\/\//, '');
  const [did, collection, rkey] = withoutScheme.split('/');
  if (!did || collection !== PERFORMANCE_LEXICON || !rkey) {
    throw new Error(`invalid performance URI: ${uri}`);
  }
  return { did, rkey };
}
