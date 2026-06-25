import crypto from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';
import {
  actorStoreRootForPds,
  createAccountOnPds,
  getComments,
  postComment,
  publishPerformance,
  type PerformanceRecord,
} from '../lib/atproto';

const PDS_1 = process.env.PDS_1_URL ?? 'http://localhost:2583';
const PDS_2 = process.env.PDS_2_URL ?? 'http://localhost:2584';
const PASSWORD = 'testpass-step13';

async function verifyOnly(performanceUri: string, expectedText: string) {
  const pds2 = process.env.PDS_2_URL ?? 'http://localhost:2584';
  const comments = await getComments(performanceUri, [pds2]);
  const match = comments.find((c) => c.record.text === expectedText);
  if (!match) {
    console.error('FAIL: comment not visible via PDS_2 only', { performanceUri, comments });
    process.exit(1);
  }
  console.log('PASS: comment from PDS_1 visible on PDS_2 feed');
}

async function main() {
  const performanceUri = process.argv[3];
  const expectedText = process.argv[4];
  if (process.argv[2] === '--verify-only') {
    if (!performanceUri || !expectedText) {
      throw new Error('usage: step13.ts --verify-only <performanceUri> <expectedText>');
    }
    await verifyOnly(performanceUri, expectedText);
    return;
  }

  const account1 = await createAccountOnPds(
    PDS_1,
    `cmt-a-${crypto.randomBytes(3).toString('hex')}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_1)
  );
  const account2 = await createAccountOnPds(
    PDS_2,
    `cmt-b-${crypto.randomBytes(3).toString('hex')}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_2)
  );

  if (!account1.agent || !account2.agent) {
    throw new Error('missing agents after account creation');
  }

  const perf: PerformanceRecord = {
    movement: 'snatch',
    value: 42,
    unit: 'kg',
    videoHash: `hash-step13-${crypto.randomBytes(4).toString('hex')}`,
    chunkManifest: '[]',
    createdAt: new Date().toISOString(),
  };

  const performanceUriOut = await publishPerformance(account1.agent, perf);
  const commentText = `cross-pds-comment-${crypto.randomBytes(4).toString('hex')}`;
  await postComment(account2.agent, performanceUriOut, commentText);

  const scriptPath = path.resolve(process.cwd(), 'test/step13.ts');
  const tsxCli = path.resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs');
  const result = spawnSync(
    process.execPath,
    [tsxCli, scriptPath, '--verify-only', performanceUriOut, commentText],
    {
      env: { PDS_2_URL: PDS_2 },
      stdio: 'inherit',
      cwd: process.cwd(),
    }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
