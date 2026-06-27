import { getFeed, resolvePeerFromDID } from '@/lib/atproto';
import {
  FEED_PAGE_SIZE,
  feedTotalPages,
  paginateFeed,
  type FeedEntry,
  type FeedPagePayload,
} from '@/lib/feed-pagination';
import { pdsUrl, pdsUrls } from '@/lib/upload-agent';

export async function loadFeedPage(movement: string, page: number): Promise<FeedPagePayload> {
  const all = await getFeed(movement, undefined, pdsUrls());
  const total = all.length;
  const totalPages = feedTotalPages(total);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = paginateFeed(all, safePage);

  const peerCache = new Map<string, string>();
  const items: FeedEntry[] = [];

  for (const { uri, record } of slice) {
    const rkey = uri.split('/').pop()!;
    const did = uri.replace(/^at:\/\//, '').split('/')[0]!;
    let peerId = peerCache.get(did);
    if (!peerId) {
      peerId = (await resolvePeerFromDID(did, pdsUrl())) ?? 'local-peer';
      peerCache.set(did, peerId);
    }
    items.push({
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
    });
  }

  return {
    page: safePage,
    pageSize: FEED_PAGE_SIZE,
    totalPages,
    total,
    movement,
    items,
  };
}
