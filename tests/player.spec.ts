import { test, expect } from '@playwright/test';

const CENTRAL_VIDEO_PATTERNS = [
  /cloudflare/i,
  /amazonaws\.com/i,
  /cloudfront\.net/i,
  /blob:\/video/i,
  /\.mp4(\?|$)/i,
  /video\.google/i,
  /vimeo\.com/i,
];

test('P2P player starts quickly without central video server', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => requests.push(req.url()));

  await page.goto('/performance/test', { waitUntil: 'networkidle' });

  const video = page.getByTestId('video-player');
  await expect(video).toBeVisible();

  const started = Date.now();
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="video-player"]') as HTMLVideoElement | null;
      return el && el.readyState >= 2 && !el.paused && el.currentTime > 0;
    },
    undefined,
    { timeout: 10_000 }
  );

  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(3000);
  console.log(`PASS: video starts playing within 3 seconds (${elapsed}ms)`);

  const central = requests.filter((url) => {
    if (url.includes('/api/p2p/chunk')) return false;
    if (url.startsWith('blob:')) return false;
    if (url.includes('127.0.0.1') || url.includes('localhost')) return false;
    return CENTRAL_VIDEO_PATTERNS.some((re) => re.test(url));
  });

  if (central.length > 0) {
    console.error('Central video requests:', central);
  }
  expect(central).toEqual([]);
  console.log('PASS: no central video server in network tab');
});
