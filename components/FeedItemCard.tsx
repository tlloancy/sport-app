'use client';

import ReportButton from '@/components/ReportButton';
import VideoPlayer from '@/components/VideoPlayer';
import { formatDidHandle } from '@/lib/did-display';
import type { FeedEntry } from '@/lib/feed-pagination';
import { formatMetricValue, type MetricType } from '@/lib/metrics';
import Link from 'next/link';

export default function FeedItemCard({ item }: { item: FeedEntry }) {
  const date = new Date(item.record.createdAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const metricDisplay = formatMetricValue(
    item.record.metricType as MetricType,
    item.record.value,
    item.record.unit
  );

  return (
    <article
      data-testid={`feed-item-${item.rkey}`}
      className="group flex h-[100dvh] snap-start flex-col overflow-hidden border-neutral-200/60 bg-white sm:border-r sm:last:border-r-0"
    >
      <div className="relative min-h-0 flex-1 bg-neutral-950">
        {item.hashes.length > 0 ? (
          <VideoPlayer
            chunkManifest={item.hashes}
            peers={[item.peerId]}
            viewportAutoplay
            fill
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            Vidéo indisponible
          </div>
        )}
      </div>
      <header className="shrink-0 border-t border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <h2 className="text-sm font-medium tracking-tight text-neutral-900">
          {item.record.movement}
          {metricDisplay !== '—' ? (
            <>
              <span className="mx-1.5 text-neutral-300">·</span>
              <span className="tabular-nums">{metricDisplay}</span>
            </>
          ) : null}
        </h2>
        <p className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
          <span className="flex items-center gap-2">
            <Link
              href={`/profile/${encodeURIComponent(item.did)}`}
              className="text-neutral-400 underline-offset-2 hover:text-neutral-700 hover:underline"
              data-testid={`feed-author-${item.rkey}`}
            >
              {formatDidHandle(item.did)}
            </Link>
          </span>
          <span className="flex items-center gap-2">
            <ReportButton
              uri={item.uri}
              context={`${item.record.discipline} · ${item.record.movement}`}
            />
            <time dateTime={item.record.createdAt}>{date}</time>
          </span>
        </p>
      </header>
    </article>
  );
}
