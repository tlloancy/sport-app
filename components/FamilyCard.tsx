import Link from 'next/link';
import type { FamilySummary } from '@/lib/category-home';

export default function FamilyCard({ family }: { family: FamilySummary }) {
  const { slug, label, emoji, disciplineCount } = family;

  return (
    <Link
      href={`/famille/${slug}`}
      data-testid={`family-card-${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="flex aspect-video items-center justify-center bg-neutral-50 text-5xl">
        {emoji}
      </div>
      <div className="px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight text-neutral-900">{label}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {disciplineCount === 1 ? '1 discipline' : `${disciplineCount} disciplines`}
        </p>
      </div>
    </Link>
  );
}
