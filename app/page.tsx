export const dynamic = 'force-dynamic';

import FamilyCard from '@/components/FamilyCard';
import { loadFamilySummaries } from '@/lib/category-home';
import Link from 'next/link';

export default async function HomePage() {
  let families: Awaited<ReturnType<typeof loadFamilySummaries>> = [];
  let error: string | null = null;

  try {
    families = await loadFamilySummaries();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Chargement impossible';
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-6 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Loading</h1>
          <p className="mt-2 text-neutral-600">Poste ta perf. Elle t&apos;appartient.</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
          aria-label="Poster une performance"
        >
          + Perf
        </Link>
      </header>

      {error ? (
        <p className="mx-auto max-w-5xl px-6 text-sm text-red-600">{error}</p>
      ) : families.length === 0 ? (
        <p className="mx-auto max-w-5xl px-6 text-neutral-500">Aucune famille configurée.</p>
      ) : (
        <div
          data-testid="family-grid"
          className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-12 sm:grid-cols-2 lg:grid-cols-3"
        >
          {families.map((family) => (
            <FamilyCard key={family.slug} family={family} />
          ))}
        </div>
      )}
    </main>
  );
}
