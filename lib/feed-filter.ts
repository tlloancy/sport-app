import {
  getActiveCategorySlugs,
  getModeratedOutUris,
  normalizeMovementSlug,
} from '@/lib/db';

export type FeedRecordLike = {
  uri: string;
  record: { movement: string };
};

export function filterFeedItems<T extends FeedRecordLike>(items: T[]): T[] {
  const activeSlugs = getActiveCategorySlugs();
  const moderatedOut = getModeratedOutUris();

  return items.filter((item) => {
    const slug = normalizeMovementSlug(item.record.movement);
    if (!activeSlugs.has(slug)) return false;
    if (moderatedOut.has(item.uri)) return false;
    return true;
  });
}
