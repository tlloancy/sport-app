import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { chunkVideoFile } from '@/lib/chunker';
import { chunkStorageDir } from '@/lib/p2p-server';
import { classifyChunkError, uploadErrorBody } from '@/lib/upload-error';

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

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-'));
  const tmpPath = path.join(tmpDir, file.name || 'upload.mp4');

  try {
    fs.writeFileSync(tmpPath, Buffer.from(await file.arrayBuffer()));
    const result = chunkVideoFile(tmpPath, chunkStorageDir());
    return NextResponse.json({
      hashes: result.hashes,
      videoHash: result.videoHash,
      chunkManifest: result.chunkManifest,
    });
  } catch (err) {
    const body = classifyChunkError(err);
    return NextResponse.json(body, { status: body.status });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
