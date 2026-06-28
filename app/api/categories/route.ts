import { NextResponse } from 'next/server';
import { listActiveDisciplines } from '@/lib/db';

export const runtime = 'nodejs';

/** @deprecated use /api/disciplines */
export async function GET() {
  const categories = listActiveDisciplines().map(({ slug, label }) => ({ slug, label }));
  return NextResponse.json({ categories });
}
