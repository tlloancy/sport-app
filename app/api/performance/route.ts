import { NextRequest, NextResponse } from 'next/server';
import { parsePerformanceUri, publishPerformance, type PerformanceRecord } from '@/lib/atproto';
import { getUploadAgent } from '@/lib/upload-agent';
import { classifyPublishError, uploadErrorBody } from '@/lib/upload-error';

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
  } catch (err) {
    const payload = uploadErrorBody(
      'publish',
      'invalid_body',
      'Corps JSON invalide.',
      400,
      err instanceof Error ? err.message : undefined
    );
    return NextResponse.json(payload, { status: payload.status });
  }

  const { movement, value, unit, videoHash, chunkManifest } = body;
  const missing: string[] = [];
  if (!movement) missing.push('movement');
  if (value == null) missing.push('value');
  if (!unit) missing.push('unit');
  if (!videoHash) missing.push('videoHash');
  if (!chunkManifest) missing.push('chunkManifest');

  if (missing.length > 0) {
    const payload = uploadErrorBody(
      'publish',
      'missing_fields',
      'Champs obligatoires manquants pour la publication.',
      400,
      `Manquants : ${missing.join(', ')}`
    );
    return NextResponse.json(payload, { status: payload.status });
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
    const payload = classifyPublishError(err);
    return NextResponse.json(payload, { status: payload.status });
  }
}
