import { NextRequest, NextResponse } from 'next/server';
import { isActiveCategory } from '@/lib/db';
import { pickDuelPair } from '@/lib/duel-pair';
import { pdsUrls } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug.toLowerCase();

  if (!isActiveCategory(slug)) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 });
  }

  if (pdsUrls().length === 0) {
    return NextResponse.json({ error: 'Aucune URL PDS configurée.' }, { status: 503 });
  }

  try {
    const pair = await pickDuelPair(slug);
    return NextResponse.json(pair ? { pair } : { pair: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Duel load failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
