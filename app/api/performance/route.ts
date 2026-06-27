import { NextRequest, NextResponse } from 'next/server';
import { parsePerformanceUri, publishPerformance, type PerformanceRecord } from '@/lib/atproto';
import { getUploadAgent } from '@/lib/upload-agent';
import { classifyPublishError, uploadErrorBody } from '@/lib/upload-error';

export const runtime = 'nodejs';

type PublishRequestBody = {
  movement?: string;
  value?: number;
  unit?: PerformanceRecord['unit'];
  videoHash?: string;
  chunkManifest?: string;
};

export async function POST(req: NextRequest) {
  let body: PublishRequestBody;

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

  const missing: string[] = [];
  if (!body.movement) missing.push('movement');
  if (body.value == null) missing.push('value');
  if (!body.unit) missing.push('unit');
  if (!body.videoHash) missing.push('videoHash');
  if (!body.chunkManifest) missing.push('chunkManifest');

  if (
    !body.movement ||
    body.value == null ||
    !body.unit ||
    !body.videoHash ||
    !body.chunkManifest
  ) {
    const payload = uploadErrorBody(
      'publish',
      'missing_fields',
      'Champs obligatoires manquants pour la publication.',
      400,
      `Manquants : ${missing.join(', ')}`
    );
    return NextResponse.json(payload, { status: payload.status });
  }

  const performance: PerformanceRecord = {
    movement: body.movement,
    value: Number(body.value),
    unit: body.unit,
    videoHash: body.videoHash,
    chunkManifest: body.chunkManifest,
    createdAt: new Date().toISOString(),
  };

  try {
    const agent = await getUploadAgent();
    const uri = await publishPerformance(agent, performance);
    const { did, rkey } = parsePerformanceUri(uri);
    return NextResponse.json({ uri, did, rkey });
  } catch (err) {
    const payload = classifyPublishError(err);
    return NextResponse.json(payload, { status: payload.status });
  }
}
