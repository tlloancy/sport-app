import crypto from 'crypto';
import {
  actorStoreRootForPds,
  createAccountOnPds,
  getFeed,
  publishPerformance,
  type PerformanceRecord,
} from '../lib/atproto';

const PDS_1 = process.env.PDS_1_URL ?? 'http://localhost:2583';
const PDS_2 = process.env.PDS_2_URL ?? 'http://localhost:2584';
const PASSWORD = 'testpass-step8';

async function main() {
  const account1 = await createAccountOnPds(
    PDS_1,
    `fed-a-${crypto.randomBytes(3).toString('hex')}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_1)
  );
  const account2 = await createAccountOnPds(
    PDS_2,
    `fed-b-${crypto.randomBytes(3).toString('hex')}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_2)
  );

  if (!account1.agent || !account2.agent) {
    throw new Error('missing agents after account creation');
  }

  const perfA: PerformanceRecord = {
    movement: 'snatch',
    value: 40,
    unit: 'kg',
    videoHash: 'hash-pds1-step8',
    chunkManifest: '[]',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
  };
  const perfB: PerformanceRecord = {
    movement: 'snatch',
    value: 55,
    unit: 'kg',
    videoHash: 'hash-pds2-step8',
    chunkManifest: '[]',
    createdAt: new Date().toISOString(),
  };

  await publishPerformance(account1.agent, perfA);
  await publishPerformance(account2.agent, perfB);

  const feed = await getFeed('snatch', undefined, [PDS_1, PDS_2]);
  const sources = new Set(feed.map((item) => item.source));

  const hasPds1 = sources.has(PDS_1);
  const hasPds2 = sources.has(PDS_2);
  if (!hasPds1 || !hasPds2) {
    console.error('FAIL: feed missing a PDS source', {
      sources: [...sources],
      hasPds1,
      hasPds2,
    });
    process.exit(1);
  }

  console.log('PASS: feed contains performances from PDS_1 and PDS_2');
  console.log(`Count: ${feed.length} performances | Sources: ${sources.size} PDS`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
