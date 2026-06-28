import { NextResponse } from 'next/server';
import { listFamilies } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const families = listFamilies().map(({ slug, label, emoji }) => ({ slug, label, emoji }));
  return NextResponse.json({ families });
}
