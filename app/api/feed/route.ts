import { NextRequest, NextResponse } from 'next/server';
import { getDefaultDisciplineSlug } from '@/lib/category-home';
import { loadFeedPage } from '@/lib/feed-server';
import { pdsUrls } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const discipline =
    req.nextUrl.searchParams.get('discipline') ??
    req.nextUrl.searchParams.get('movement') ??
    getDefaultDisciplineSlug();
  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1);

  if (pdsUrls().length === 0) {
    return NextResponse.json({ error: 'Aucune URL PDS configurée.' }, { status: 503 });
  }

  try {
    return NextResponse.json(await loadFeedPage(discipline, page));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'getFeed failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
