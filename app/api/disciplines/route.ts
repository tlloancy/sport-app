import { NextRequest, NextResponse } from 'next/server';
import { listActiveDisciplines } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const family = req.nextUrl.searchParams.get('family') ?? undefined;
  const disciplines = listActiveDisciplines(family).map(
    ({ slug, label, family: familySlug, metric_type }) => ({
      slug,
      label,
      family: familySlug,
      metricType: metric_type,
    })
  );
  return NextResponse.json({ disciplines });
}
