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

function perf(value: number, videoHash: string, createdAt: string): PerformanceRecord {
  return {
    family: 'sport',
    discipline: 'halterophilie',
    movement: 'snatch',
    metricType: 'weight',
    value,
    unit: 'kg',
    videoHash,
    chunkManifest: '[]',
    createdAt,
  };
}

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

  await publishPerformance(
    account1.agent,
    perf(40, 'hash-pds1-step8', new Date(Date.now() - 60_000).toISOString())
  );
  await publishPerformance(
    account2.agent,
    perf(55, 'hash-pds2-step8', new Date().toISOString())
  );

  const feed = await getFeed('halterophilie', undefined, [PDS_1, PDS_2]);
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
