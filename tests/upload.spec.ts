import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('upload flow', () => {
  test.setTimeout(120_000);

  test('upload publishes performance visible on feed and streamable elsewhere', async ({
    page,
    browser,
  }) => {
    const samplePath = path.join(__dirname, '..', 'test', 'fixtures', 'sample.mp4');
    const uniqueValue = 32 + Math.floor(Math.random() * 10);

    await page.goto('/upload');
    await page.getByTestId('upload-file').setInputFiles(samplePath);
    await page.getByTestId('upload-discipline').selectOption('halterophilie');
    await page.getByTestId('upload-movement').fill('snatch');
    await page.getByTestId('upload-value').fill(String(uniqueValue));
    await page.getByTestId('upload-unit').selectOption('kg');
    await page.getByTestId('upload-submit').click();

    await page.waitForURL(/\/performance\/[^/?#]+/, { timeout: 60_000 });
    const performanceUrl = page.url();
    const rkey = new URL(performanceUrl).pathname.split('/').pop()!;

    const deadline = Date.now() + 30_000;
    let onFeed = false;
    while (Date.now() < deadline) {
      await page.goto('/halterophilie');
      if (await page.getByTestId(`feed-item-${rkey}`).isVisible().catch(() => false)) {
        onFeed = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(onFeed).toBe(true);
    console.log('PASS: performance visible on feed within 30 seconds of upload');

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    let reuploads = 0;
    page2.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/chunk')) reuploads += 1;
    });

    await page2.goto(performanceUrl, { waitUntil: 'networkidle' });
    await page2.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="video-player"]') as HTMLVideoElement | null;
        return el && el.readyState >= 2 && !el.paused && el.currentTime > 0;
      },
      undefined,
      { timeout: 15_000 }
    );

    expect(reuploads).toBe(0);
    console.log('PASS: video streamable from second device without re-upload');
    await ctx2.close();
  });
});
