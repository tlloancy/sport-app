import { NextResponse } from 'next/server';
import { listActiveCategories } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const categories = listActiveCategories().map(({ slug, label }) => ({ slug, label }));
  return NextResponse.json({ categories });
}
