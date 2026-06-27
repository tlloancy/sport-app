import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import {
  chunkVideoFile,
  probeVideoDuration,
  UploadLimitError,
  UPLOAD_LIMITS_MESSAGE,
  MAX_UPLOAD_BYTES,
} from '@/lib/chunker';
import { seedChunksFromDir } from '@/lib/p2p-gateway';
import { chunkStorageDir } from '@/lib/p2p-server';
import { classifyChunkError, uploadErrorBody } from '@/lib/upload-error';
import { MAX_UPLOAD_DURATION_SEC } from '@/lib/upload-limits';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
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

  if (file.size > MAX_UPLOAD_BYTES) {
    const body = uploadErrorBody(
      'chunk',
      'upload_limit',
      UPLOAD_LIMITS_MESSAGE,
      413,
      `Taille ${file.size} octets > ${MAX_UPLOAD_BYTES} octets (50 Mo)`
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
    if (durationSec > MAX_UPLOAD_DURATION_SEC) {
      const body = uploadErrorBody(
        'chunk',
        'upload_limit',
        UPLOAD_LIMITS_MESSAGE,
        413,
        `Durée ${Math.round(durationSec * 10) / 10}s > ${MAX_UPLOAD_DURATION_SEC}s`
      );
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
