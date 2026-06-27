import { NextResponse } from 'next/server';
import { defaultPdsUrls, getFeed } from '@/lib/atproto';

export const runtime = 'nodejs';

export async function GET() {
  const pdsUrls = defaultPdsUrls();
  try {
    const performances = await getFeed('snatch', undefined, pdsUrls);
    return NextResponse.json({
      pdsUrls,
      movement: 'snatch',
      tranche: null,
      count: performances.length,
      performances,
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json(
      { pdsUrls, error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
