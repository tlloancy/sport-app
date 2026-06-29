import { NextRequest, NextResponse } from 'next/server';
import { AtpAgent } from '@atproto/api';
import {
  defaultPdsUrls,
  getFeed,
  indexPerformanceByRkey,
  resolvePublisherDid,
} from '@/lib/atproto';
import { pdsUrl } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const pdsUrls = defaultPdsUrls();
  const logs: string[] = [];
  const indexRkeys =
    req.nextUrl.searchParams.get('indexRkeys')?.split(',').map((s) => s.trim()).filter(Boolean) ??
    [];

  try {
    if (indexRkeys.length > 0) {
      const did = (await resolvePublisherDid()) ?? req.nextUrl.searchParams.get('did');
      if (!did) {
        logs.push('indexRkeys: no publisher DID (set UPLOAD_DID or ?did=)');
      } else {
        const agent = new AtpAgent({ service: pdsUrl() });
        for (const rkey of indexRkeys) {
          const indexed = await indexPerformanceByRkey(agent, did, rkey);
          logs.push(
            indexed
              ? `indexed ${indexed.uri}`
              : `index failed for rkey ${rkey}`
          );
        }
      }
    }

    const performances = await getFeed('halterophilie', undefined, pdsUrls, logs);
    return NextResponse.json({
      pdsUrls,
      discipline: 'halterophilie',
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
