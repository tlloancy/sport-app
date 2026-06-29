import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  chunkVideoFile,
  probeVideoDuration,
  UploadLimitError,
} from '@/lib/chunker';
import { ANON_COOKIE, HOURLY_CHUNK_LIMIT } from '@/lib/anon';
import { insertChunkUploadAttempt } from '@/lib/db';
import { seedChunksFromDir } from '@/lib/p2p-gateway';
import { chunkStorageDir } from '@/lib/p2p-server';
import { classifyChunkError, uploadErrorBody } from '@/lib/upload-error';
import {
  isChunkUploadRateLimited,
  isDeclaredBodyTooLarge,
  MAX_UPLOAD_BODY_BYTES,
  readDeclaredBodyBytes,
  uploadClientKey,
} from '@/lib/upload-guard';
import {
  describeUploadLimitError,
  formatUploadBytes,
  isUploadTooLarge,
  isWithinUploadLimits,
} from '@/lib/upload-limits';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!req.cookies.get(ANON_COOKIE)?.value) {
    const body = uploadErrorBody(
      'chunk',
      'invalid_body',
      'Ouvre la page d’upload dans ton navigateur avant d’envoyer une vidéo.',
      401
    );
    return NextResponse.json(body, { status: body.status });
  }

  const clientKey = uploadClientKey(req);
  if (isChunkUploadRateLimited(clientKey)) {
    const body = uploadErrorBody(
      'chunk',
      'rate_limit',
      `Trop d’envois vidéo (${HOURLY_CHUNK_LIMIT}/h). Réessaie plus tard.`,
      429
    );
    return NextResponse.json(body, { status: body.status });
  }

  const declaredBytes = readDeclaredBodyBytes(req);
  if (declaredBytes == null) {
    const body = uploadErrorBody(
      'chunk',
      'invalid_body',
      'En-tête Content-Length requis pour l’upload vidéo.',
      411
    );
    return NextResponse.json(body, { status: body.status });
  }

  if (isDeclaredBodyTooLarge(req)) {
    const body = uploadErrorBody(
      'chunk',
      'upload_limit',
      describeUploadLimitError(declaredBytes, 0),
      413,
      `Corps HTTP : ${formatUploadBytes(declaredBytes)} (max ${formatUploadBytes(MAX_UPLOAD_BODY_BYTES)})`
    );
    return NextResponse.json(body, { status: body.status });
  }

  insertChunkUploadAttempt(clientKey);

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    const body = uploadErrorBody(
      'chunk',
      'invalid_body',
      'Impossible de lire le formulaire d’upload.',
      400,
      err instanceof Error ? err.message : undefined
    );
    return NextResponse.json(body, { status: body.status });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    const body = uploadErrorBody(
      'chunk',
      'missing_file',
      'Aucun fichier vidéo reçu.',
      400,
      'Le champ multipart « file » est absent ou invalide.'
    );
    return NextResponse.json(body, { status: body.status });
  }

  if (isUploadTooLarge(file.size)) {
    const body = uploadErrorBody(
      'chunk',
      'upload_limit',
      describeUploadLimitError(file.size, 0),
      413,
      `Taille reçue : ${file.size} octets`
    );
    return NextResponse.json(body, { status: body.status });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-'));
  const tmpPath = path.join(tmpDir, file.name || 'upload.mp4');

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const videoHash = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(tmpPath, bytes);

    const durationSec = probeVideoDuration(tmpPath);
    if (!isWithinUploadLimits(file.size, durationSec)) {
      const message = describeUploadLimitError(file.size, durationSec);
      const body = uploadErrorBody('chunk', 'upload_limit', message, 413, message);
      return NextResponse.json(body, { status: body.status });
    }

    const outDir = chunkStorageDir();
    const result = chunkVideoFile(tmpPath, outDir, {
      durationSec,
      videoHash,
    });

    const seeded = await seedChunksFromDir(result.hashes, outDir);

    return NextResponse.json({
      hashes: result.hashes,
      videoHash: result.videoHash,
      chunkManifest: result.chunkManifest,
      durationSec: result.durationSec,
      p2pSeeded: seeded,
    });
  } catch (err) {
    if (err instanceof UploadLimitError) {
      const body = uploadErrorBody('chunk', 'upload_limit', err.message, 413);
      return NextResponse.json(body, { status: body.status });
    }
    const body = classifyChunkError(err);
    return NextResponse.json(body, { status: body.status });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
