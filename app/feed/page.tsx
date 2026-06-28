import { getDefaultDisciplineSlug } from '@/lib/category-home';
import { isActiveDiscipline } from '@/lib/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyFeedRedirect({
  searchParams,
}: {
  searchParams: { movement?: string; discipline?: string; page?: string };
}) {
  const defaultSlug = getDefaultDisciplineSlug();
  const requested =
    searchParams.discipline?.toLowerCase() ?? searchParams.movement?.toLowerCase();
  const slug = requested && isActiveDiscipline(requested) ? requested : defaultSlug;
  const page = searchParams.page;
  const qs = page && page !== '1' ? `?page=${encodeURIComponent(page)}` : '';
  redirect(`/${slug}${qs}`);
}
