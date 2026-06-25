import { NextRequest, NextResponse } from 'next/server';
import { parsePerformanceUri, publishPerformance, type PerformanceRecord } from '@/lib/atproto';
import { getUploadAgent } from '@/lib/upload-agent';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {
    movement?: string;
    value?: number;
    unit?: PerformanceRecord['unit'];
    videoHash?: string;
    chunkManifest?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const { movement, value, unit, videoHash, chunkManifest } = body;
  if (!movement || value == null || !unit || !videoHash || !chunkManifest) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  try {
    const agent = await getUploadAgent();
    const uri = await publishPerformance(agent, {
      movement,
      value: Number(value),
      unit,
      videoHash,
      chunkManifest,
      createdAt: new Date().toISOString(),
    });
    const { did, rkey } = parsePerformanceUri(uri);
    return NextResponse.json({ uri, did, rkey });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'publish failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
