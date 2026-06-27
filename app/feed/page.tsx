export const dynamic = 'force-dynamic';

import FeedItem from '@/components/FeedItem';
import { getFeed } from '@/lib/atproto';
import { pdsUrl } from '@/lib/upload-agent';
import Link from 'next/link';

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { movement?: string };
}) {
  const movement = searchParams.movement ?? 'snatch';
  let items: Awaited<ReturnType<typeof getFeed>> = [];
  try {
    items = await getFeed(movement, undefined, [pdsUrl()]);
  } catch {
    items = [];
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold">Feed</h1>
        <Link href="/" className="text-sm text-neutral-500">
          Accueil
        </Link>
      </header>

      {items.length === 0 ? (
        <p data-testid="feed-empty" className="text-neutral-500">
          Aucune performance pour l&apos;instant.
        </p>
      ) : (
        <section>
          {items.map(({ uri, record }) => (
            <FeedItem key={uri} uri={uri} record={record} />
          ))}
        </section>
      )}
    </main>
  );
}
