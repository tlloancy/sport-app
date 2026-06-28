import VideoPlayer from '@/components/VideoPlayer';
import type { CategorySummary } from '@/lib/category-home';
import Link from 'next/link';

export default function CategoryCard({ category }: { category: CategorySummary }) {
  const { slug, label, perfCount, latest } = category;

  return (
    <Link
      href={`/${slug}`}
      data-testid={`category-card-${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video bg-neutral-950">
        {latest && latest.hashes.length > 0 ? (
          <VideoPlayer
            chunkManifest={latest.hashes}
            peers={[latest.peerId]}
            fill
            autoPlay={false}
            viewportAutoplay={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            0 perf
          </div>
        )}
      </div>
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">{label}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {perfCount === 1 ? '1 perf' : `${perfCount} perf`}
        </p>
      </div>
    </Link>
  );
}
