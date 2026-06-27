'use client';

import VideoPlayer from '@/components/VideoPlayer';
import type { FeedEntry } from '@/lib/feed-pagination';

export default function FeedItemCard({ item }: { item: FeedEntry }) {
  const date = new Date(item.record.createdAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article
      data-testid={`feed-item-${item.rkey}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.15)]"
    >
      <div className="aspect-video w-full overflow-hidden bg-neutral-950">
        {item.hashes.length > 0 ? (
          <VideoPlayer
            chunkManifest={item.hashes}
            peers={[item.peerId]}
            autoPlay={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            Vidéo indisponible
          </div>
        )}
      </div>
      <header className="border-t border-neutral-100 px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight text-neutral-900">
          {item.record.movement}
          <span className="mx-1.5 text-neutral-300">·</span>
          <span className="tabular-nums">
            {item.record.value} {item.record.unit}
          </span>
        </h2>
        <p className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Tranche {item.record.tranche ?? '—'}</span>
          <time dateTime={item.record.createdAt}>{date}</time>
        </p>
      </header>
    </article>
  );
}
