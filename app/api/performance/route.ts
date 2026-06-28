import { NextRequest, NextResponse } from 'next/server';
import {
  announcePeerId,
  parsePerformanceUri,
  publishPerformance,
  type PerformanceRecord,
} from '@/lib/atproto';
import {
  normalizeMovementInput,
  validateMovement,
} from '@/lib/category-validation';
import { getDiscipline, isActiveDiscipline } from '@/lib/db';
import { validateMetricPayload, type MetricUnit } from '@/lib/metrics';
import { getGatewayPeerId } from '@/lib/p2p-gateway';
import { getUploadAgent } from '@/lib/upload-agent';
import { classifyPublishError, uploadErrorBody } from '@/lib/upload-error';

export const runtime = 'nodejs';

type PublishRequestBody = {
  family?: string;
  discipline?: string;
  movement?: string;
  value?: number;
  unit?: MetricUnit;
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

  const disciplineSlug = body.discipline?.trim().toLowerCase() ?? '';
  const movementRaw = body.movement ?? '';
  const movementError = validateMovement(movementRaw);
  const movement = normalizeMovementInput(movementRaw);

  const missing: string[] = [];
  if (!body.family) missing.push('family');
  if (!disciplineSlug) missing.push('discipline');
  if (movementError) missing.push('movement');
  if (!body.videoHash) missing.push('videoHash');
  if (!body.chunkManifest) missing.push('chunkManifest');

  if (
    !body.family ||
    !disciplineSlug ||
    movementError ||
    !body.videoHash ||
    !body.chunkManifest
  ) {
    const payload = uploadErrorBody(
      'publish',
      'missing_fields',
      movementError ?? 'Champs obligatoires manquants pour la publication.',
      400,
      `Manquants : ${missing.join(', ')}`
    );
    return NextResponse.json(payload, { status: payload.status });
  }

  if (!isActiveDiscipline(disciplineSlug)) {
    const payload = uploadErrorBody(
      'publish',
      'missing_fields',
      'Discipline inconnue ou inactive.',
      400
    );
    return NextResponse.json(payload, { status: payload.status });
  }

  const discipline = getDiscipline(disciplineSlug)!;
  if (body.family.trim().toLowerCase() !== discipline.family) {
    const payload = uploadErrorBody(
      'publish',
      'missing_fields',
      'Famille incompatible avec la discipline.',
      400
    );
    return NextResponse.json(payload, { status: payload.status });
  }

  const metricType = discipline.metric_type;
  const metricError = validateMetricPayload(metricType, body.value, body.unit);
  if (metricError) {
    const payload = uploadErrorBody('publish', 'missing_fields', metricError, 400);
    return NextResponse.json(payload, { status: payload.status });
  }

  const performance: PerformanceRecord = {
    family: discipline.family,
    discipline: disciplineSlug,
    movement,
    metricType,
    videoHash: body.videoHash,
    chunkManifest: body.chunkManifest,
    createdAt: new Date().toISOString(),
  };

  if (metricType !== 'none') {
    performance.value = Number(body.value);
    performance.unit = body.unit;
  }

  try {
    const agent = await getUploadAgent();
    const uri = await publishPerformance(agent, performance);
    const { did, rkey } = parsePerformanceUri(uri);

    const peerId = await getGatewayPeerId();
    if (peerId) {
      await announcePeerId(agent, peerId);
    }

    return NextResponse.json({ uri, did, rkey, peerId: peerId ?? null });
  } catch (err) {
    const payload = classifyPublishError(err);
    return NextResponse.json(payload, { status: payload.status });
  }
}
