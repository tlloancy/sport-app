export const dynamic = 'force-dynamic';

import DisciplineCard from '@/components/DisciplineCard';
import { loadDisciplineSummaries } from '@/lib/category-home';
import { getFamily, isValidFamily } from '@/lib/db';
import { buildUploadHref } from '@/lib/upload-links';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { family: string };
};

export default async function FamilyPage({ params }: PageProps) {
  const familySlug = params.family.toLowerCase();

  if (!isValidFamily(familySlug)) {
    notFound();
  }

  const family = getFamily(familySlug)!;
  let disciplines: Awaited<ReturnType<typeof loadDisciplineSummaries>> = [];
  let error: string | null = null;

  try {
    disciplines = await loadDisciplineSummaries(familySlug);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Chargement impossible';
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Accueil
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {family.emoji} {family.label}
            </h1>
            <p className="mt-2 text-neutral-600">Choisis une discipline.</p>
          </div>
          <Link
            href={buildUploadHref(familySlug)}
            className="inline-flex h-10 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white"
          >
            + Perf
          </Link>
        </div>
      </header>

      {error ? (
        <p className="mx-auto max-w-5xl px-6 text-sm text-red-600">{error}</p>
      ) : disciplines.length === 0 ? (
        <p className="mx-auto max-w-5xl px-6 text-neutral-500">Aucune discipline active.</p>
      ) : (
        <div
          data-testid="discipline-grid"
          className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-12 sm:grid-cols-2 lg:grid-cols-3"
        >
          {disciplines.map((discipline) => (
            <DisciplineCard key={discipline.slug} discipline={discipline} />
          ))}
        </div>
      )}
    </main>
  );
}
