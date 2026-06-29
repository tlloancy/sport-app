import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import {
  isWithinUploadLimits,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_DURATION_SEC,
  UPLOAD_LIMITS_MESSAGE,
  describeUploadLimitError,
} from '@/lib/upload-limits';

export interface ChunkResult {
  hashes: string[];
  videoHash: string;
  chunkManifest: string;
  durationSec: number;
}

export interface ChunkOptions {
  durationSec?: number;
  videoHash?: string;
}

export class UploadLimitError extends Error {
  readonly status = 413;

  constructor(message = UPLOAD_LIMITS_MESSAGE) {
    super(message);
    this.name = 'UploadLimitError';
  }
}

/** Detect video duration in seconds via ffprobe. */
export function probeVideoDuration(inputPath: string): number {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
    { stdio: 'pipe', timeout: 15_000 }
  )
    .toString('utf8')
    .trim();

  const durationSec = Number.parseFloat(out);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`ffprobe could not read duration (${out || 'empty'})`);
  }
  return durationSec;
}

export function assertUploadWithinLimits(sizeBytes: number, durationSec: number): void {
  if (!isWithinUploadLimits(sizeBytes, durationSec)) {
    throw new UploadLimitError(describeUploadLimitError(sizeBytes, durationSec));
  }
}

function runFfmpeg(args: string): void {
  execSync(`ffmpeg -y -hide_banner -loglevel error ${args}`, {
    stdio: 'pipe',
    timeout: 120_000,
  });
}

/** HLS segment — stream copy first (fast), libx264 ultrafast fallback. */
function segmentToHls(inputPath: string, tmp: string): void {
  const segTpl = path.join(tmp, 'seg_%03d.ts');
  const playlist = path.join(tmp, 'playlist.m3u8');
  const hlsOut = [
    '-f hls',
    '-hls_time 2',
    '-hls_list_size 0',
    '-hls_segment_type mpegts',
    `-hls_segment_filename "${segTpl}"`,
    `"${playlist}"`,
  ].join(' ');

  try {
    runFfmpeg(`-i "${inputPath}" -c:v copy -c:a copy ${hlsOut}`);
    if (fs.readdirSync(tmp).some((f) => f.endsWith('.ts'))) {
      return;
    }
  } catch {
    // fall through to re-encode
  }

  for (const name of fs.readdirSync(tmp)) {
    fs.rmSync(path.join(tmp, name), { force: true });
  }

  runFfmpeg(
    `-i "${inputPath}" -c:v libx264 -preset ultrafast -tune zerolatency -threads 0 -pix_fmt yuv420p -g 30 -c:a aac -b:a 128k -ac 2 ${hlsOut}`
  );
}

/** Split a video file into 2s HLS MPEG-TS segments keyed by SHA256 hash. */
export function chunkVideoFile(
  inputPath: string,
  outputDir: string,
  opts?: ChunkOptions
): ChunkResult {
  const sizeBytes = fs.statSync(inputPath).size;
  const durationSec = opts?.durationSec ?? probeVideoDuration(inputPath);
  assertUploadWithinLimits(sizeBytes, durationSec);

  const videoHash =
    opts?.videoHash ??
    crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex');

  fs.mkdirSync(outputDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls-chunk-'));

  try {
    segmentToHls(inputPath, tmp);

    const segs = fs.readdirSync(tmp).filter((f) => f.endsWith('.ts')).sort();
    if (segs.length === 0) {
      throw new Error('ffmpeg produced no HLS segments');
    }

    const hashes: string[] = [];
    for (const name of segs) {
      const segPath = path.join(tmp, name);
      const bytes = fs.readFileSync(segPath);
      const hash = crypto.createHash('sha256').update(bytes).digest('hex');
      fs.writeFileSync(path.join(outputDir, `${hash}.ts`), bytes);
      hashes.push(hash);
    }

    return {
      hashes,
      videoHash,
      chunkManifest: JSON.stringify(hashes),
      durationSec: Math.round(durationSec * 10) / 10,
    };
  } catch (err) {
    const execErr = err as { stderr?: Buffer; message?: string };
    const stderr = execErr.stderr?.toString('utf8').trim();
    throw new Error(stderr || execErr.message || 'ffmpeg failed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export { MAX_UPLOAD_BYTES, MAX_UPLOAD_DURATION_SEC, UPLOAD_LIMITS_MESSAGE };
