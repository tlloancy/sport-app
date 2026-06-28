import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listDisciplinesForAdmin } from '@/lib/admin-data';
import { addDiscipline } from '@/lib/db';
import {
  normalizeLabel,
  normalizeSlug,
  parseMetricType,
  validateFamily,
  validateLabel,
  validateMetricType,
  validateSlug,
} from '@/lib/category-validation';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  return NextResponse.json({ disciplines: listDisciplinesForAdmin() });
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  let body: { slug?: string; label?: string; family?: string; metricType?: string };
  try {
    body = (await req.json()) as {
      slug?: string;
      label?: string;
      family?: string;
      metricType?: string;
    };
  } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }

  const slug = body.slug ? normalizeSlug(body.slug) : '';
  const label = body.label ? normalizeLabel(body.label) : '';
  const family = body.family ? normalizeSlug(body.family) : '';
  const metricTypeRaw = body.metricType ?? '';

  const slugError = validateSlug(slug);
  if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });

  const labelError = validateLabel(label);
  if (labelError) return NextResponse.json({ error: labelError }, { status: 400 });

  const familyError = validateFamily(family);
  if (familyError) return NextResponse.json({ error: familyError }, { status: 400 });

  const metricError = validateMetricType(metricTypeRaw);
  if (metricError) return NextResponse.json({ error: metricError }, { status: 400 });

  const metricType = parseMetricType(metricTypeRaw);
  if (!metricType) {
    return NextResponse.json({ error: 'Type de métrique invalide.' }, { status: 400 });
  }

  try {
    addDiscipline(slug, label, family, metricType);
    return NextResponse.json({ slug, label, family, metricType }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'insert failed';
    if (message.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Cette discipline existe déjà.' }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
