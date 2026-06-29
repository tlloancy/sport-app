import { getFeed, resolvePeerFromDID, type PerformanceRecord } from '@/lib/atproto';
import { isActiveDiscipline, listActiveDisciplines } from '@/lib/db';
import { filterFeedItems } from '@/lib/feed-filter';
import { getGatewayPeerId } from '@/lib/p2p-gateway';
import {
  FEED_PAGE_SIZE,
  feedTotalPages,
  paginateFeed,
  type FeedEntry,
  type FeedPagePayload,
} from '@/lib/feed-pagination';
import { pdsUrl, pdsUrls } from '@/lib/upload-agent';

async function buildFeedEntries(
  items: Array<{ uri: string; record: PerformanceRecord }>
): Promise<FeedEntry[]> {
  const peerCache = new Map<string, string>();
  const entries: FeedEntry[] = [];

  for (const { uri, record } of items) {
    const rkey = uri.split('/').pop()!;
    const did = uri.replace(/^at:\/\//, '').split('/')[0]!;
    let peerId = peerCache.get(did);
    if (!peerId) {
      peerId =
        (await resolvePeerFromDID(did, pdsUrl())) ?? (await getGatewayPeerId()) ?? 'local-peer';
      peerCache.set(did, peerId);
    }
    entries.push({
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
    });
  }

  return entries;
}

export async function loadRecentPerformances(limit = 2): Promise<FeedEntry[]> {
  if (pdsUrls().length === 0 || limit <= 0) return [];

  const merged: FeedEntry[] = [];

  for (const { slug } of listActiveDisciplines()) {
    const raw = filterFeedItems(await getFeed(slug, undefined, pdsUrls()));
    if (raw.length === 0) continue;
    merged.push(...(await buildFeedEntries(raw)));
  }

  return merged
    .sort(
      (a, b) =>
        new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
    )
    .slice(0, limit);
}

export async function loadFeedPage(discipline: string, page: number): Promise<FeedPagePayload> {
  const slug = discipline.trim().toLowerCase();
  if (!isActiveDiscipline(slug)) {
    return {
      page: 1,
      pageSize: FEED_PAGE_SIZE,
      totalPages: 1,
      total: 0,
      discipline: slug,
      items: [],
    };
  }

  const raw = await getFeed(slug, undefined, pdsUrls());
  const all = filterFeedItems(raw);
  const total = all.length;
  const totalPages = feedTotalPages(total);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = paginateFeed(all, safePage);
  const items = await buildFeedEntries(slice);

  return {
    page: safePage,
    pageSize: FEED_PAGE_SIZE,
    totalPages,
    total,
    discipline: slug,
    items,
  };
}
