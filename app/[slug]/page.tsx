export const dynamic = 'force-dynamic';

import FeedPaginator from '@/components/FeedPaginator';
import { isActiveCategory, listActiveCategories } from '@/lib/db';
import { loadFeedPage } from '@/lib/feed-server';
import { FEED_PAGE_SIZE, type FeedPagePayload } from '@/lib/feed-pagination';
import { pdsUrls } from '@/lib/upload-agent';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { slug: string };
  searchParams: { page?: string };
};

export default async function CategoryFeedPage({ params, searchParams }: PageProps) {
  const slug = params.slug.toLowerCase();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1);

  if (!isActiveCategory(slug)) {
    notFound();
  }

  const category = listActiveCategories().find((c) => c.slug === slug);
  const label = category?.label ?? slug;

  let initial: FeedPagePayload = {
    page: 1,
    pageSize: FEED_PAGE_SIZE,
    totalPages: 1,
    total: 0,
    movement: slug,
    items: [],
  };
  let feedError: string | null = null;

  if (pdsUrls().length === 0) {
    feedError = 'Aucune URL PDS configurée (PDS_URL vide).';
  } else {
    try {
      initial = await loadFeedPage(slug, page);
    } catch (err) {
      feedError = err instanceof Error ? err.message : 'getFeed a échoué';
    }
  }

  return (
    <main className="min-h-[100dvh] bg-white">
      {feedError ? (
        <div className="mx-auto max-w-5xl px-6 py-10">
          <header className="mb-8 border-b border-neutral-200 pb-6">
            <h1 className="text-xl font-semibold tracking-tight">{label}</h1>
          </header>
          <p data-testid="feed-error" className="text-sm text-red-600">
            {feedError}
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-neutral-500">
            Accueil
          </Link>
        </div>
      ) : (
        <FeedPaginator slug={slug} label={label} initial={initial} />
      )}
    </main>
  );
}
