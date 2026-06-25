import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { chunkVideoFile } from '@/lib/chunker';
import { chunkStorageDir } from '@/lib/p2p-server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file field' }, { status: 400 });
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
    const message = err instanceof Error ? err.message : 'chunk failed';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
