export const dynamic = 'force-dynamic';

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Feed — {movement}</h1>
      {items.length === 0 ? (
        <p data-testid="feed-empty" className="text-gray-500">
          No performances yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(({ uri, record }) => {
            const rkey = uri.split('/').pop()!;
            const did = uri.replace(/^at:\/\//, '').split('/')[0]!;
            return (
              <li
                key={uri}
                data-testid={`feed-item-${rkey}`}
                className="rounded-lg border p-4"
              >
                <Link
                  href={`/performance/${rkey}?did=${encodeURIComponent(did)}`}
                  className="font-medium hover:underline"
                >
                  {record.movement} — {record.value} {record.unit}
                </Link>
                <p className="text-sm text-gray-500">
                  tranche {record.tranche} · {new Date(record.createdAt).toLocaleString()}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
