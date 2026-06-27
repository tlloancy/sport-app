import { NextRequest, NextResponse } from 'next/server';
import { addCategory } from '@/lib/db';
import {
  normalizeLabel,
  normalizeSlug,
  validateLabel,
  validateSlug,
} from '@/lib/category-validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { slug?: string; label?: string };
  try {
    body = (await req.json()) as { slug?: string; label?: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const slug = body.slug ? normalizeSlug(body.slug) : '';
  const label = body.label ? normalizeLabel(body.label) : '';

  const slugError = validateSlug(slug);
  if (slugError) {
    return NextResponse.json({ error: slugError }, { status: 400 });
  }

  const labelError = validateLabel(label);
  if (labelError) {
    return NextResponse.json({ error: labelError }, { status: 400 });
  }

  try {
    addCategory(slug, label);
    return NextResponse.json({ slug, label }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'insert failed';
    if (message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Cette catégorie existe déjà.' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
