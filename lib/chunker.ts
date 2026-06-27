import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

export interface ChunkResult {
  hashes: string[];
  videoHash: string;
  chunkManifest: string;
}

/** Split a video file into 2s HLS MPEG-TS segments keyed by SHA256 hash. */
export function chunkVideoFile(inputPath: string, outputDir: string): ChunkResult {
  fs.mkdirSync(outputDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls-chunk-'));

  try {
    execSync(
      `ffmpeg -y -i "${inputPath}" -c:v libx264 -pix_fmt yuv420p -g 30 -f hls -hls_time 2 -hls_list_size 0 -hls_segment_type mpegts -hls_segment_filename "${tmp}/seg_%03d.ts" "${tmp}/playlist.m3u8"`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    const execErr = err as { stderr?: Buffer; message?: string };
    const stderr = execErr.stderr?.toString('utf8').trim();
    throw new Error(stderr || execErr.message || 'ffmpeg failed');
  }

  try {
    const segs = fs.readdirSync(tmp).filter((f) => f.endsWith('.ts')).sort();
    if (segs.length === 0) {
      throw new Error('ffmpeg produced no HLS segments');
    }

    const videoHash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(inputPath))
      .digest('hex');

    const hashes: string[] = [];
    for (const name of segs) {
      const bytes = fs.readFileSync(path.join(tmp, name));
      const hash = crypto.createHash('sha256').update(bytes).digest('hex');
      fs.writeFileSync(path.join(outputDir, `${hash}.ts`), bytes);
      hashes.push(hash);
    }

    return { hashes, videoHash, chunkManifest: JSON.stringify(hashes) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
