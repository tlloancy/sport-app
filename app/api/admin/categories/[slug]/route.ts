import { NextRequest, NextResponse } from 'next/server';
import { softDeleteCategory } from '@/lib/db';
import { normalizeSlug, validateSlug } from '@/lib/category-validation';

export const runtime = 'nodejs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = normalizeSlug(params.slug);
  const slugError = validateSlug(slug);
  if (slugError) {
    return NextResponse.json({ error: slugError }, { status: 400 });
  }

  const ok = softDeleteCategory(slug);
  if (!ok) {
    return NextResponse.json({ error: 'Catégorie introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ slug, active: false });
}
