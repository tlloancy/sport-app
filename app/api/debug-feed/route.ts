import { NextResponse } from 'next/server';
import { getFeed } from '@/lib/atproto';

export const runtime = 'nodejs';

export async function GET() {
  const pdsUrls = ['http://localhost:2583', 'http://localhost:2584'];
  const logs: string[] = [];

  try {
    const performances = await getFeed('snatch', undefined, pdsUrls, logs);
    return NextResponse.json({
      pdsUrls,
      movement: 'snatch',
      tranche: null,
      count: performances.length,
      performances,
      logs,
    });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    logs.push(`FATAL: ${err.message}`);
    return NextResponse.json(
      { pdsUrls, error: err.message, stack: err.stack, logs },
      { status: 500 }
    );
  }
}
