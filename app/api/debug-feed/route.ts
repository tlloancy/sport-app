import { NextResponse } from 'next/server';
import { getFeed } from '@/lib/atproto';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const performances = await getFeed('snatch', undefined, [
      'http://localhost:2583',
      'http://localhost:2584',
    ]);
    return NextResponse.json({ count: performances.length, performances });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
