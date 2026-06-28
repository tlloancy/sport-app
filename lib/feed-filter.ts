import {
  getActiveDisciplineSlugs,
  getModeratedOutUris,
  normalizeMovement,
} from '@/lib/db';
import type { PerformanceRecord } from '@/lib/atproto';

export type FeedRecordLike = {
  uri: string;
  record: Pick<PerformanceRecord, 'discipline'>;
};

export function filterFeedItems<T extends FeedRecordLike>(items: T[]): T[] {
  const activeSlugs = getActiveDisciplineSlugs();
  const moderatedOut = getModeratedOutUris();

  return items.filter((item) => {
    const slug = item.record.discipline.trim().toLowerCase();
    if (!activeSlugs.has(slug)) return false;
    if (moderatedOut.has(item.uri)) return false;
    return true;
  });
}

export { normalizeMovement };
