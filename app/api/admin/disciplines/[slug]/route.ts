import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { softDeleteDiscipline } from '@/lib/db';
import { normalizeSlug, validateSlug } from '@/lib/category-validation';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const slug = normalizeSlug(params.slug);
  const slugError = validateSlug(slug);
  if (slugError) {
    return NextResponse.json({ error: slugError }, { status: 400 });
  }

  const ok = softDeleteDiscipline(slug);
  if (!ok) {
    return NextResponse.json({ error: 'Discipline introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ slug, active: false });
}
