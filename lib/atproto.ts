import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AtpAgent } from '@atproto/api';
import { getSigningDidKey, isValidDidDoc, type DidDocument } from '@atproto/common-web';
import { Secp256k1Keypair, verifySignature } from '@atproto/crypto';
import { verifySig } from '@atproto/crypto/dist/secp256k1/operations.js';
import { normalizeMovement, getActiveDisciplineSlugs, listPerformanceIndexByDid, insertPerformanceIndex } from '@/lib/db';
import { compareMetricValues, isMetricType, type MetricType, type MetricUnit } from '@/lib/metrics';

export const PERFORMANCE_LEXICON = 'app.sport.performance' as const;
export const COMMENT_LEXICON = 'app.sport.comment' as const;
export const PEER_LEXICON = 'app.sport.peer' as const;

export const DEFAULT_PDS_URL = process.env.PDS_URL ?? 'http://127.0.0.1:2583';
export const DEFAULT_PDS2_URL = process.env.PDS2_URL ?? 'http://127.0.0.1:2584';

/** Non-empty PDS base URLs for feed / debug queries. */
export function defaultPdsUrls(): string[] {
  const urls = [DEFAULT_PDS_URL, DEFAULT_PDS2_URL].filter(
    (url): url is string => typeof url === 'string' && url.length > 0
  );
  return Array.from(new Set(urls));
}

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
  family: string;
  discipline: string;
  movement: string;
  metricType: MetricType;
  value?: number;
  unit?: MetricUnit;
  videoHash: string;
  chunkManifest?: string;
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

export async function publishPerformance(
  agent: AtpAgent,
  performance: PerformanceRecord
): Promise<string> {
  const res = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: PERFORMANCE_LEXICON,
    record: performance as unknown as Record<string, unknown>,
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
    const listed = await agent.api.com.atproto.sync.listRepos({ limit: 100, cursor });
    dids.push(...listed.data.repos.map((repo) => repo.did));
    cursor = listed.data.cursor;
  } while (cursor);
  return dids;
}

export async function resolvePublisherDid(): Promise<string | null> {
  const fromEnv = process.env.UPLOAD_DID?.trim();
  if (fromEnv) return fromEnv;
  try {
    const { getUploadAgent } = await import('@/lib/upload-agent');
    const agent = await getUploadAgent();
    return agent.session?.did ?? null;
  } catch {
    return null;
  }
}

/** Repos that may contain performance records — indexed scan, full scan, publisher fallback. */
async function collectPerformanceRepoDids(
  agent: AtpAgent,
  logs?: string[]
): Promise<string[]> {
  const log = (message: string) => logs?.push(message);
  const dids = new Set<string>();

  try {
    let cursor: string | undefined;
    do {
      const page = await agent.api.com.atproto.sync.listReposByCollection({
        collection: PERFORMANCE_LEXICON,
        limit: 100,
        cursor,
      });
      for (const repo of page.data.repos ?? []) {
        if (repo.did) dids.add(repo.did);
      }
      cursor = page.data.cursor;
    } while (cursor);
    log(`listReposByCollection: ${dids.size} repo(s)`);
  } catch (err) {
    log(
      `listReposByCollection failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (dids.size === 0) {
    try {
      for (const did of await listAllRepoDids(agent)) {
        dids.add(did);
      }
      log(`listRepos fallback: ${dids.size} repo(s)`);
    } catch (err) {
      log(`listRepos failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const publisherDid = await resolvePublisherDid();
  if (publisherDid) {
    dids.add(publisherDid);
    log(`publisher DID included: ${publisherDid}`);
  }

  return Array.from(dids);
}

function parseNumericValue(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function coercePerformanceRecord(value: unknown): PerformanceRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  const movementRaw = typeof raw.movement === 'string' ? raw.movement.trim() : '';
  if (!movementRaw) return null;

  const videoHash = typeof raw.videoHash === 'string' ? raw.videoHash : '';
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : '';
  if (!videoHash || !createdAt) return null;

  const activeDisciplines = getActiveDisciplineSlugs();
  let discipline =
    typeof raw.discipline === 'string'
      ? raw.discipline.trim().toLowerCase()
      : typeof raw.category === 'string'
        ? raw.category.trim().toLowerCase()
        : '';
  let movement = movementRaw;

  // Legacy flat category: movement field was the discipline slug (e.g. "snatch").
  if (!discipline && activeDisciplines.has(movementRaw.toLowerCase())) {
    discipline = movementRaw.toLowerCase();
    movement = movementRaw.toLowerCase();
  }

  if (!discipline) return null;

  const metricTypeRaw = typeof raw.metricType === 'string' ? raw.metricType : 'weight';
  const metricType: MetricType = isMetricType(metricTypeRaw) ? metricTypeRaw : 'weight';
  const family = typeof raw.family === 'string' ? raw.family.trim().toLowerCase() : 'sport';

  const record: PerformanceRecord = {
    family,
    discipline,
    movement,
    metricType,
    videoHash,
    createdAt,
  };

  if (typeof raw.chunkManifest === 'string') {
    record.chunkManifest = raw.chunkManifest;
  }

  if (metricType !== 'none') {
    const value = parseNumericValue(raw.value);
    if (value != null) {
      record.value = value;
      if (typeof raw.unit === 'string') {
        record.unit = raw.unit as MetricUnit;
      }
    }
  }

  return record;
}

function coercePerformanceRecordReason(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'not an object';
  const raw = value as Record<string, unknown>;
  if (typeof raw.movement !== 'string' || !raw.movement.trim()) return 'movement missing';
  if (typeof raw.videoHash !== 'string' || !raw.videoHash) return 'videoHash missing';
  if (typeof raw.createdAt !== 'string' || !raw.createdAt) return 'createdAt missing';
  const discipline =
    typeof raw.discipline === 'string'
      ? raw.discipline.trim()
      : typeof raw.category === 'string'
        ? raw.category.trim()
        : '';
  if (!discipline) return 'discipline/category missing';
  return null;
}

/** Paginate com.atproto.repo.listRecords for one repo + collection. */
async function fetchRecordPages(
  agent: AtpAgent,
  repo: string,
  collection: string
): Promise<Array<{ uri: string; value: unknown }>> {
  const all: Array<{ uri: string; value: unknown }> = [];
  let cursor: string | undefined;
  do {
    const page = await agent.api.com.atproto.repo.listRecords({
      repo,
      collection,
      limit: 100,
      reverse: true,
      cursor,
    });
    all.push(...page.data.records);
    cursor = page.data.cursor;
  } while (cursor);
  return all;
}

/** Paginate all records in a repo (no collection filter). */
async function fetchAllRepoRecordPages(
  agent: AtpAgent,
  repo: string
): Promise<Array<{ uri: string; value: unknown }>> {
  const all: Array<{ uri: string; value: unknown }> = [];
  let cursor: string | undefined;
  do {
    const page = await agent.api.com.atproto.repo.listRecords({
      repo,
      limit: 100,
      reverse: true,
      cursor,
    } as { repo: string; collection: string; limit: number; reverse: boolean; cursor?: string });
    all.push(...page.data.records);
    cursor = page.data.cursor;
  } while (cursor);
  return all;
}

function filterCollectionRecords(
  records: Array<{ uri: string; value: unknown }>,
  collection: string
): Array<{ uri: string; value: unknown }> {
  const prefix = `/${collection}/`;
  return records.filter((item) => item.uri.includes(prefix));
}

/** List performance records — collection index first, then whole-repo fallback. */
async function listPerformanceRecords(
  agent: AtpAgent,
  repo: string,
  logs?: string[]
): Promise<Array<{ uri: string; value: unknown }>> {
  const log = (message: string) => logs?.push(message);
  const byUri = new Map<string, { uri: string; value: unknown }>();

  const merge = (records: Array<{ uri: string; value: unknown }>) => {
    for (const item of records) {
      byUri.set(item.uri, item);
    }
  };

  const byCollection = await fetchRecordPages(agent, repo, PERFORMANCE_LEXICON);
  merge(byCollection);
  log(`listRecords(collection): ${byCollection.length} record(s)`);

  try {
    const wholeRepo = filterCollectionRecords(
      await fetchAllRepoRecordPages(agent, repo),
      PERFORMANCE_LEXICON
    );
    log(`listRecords(repo-wide): ${wholeRepo.length} performance record(s)`);
    if (wholeRepo.length > byUri.size) {
      log(`repo-wide listing found ${wholeRepo.length - byUri.size} extra record(s)`);
      merge(wholeRepo);
    }
  } catch (err) {
    log(
      `listRecords(repo-wide) failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    const described = await agent.com.atproto.repo.describeRepo({ repo });
    log(`describeRepo: ${JSON.stringify(described.data.collections ?? [])}`);
  } catch {
    // describeRepo optional on some PDS builds
  }

  const listedUris = new Set(byUri.keys());
  for (const entry of listPerformanceIndexByDid(repo)) {
    if (listedUris.has(entry.uri)) continue;
    try {
      const res = await agent.com.atproto.repo.getRecord({
        repo,
        collection: PERFORMANCE_LEXICON,
        rkey: entry.rkey,
      });
      byUri.set(res.data.uri, { uri: res.data.uri, value: res.data.value });
      log(`getRecord index fallback: ${res.data.uri}`);
    } catch (err) {
      log(
        `getRecord index fallback failed for ${entry.rkey}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  return Array.from(byUri.values());
}

/** Fetch one performance by rkey and persist in local index (when listRecords misses it). */
export async function indexPerformanceByRkey(
  agent: AtpAgent,
  did: string,
  rkey: string
): Promise<{ uri: string; record: PerformanceRecord } | null> {
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: PERFORMANCE_LEXICON,
      rkey,
    });
    const record = coercePerformanceRecord(res.data.value);
    if (!record) return null;
    insertPerformanceIndex(res.data.uri, did, rkey, record.discipline, record.createdAt);
    return { uri: res.data.uri, record };
  } catch {
    return null;
  }
}

export async function getFeed(
  discipline: string,
  movement: string | undefined,
  pdsUrls: string[],
  logs?: string[]
): Promise<Array<{ uri: string; record: PerformanceRecord; source: string }>> {
  const log = (message: string) => {
    console.log('[getFeed]', message);
    logs?.push(message);
  };

  const disciplineSlug = discipline.trim().toLowerCase();
  const movementSlug = movement ? normalizeMovement(movement) : undefined;

  log(`discipline=${disciplineSlug} movement=${movementSlug ?? '(any)'}`);
  log(`PDS URLs: ${JSON.stringify(pdsUrls)}`);

  if (!pdsUrls.length) {
    log('ERROR: pdsUrls is empty — nothing to query');
    return [];
  }

  const results: Array<{ uri: string; record: PerformanceRecord; source: string }> = [];

  for (const pdsUrl of pdsUrls) {
    try {
      log(`Connecting to ${pdsUrl}`);
      const agent = new AtpAgent({ service: pdsUrl });

      const repoDids = await collectPerformanceRepoDids(agent, logs);
      log(`Scanning ${repoDids.length} repo(s) on ${pdsUrl}`);

      for (const did of repoDids) {
        log(`Scanning DID: ${did}`);
        try {
          const records = await listPerformanceRecords(agent, did, logs);
          log(`Found ${records.length} records for ${did} (all pages)`);

          for (const item of records) {
            const record = coercePerformanceRecord(item.value);
            if (!record) {
              const reason = coercePerformanceRecordReason(item.value) ?? 'unknown';
              log(`Skip ${item.uri}: record format invalide (${reason})`);
              continue;
            }
            const activeDisciplines = getActiveDisciplineSlugs();
            if (!activeDisciplines.has(record.discipline.trim().toLowerCase())) {
              log(`Skip ${item.uri}: discipline "${record.discipline}" inactive`);
              continue;
            }
            if (record.discipline.trim().toLowerCase() !== disciplineSlug) {
              log(
                `Skip ${item.uri}: discipline "${record.discipline}" ≠ "${disciplineSlug}"`
              );
              continue;
            }
            if (
              movementSlug &&
              normalizeMovement(record.movement) !== movementSlug
            ) {
              log(
                `Skip ${item.uri}: movement "${record.movement}" ≠ "${movementSlug}"`
              );
              continue;
            }
            log(`Match ${item.uri}`);
            results.push({ uri: item.uri, record, source: pdsUrl });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log(`ERROR listRecords for ${did}: ${message}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`ERROR on ${pdsUrl}: ${message}`);
    }
  }

  log(`Matched performances: ${results.length}`);
  return results.sort(
    (a, b) => new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
  );
}

/** All performance records for one DID (across configured PDS URLs). */
export async function getPerformancesByDid(
  did: string,
  pdsUrls: string[]
): Promise<Array<{ uri: string; rkey: string; record: PerformanceRecord; source: string }>> {
  const results: Array<{
    uri: string;
    rkey: string;
    record: PerformanceRecord;
    source: string;
  }> = [];

  for (const pdsUrl of pdsUrls) {
    try {
      const agent = new AtpAgent({ service: pdsUrl });
      const records = await listPerformanceRecords(agent, did);
      for (const item of records) {
        const record = coercePerformanceRecord(item.value);
        if (!record) continue;
        results.push({
          uri: item.uri,
          rkey: item.uri.split('/').pop()!,
          record,
          source: pdsUrl,
        });
      }
    } catch {
      // DID may not exist on this PDS
    }
  }

  return results.sort(
    (a, b) => new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
  );
}

export async function getLeaderboard(
  discipline: string,
  movement: string,
  pdsUrls: string[]
): Promise<Array<{ uri: string; record: PerformanceRecord }>> {
  const feed = await getFeed(discipline, movement, pdsUrls);
  const metricType = feed[0]?.record.metricType ?? 'score';
  return feed
    .filter(({ record }) => record.value != null)
    .map(({ uri, record }) => ({ uri, record }))
    .sort((a, b) =>
      compareMetricValues(metricType, b.record.value!, a.record.value!)
    );
}

export async function listMovementsForDiscipline(
  discipline: string,
  pdsUrls: string[]
): Promise<string[]> {
  const feed = await getFeed(discipline, undefined, pdsUrls);
  const movements = new Set<string>();
  for (const { record } of feed) {
    movements.add(normalizeMovement(record.movement));
  }
  return Array.from(movements).sort((a, b) => a.localeCompare(b));
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
      const records = await fetchRecordPages(agent, did, COMMENT_LEXICON);
      for (const item of records) {
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
