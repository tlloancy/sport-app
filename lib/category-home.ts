import { listActiveCategories } from '@/lib/db';
import { loadFeedPage } from '@/lib/feed-server';
import type { FeedEntry } from '@/lib/feed-pagination';

export type CategorySummary = {
  slug: string;
  label: string;
  perfCount: number;
  latest: FeedEntry | null;
};

export async function loadCategorySummaries(): Promise<CategorySummary[]> {
  const categories = listActiveCategories();
  const summaries: CategorySummary[] = [];

  for (const { slug, label } of categories) {
    const page = await loadFeedPage(slug, 1);
    summaries.push({
      slug,
      label,
      perfCount: page.total,
      latest: page.items[0] ?? null,
    });
  }

  return summaries;
}

export function getDefaultCategorySlug(): string {
  const categories = listActiveCategories();
  return categories[0]?.slug ?? 'snatch';
}
