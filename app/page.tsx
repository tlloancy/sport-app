export const dynamic = 'force-dynamic';

import CategoryCard from '@/components/CategoryCard';
import { loadCategorySummaries } from '@/lib/category-home';
import { pdsUrls } from '@/lib/upload-agent';
import Link from 'next/link';

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof loadCategorySummaries>> = [];
  let error: string | null = null;

  if (pdsUrls().length === 0) {
    error = 'Aucune URL PDS configurée (PDS_URL vide).';
  } else {
    try {
      categories = await loadCategorySummaries();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Chargement impossible';
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-6 py-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sport</h1>
          <p className="mt-2 text-neutral-600">Choisis une catégorie</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          Poster une perf
        </Link>
      </header>

      {error ? (
        <p className="mx-auto max-w-5xl px-6 text-sm text-red-600">{error}</p>
      ) : categories.length === 0 ? (
        <p className="mx-auto max-w-5xl px-6 text-neutral-500">Aucune catégorie active.</p>
      ) : (
        <div
          data-testid="category-grid"
          className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-12 sm:grid-cols-2 lg:grid-cols-3"
        >
          {categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      )}
    </main>
  );
}
