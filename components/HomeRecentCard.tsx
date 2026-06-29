import VideoPlayer from '@/components/VideoPlayer';
import { getDiscipline, getFamily } from '@/lib/db';
import type { FeedEntry } from '@/lib/feed-pagination';
import { formatMetricValue, type MetricType } from '@/lib/metrics';
import Link from 'next/link';

export default function HomeRecentCard({ item }: { item: FeedEntry }) {
  const discipline = getDiscipline(item.record.discipline);
  const family = discipline ? getFamily(discipline.family) : undefined;
  const metricDisplay = formatMetricValue(
    item.record.metricType as MetricType,
    item.record.value,
    item.record.unit
  );
  const href = `/performance/${item.rkey}?did=${encodeURIComponent(item.did)}`;
  const date = new Date(item.record.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <article
      data-testid={`home-recent-${item.rkey}`}
      className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video bg-neutral-950">
        {item.hashes.length > 0 ? (
          <VideoPlayer
            chunkManifest={item.hashes}
            peers={[item.peerId]}
            fill
            viewportAutoplay
            loop
            autoPlay={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            Vidéo indisponible
          </div>
        )}
      </div>
      <Link
        href={href}
        className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-neutral-50"
      >
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight text-neutral-900">
            {item.record.movement}
            {metricDisplay !== '—' ? (
              <span className="font-normal text-neutral-500"> · {metricDisplay}</span>
            ) : null}
          </h3>
          <p className="mt-1 truncate text-sm text-neutral-500">
            {family?.emoji ? `${family.emoji} ` : null}
            {discipline?.label ?? item.record.discipline}
          </p>
        </div>
        <time
          dateTime={item.record.createdAt}
          className="shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400"
        >
          {date}
        </time>
      </Link>
    </article>
  );
}
