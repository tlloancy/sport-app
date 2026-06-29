import UploadClient from './UploadClient';
import { familyHref } from '@/lib/upload-links';
import { getFamily, isValidFamily } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams: { family?: string; discipline?: string };
};

export default function UploadPage({ searchParams }: PageProps) {
  const family = searchParams.family?.trim().toLowerCase();
  const showContext = family && isValidFamily(family);
  const familyRow = showContext ? getFamily(family)! : null;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      {familyRow ? (
        <nav className="mb-6 text-sm text-neutral-500">
          <Link href={familyHref(familyRow.slug)} className="hover:text-neutral-900">
            ← {familyRow.emoji} {familyRow.label}
          </Link>
        </nav>
      ) : null}
      <UploadClient
        initialFamily={searchParams.family}
        initialDiscipline={searchParams.discipline}
      />
    </main>
  );
}
