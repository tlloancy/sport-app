export const dynamic = 'force-dynamic';

import DuelPreview from '@/components/DuelPreview';
import { pickDuelPair } from '@/lib/duel-pair';
import { isActiveCategory, listActiveCategories } from '@/lib/db';
import { pdsUrls } from '@/lib/upload-agent';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { slug: string };
};

export default async function CategoryDuelPage({ params }: PageProps) {
  const slug = params.slug.toLowerCase();

  if (!isActiveCategory(slug)) {
    notFound();
  }

  const category = listActiveCategories().find((c) => c.slug === slug);
  const label = category?.label ?? slug;

  if (pdsUrls().length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-600">Aucune URL PDS configurée.</p>
        <Link href={`/${slug}`} className="mt-4 inline-block text-sm text-neutral-500">
          Retour au feed
        </Link>
      </main>
    );
  }

  const pair = await pickDuelPair(slug);

  return (
    <main className="min-h-[100dvh] bg-white">
      <div className="fixed right-6 top-5 z-30 flex gap-4 text-sm">
        <Link href={`/${slug}`} className="text-neutral-500 hover:text-neutral-900">
          Feed
        </Link>
        <Link href="/" className="text-neutral-500 hover:text-neutral-900">
          Accueil
        </Link>
      </div>

      {pair ? (
        <DuelPreview pair={pair} label={label} />
      ) : (
        <div
          data-testid="duel-empty"
          className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
        >
          <p className="text-neutral-600">
            Pas assez de performances dans la même tranche pour un duel.
          </p>
          <Link href={`/${slug}`} className="mt-4 text-sm text-neutral-500 underline">
            Retour au feed {label}
          </Link>
        </div>
      )}
    </main>
  );
}
