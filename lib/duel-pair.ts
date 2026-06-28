import { getFeed, resolvePeerFromDID, type PerformanceRecord } from '@/lib/atproto';
import { isActiveCategory } from '@/lib/db';
import { filterFeedItems } from '@/lib/feed-filter';
import type { FeedEntry } from '@/lib/feed-pagination';
import { getGatewayPeerId } from '@/lib/p2p-gateway';
import { pdsUrl, pdsUrls } from '@/lib/upload-agent';

export type DuelPair = {
  a: FeedEntry;
  b: FeedEntry;
  tranche: string;
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
      movement: record.movement,
      value: record.value,
      unit: record.unit,
      tranche: record.tranche,
      createdAt: record.createdAt,
      videoHash: record.videoHash,
    },
  };
}

/** Pick two performances in the same tranche for a category (duel preview). */
export async function pickDuelPair(slug: string): Promise<DuelPair | null> {
  if (!isActiveCategory(slug)) return null;

  const raw = filterFeedItems(await getFeed(slug, undefined, pdsUrls()));
  const withTranche = raw.filter((item) => item.record.tranche);
  if (withTranche.length < 2) return null;

  const byTranche = new Map<string, typeof withTranche>();
  for (const item of withTranche) {
    const t = item.record.tranche!;
    const list = byTranche.get(t) ?? [];
    list.push(item);
    byTranche.set(t, list);
  }

  const eligible = Array.from(byTranche.entries()).filter(([, items]) => items.length >= 2);
  if (eligible.length === 0) return null;

  const [tranche, pool] = eligible[Math.floor(Math.random() * eligible.length)]!;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const [first, second] = shuffled;
  if (!first || !second) return null;

  const peerCache = new Map<string, string>();
  const a = await toFeedEntry(first.uri, first.record, peerCache);
  const b = await toFeedEntry(second.uri, second.record, peerCache);

  return { a, b, tranche };
}
