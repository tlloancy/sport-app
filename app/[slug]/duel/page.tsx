export const dynamic = 'force-dynamic';

import DuelClient from '@/components/DuelClient';
import { getDiscipline, isActiveDiscipline } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type PageProps = {
  params: { slug: string };
};

export default function DisciplineDuelPage({ params }: PageProps) {
  const slug = params.slug.toLowerCase();

  if (!isActiveDiscipline(slug)) {
    notFound();
  }

  const discipline = getDiscipline(slug)!;
  const label = discipline.label;

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

      <DuelClient slug={slug} label={label} />
    </main>
  );
}
