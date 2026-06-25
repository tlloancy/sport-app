import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CHUNK_DIR = path.join(ROOT, 'public/test-player/chunks');
const OUT = path.join(ROOT, 'public/test-player/manifest.json');
const SAMPLE = path.join(ROOT, 'test/fixtures/sample.mp4');

fs.mkdirSync(CHUNK_DIR, { recursive: true });

const tmp = fs.mkdtempSync(path.join(ROOT, '.tmp-hls-'));
try {
  execSync(
    `ffmpeg -y -f lavfi -i testsrc=duration=12:size=320x240:rate=30 -pix_fmt yuv420p -c:v libx264 -g 30 -f hls -hls_time 2 -hls_list_size 0 -hls_segment_type mpegts -hls_segment_filename "${tmp}/seg_%03d.ts" "${tmp}/playlist.m3u8"`,
    { stdio: 'pipe' }
  );
  fs.mkdirSync(path.dirname(SAMPLE), { recursive: true });
  execSync(`ffmpeg -y -f lavfi -i testsrc=duration=12:size=320x240:rate=30 -pix_fmt yuv420p -c:v libx264 "${SAMPLE}"`, {
    stdio: 'pipe',
  });

  const segs = fs.readdirSync(tmp).filter((f) => f.endsWith('.ts')).sort();
  const picked = segs.slice(0, 5);
  if (picked.length < 5) {
    throw new Error(`expected 5 HLS segments, got ${picked.length} — regenerate sample with duration >= 10s`);
  }
  const hashes = [];
  for (const name of picked) {
    const bytes = fs.readFileSync(path.join(tmp, name));
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(CHUNK_DIR, `${hash}.ts`), bytes);
    hashes.push(hash);
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({ hashes, peers: ['peer_a_id', 'peer_b_id', 'peer_c_id'] }, null, 2)
  );
  console.log('PLAYER_FIXTURES_OK', hashes.length, 'chunks');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
