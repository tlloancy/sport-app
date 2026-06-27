export const dynamic = 'force-dynamic';

import FeedPaginator from '@/components/FeedPaginator';
import { loadFeedPage } from '@/lib/feed-server';
import { FEED_PAGE_SIZE, type FeedPagePayload } from '@/lib/feed-pagination';
import { pdsUrls } from '@/lib/upload-agent';
import Link from 'next/link';

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { movement?: string; page?: string };
}) {
  const movement = searchParams.movement ?? 'snatch';
  const page = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1);

  let initial: FeedPagePayload = {
    page: 1,
    pageSize: FEED_PAGE_SIZE,
    totalPages: 1,
    total: 0,
    movement,
    items: [],
  };
  let feedError: string | null = null;

  if (pdsUrls().length === 0) {
    feedError = 'Aucune URL PDS configurée (PDS_URL vide).';
  } else {
    try {
      initial = await loadFeedPage(movement, page);
    } catch (err) {
      feedError = err instanceof Error ? err.message : 'getFeed a échoué';
    }
  }

  return (
    <main className="min-h-[100dvh] bg-white">
      {feedError ? (
        <div className="mx-auto max-w-5xl px-6 py-10">
          <header className="mb-8 border-b border-neutral-200 pb-6">
            <h1 className="text-xl font-semibold tracking-tight">Feed</h1>
          </header>
          <p data-testid="feed-error" className="text-sm text-red-600">
            {feedError}
          </p>
          <Link href="/" className="mt-6 inline-block text-sm text-neutral-500">
            Accueil
          </Link>
        </div>
      ) : (
        <FeedPaginator movement={movement} initial={initial} />
      )}
    </main>
  );
}
