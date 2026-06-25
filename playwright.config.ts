import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true,
  },
  webServer: {
    command:
      'bash scripts/gen_player_fixtures.sh && P2P_TEST_MODE=1 npm run build && P2P_TEST_MODE=1 npm run start -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000/performance/test',
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
