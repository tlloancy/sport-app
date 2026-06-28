import { getFeed, resolvePeerFromDID, type PerformanceRecord } from '@/lib/atproto';
import { getEloScoresForUris, isActiveDiscipline, normalizeMovement } from '@/lib/db';
import { filterFeedItems } from '@/lib/feed-filter';
import type { FeedEntry } from '@/lib/feed-pagination';
import { getGatewayPeerId } from '@/lib/p2p-gateway';
import { pdsUrl, pdsUrls } from '@/lib/upload-agent';

export type DuelPair = {
  a: FeedEntry;
  b: FeedEntry;
  movement: string;
};

async function toFeedEntry(
  uri: string,
  record: PerformanceRecord,
  peerCache: Map<string, string>
): Promise<FeedEntry> {
  const rkey = uri.split('/').pop()!;
  const did = uri.replace(/^at:\/\//, '').split('/')[0]!;
  let peerId = peerCache.get(did);
  if (!peerId) {
    peerId =
      (await resolvePeerFromDID(did, pdsUrl())) ?? (await getGatewayPeerId()) ?? 'local-peer';
    peerCache.set(did, peerId);
  }
  return {
    uri,
    rkey,
    did,
    peerId,
    hashes: record.chunkManifest ? (JSON.parse(record.chunkManifest) as string[]) : [],
    record: {
      family: record.family,
      discipline: record.discipline,
      movement: record.movement,
      metricType: record.metricType,
      value: record.value,
      unit: record.unit,
      createdAt: record.createdAt,
      videoHash: record.videoHash,
    },
  };
}

type RawItem = { uri: string; record: PerformanceRecord };

function pairVoteSum(
  a: RawItem,
  b: RawItem,
  eloMap: Map<string, { vote_count: number }>
): number {
  return (eloMap.get(a.uri)?.vote_count ?? 0) + (eloMap.get(b.uri)?.vote_count ?? 0);
}

function pickLowestVotePair(
  pool: RawItem[],
  eloMap: Map<string, { vote_count: number }>
): [RawItem, RawItem] | null {
  if (pool.length < 2) return null;

  let bestSum = Infinity;
  const ties: Array<[RawItem, RawItem]> = [];

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i]!;
      const b = pool[j]!;
      const sum = pairVoteSum(a, b, eloMap);
      if (sum < bestSum) {
        bestSum = sum;
        ties.length = 0;
        ties.push([a, b]);
      } else if (sum === bestSum) {
        ties.push([a, b]);
      }
    }
  }

  if (ties.length === 0) return null;
  return ties[Math.floor(Math.random() * ties.length)]!;
}

/** Duel pair: same discipline + movement, lowest combined vote_count first. */
export async function pickDuelPair(disciplineSlug: string): Promise<DuelPair | null> {
  if (!isActiveDiscipline(disciplineSlug)) return null;

  const raw = filterFeedItems(await getFeed(disciplineSlug, undefined, pdsUrls()));
  if (raw.length < 2) return null;

  const uris = raw.map((item) => item.uri);
  const eloMap = getEloScoresForUris(uris);

  const byMovement = new Map<string, RawItem[]>();
  for (const item of raw) {
    const movement = normalizeMovement(item.record.movement);
    const list = byMovement.get(movement) ?? [];
    list.push({ uri: item.uri, record: item.record });
    byMovement.set(movement, list);
  }

  const movementEntries = Array.from(byMovement.entries()).filter(([, items]) => items.length >= 2);
  if (movementEntries.length === 0) return null;

  movementEntries.sort(([, poolA], [, poolB]) => {
    const minA = Math.min(
      ...poolA.flatMap((a, i) =>
        poolA.slice(i + 1).map((b) => pairVoteSum(a, b, eloMap))
      )
    );
    const minB = Math.min(
      ...poolB.flatMap((a, i) =>
        poolB.slice(i + 1).map((b) => pairVoteSum(a, b, eloMap))
      )
    );
    return minA - minB;
  });

  for (const [movement, pool] of movementEntries) {
    const picked = pickLowestVotePair(pool, eloMap);
    if (!picked) continue;
    const [first, second] = picked;
    const peerCache = new Map<string, string>();
    const a = await toFeedEntry(first.uri, first.record, peerCache);
    const b = await toFeedEntry(second.uri, second.record, peerCache);
    return { a, b, movement };
  }

  return null;
}

export type DuelApiPayload = DuelPair | { pair: null };

export function duelPairToJson(pair: DuelPair): DuelApiPayload {
  return pair;
}
