import { getDefaultCategorySlug } from '@/lib/category-home';
import { isActiveCategory } from '@/lib/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyFeedRedirect({
  searchParams,
}: {
  searchParams: { movement?: string; page?: string };
}) {
  const defaultSlug = getDefaultCategorySlug();
  const movement = searchParams.movement?.toLowerCase();
  const slug = movement && isActiveCategory(movement) ? movement : defaultSlug;
  const page = searchParams.page;
  const qs = page && page !== '1' ? `?page=${encodeURIComponent(page)}` : '';
  redirect(`/${slug}${qs}`);
}
