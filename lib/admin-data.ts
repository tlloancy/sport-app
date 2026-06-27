import { getFeed } from '@/lib/atproto';
import { getModerationMap, listActiveCategories, listAllCategories } from '@/lib/db';
import { pdsUrls } from '@/lib/upload-agent';

export type AdminPerformance = {
  uri: string;
  rkey: string;
  movement: string;
  value: number;
  unit: string;
  tranche?: string;
  createdAt: string;
  hidden: boolean;
  deleted: boolean;
};

export async function listPerformancesForAdmin(): Promise<AdminPerformance[]> {
  const categories = listActiveCategories();
  const moderation = getModerationMap();
  const byUri = new Map<string, AdminPerformance>();

  for (const category of categories) {
    const feed = await getFeed(category.slug, undefined, pdsUrls());
    for (const { uri, record } of feed) {
      const mod = moderation.get(uri);
      byUri.set(uri, {
        uri,
        rkey: uri.split('/').pop()!,
        movement: record.movement,
        value: record.value,
        unit: record.unit,
        tranche: record.tranche,
        createdAt: record.createdAt,
        hidden: (mod?.hidden ?? 0) === 1,
        deleted: (mod?.deleted ?? 0) === 1,
      });
    }
  }

  return Array.from(byUri.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listCategoriesForAdmin() {
  return listAllCategories().map(({ slug, label, active }) => ({
    slug,
    label,
    active: active === 1,
  }));
}
