export const dynamic = 'force-dynamic';

import FamilyCard from '@/components/FamilyCard';
import HomeRecentStrip from '@/components/HomeRecentStrip';
import { loadFamilySummaries } from '@/lib/category-home';
import { loadRecentPerformances } from '@/lib/feed-server';
import Link from 'next/link';

export default async function HomePage() {
  let families: Awaited<ReturnType<typeof loadFamilySummaries>> = [];
  let recent: Awaited<ReturnType<typeof loadRecentPerformances>> = [];
  let error: string | null = null;

  try {
    [families, recent] = await Promise.all([
      loadFamilySummaries(),
      loadRecentPerformances(2),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Chargement impossible';
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-6 pb-6 pt-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Prove It</h1>
          <p className="mt-2 text-neutral-600">Poste ta perf. Elle t&apos;appartient.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 shrink-0 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          aria-label="Poster une performance"
        >
          + Perf
        </Link>
      </header>

      {error ? (
        <p className="mx-auto max-w-5xl px-6 text-sm text-red-600">{error}</p>
      ) : (
        <>
          <HomeRecentStrip items={recent} />

          {families.length === 0 ? (
            <p className="mx-auto max-w-5xl px-6 pt-8 text-neutral-500">
              Aucune famille configurée.
            </p>
          ) : (
            <section
              className="mx-auto max-w-5xl px-6 pb-12 pt-8"
              aria-labelledby="home-families-heading"
            >
              <h2
                id="home-families-heading"
                className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-400"
              >
                Parcourir
              </h2>
              <div
                data-testid="family-grid"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {families.map((family) => (
                  <FamilyCard key={family.slug} family={family} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
