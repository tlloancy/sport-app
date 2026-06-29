import HomeRecentCard from '@/components/HomeRecentCard';
import type { FeedEntry } from '@/lib/feed-pagination';

export default function HomeRecentStrip({ items }: { items: FeedEntry[] }) {
  if (items.length === 0) return null;

  return (
    <section
      data-testid="home-recent-strip"
      className="mx-auto max-w-5xl border-b border-neutral-100 px-6 pb-10"
      aria-labelledby="home-recent-heading"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          id="home-recent-heading"
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400"
        >
          Récent
        </h2>
        <span className="text-xs text-neutral-400">
          {items.length === 1 ? '1 perf' : `${items.length} perfs`}
        </span>
      </div>
      <div
        className={`grid gap-4 ${items.length > 1 ? 'sm:grid-cols-2' : 'max-w-xl'}`}
      >
        {items.map((item) => (
          <HomeRecentCard key={item.uri} item={item} />
        ))}
      </div>
    </section>
  );
}
