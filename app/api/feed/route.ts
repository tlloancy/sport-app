import { NextRequest, NextResponse } from 'next/server';
import { loadFeedPage } from '@/lib/feed-server';
import { pdsUrls } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const movement = req.nextUrl.searchParams.get('movement') ?? 'snatch';
  const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10) || 1);

  if (pdsUrls().length === 0) {
    return NextResponse.json({ error: 'Aucune URL PDS configurée.' }, { status: 503 });
  }

  try {
    return NextResponse.json(await loadFeedPage(movement, page));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'getFeed failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
