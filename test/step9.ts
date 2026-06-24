import crypto from 'crypto';
import {
  actorStoreRootForPds,
  assignTranche,
  createAccountOnPds,
  getFeed,
  getLeaderboard,
  publishPerformance,
  type PerformanceRecord,
} from '../lib/atproto';

const PDS_1 = process.env.PDS_1_URL ?? 'http://localhost:2583';
const PDS_2 = process.env.PDS_2_URL ?? 'http://localhost:2584';
const PDS_URLS = [PDS_1, PDS_2];
const PASSWORD = 'testpass-step9';

function perf(
  movement: string,
  value: number,
  videoHash: string,
  createdAt: string
): PerformanceRecord {
  return {
    movement,
    value,
    unit: 'kg',
    videoHash,
    chunkManifest: '[]',
    createdAt,
  };
}

async function main() {
  if (assignTranche('snatch', 35, 'kg') !== 'T2') {
    throw new Error('assignTranche: 35kg snatch should be T2');
  }
  if (assignTranche('snatch', 25, 'kg') !== 'T1') {
    throw new Error('assignTranche: 25kg snatch should be T1');
  }

  const stamp = crypto.randomBytes(3).toString('hex');
  const accountT1 = await createAccountOnPds(
    PDS_1,
    `snatch-t1-${stamp}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_1)
  );
  const accountT2a = await createAccountOnPds(
    PDS_1,
    `snatch-t2a-${stamp}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_1)
  );
  const accountT2b = await createAccountOnPds(
    PDS_2,
    `snatch-t2b-${stamp}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_2)
  );
  const accountT2c = await createAccountOnPds(
    PDS_2,
    `snatch-t2c-${stamp}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_2)
  );

  if (!accountT1.agent || !accountT2a.agent || !accountT2b.agent || !accountT2c.agent) {
    throw new Error('missing agents after account creation');
  }

  const now = Date.now();
  await publishPerformance(
    accountT1.agent,
    perf('snatch', 25, `hash-25-${stamp}`, new Date(now - 3000).toISOString())
  );
  await publishPerformance(
    accountT2a.agent,
    perf('snatch', 35, `hash-35a-${stamp}`, new Date(now - 2000).toISOString())
  );
  await publishPerformance(
    accountT2b.agent,
    perf('snatch', 35, `hash-35b-${stamp}`, new Date(now - 1000).toISOString())
  );
  await publishPerformance(
    accountT2c.agent,
    perf('snatch', 40, `hash-40-${stamp}`, new Date(now).toISOString())
  );

  const feedT2 = await getFeed('snatch', 'T2', PDS_URLS);
  const feedT1 = await getFeed('snatch', 'T1', PDS_URLS);
  const feedT3 = await getFeed('snatch', 'T3', PDS_URLS);

  const t2Values = feedT2.filter((e) => e.record.videoHash.includes(stamp)).map((e) => e.record.value);
  const t1Values = feedT1.filter((e) => e.record.videoHash.includes(stamp)).map((e) => e.record.value);
  const t3Values = feedT3.filter((e) => e.record.videoHash.includes(stamp)).map((e) => e.record.value);

  if (!t2Values.includes(35)) {
    console.error('FAIL: snatch 35kg not in T2 feed', { t2Values });
    process.exit(1);
  }
  if (t1Values.includes(35) || t3Values.includes(35)) {
    console.error('FAIL: snatch 35kg leaked into T1 or T3', { t1Values, t3Values });
    process.exit(1);
  }
  if (!t1Values.includes(25)) {
    console.error('FAIL: snatch 25kg not in T1 feed', { t1Values });
    process.exit(1);
  }
  console.log('PASS: snatch 35kg appears in T2 — not in T1 or T3');

  const board = await getLeaderboard('snatch', 'T2', PDS_URLS);
  const ours = board.filter((e) => e.record.videoHash.includes(stamp));
  const values = ours.map((e) => e.record.value);

  if (values.length < 3 || !values.includes(35) || !values.includes(40)) {
    console.error('FAIL: T2 leaderboard missing test performances', { values });
    process.exit(1);
  }
  if (values.includes(25)) {
    console.error('FAIL: T1 performance (25kg) present in T2 leaderboard', { values });
    process.exit(1);
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] < values[i]) {
      console.error('FAIL: leaderboard not sorted descending', { values });
      process.exit(1);
    }
  }
  console.log('PASS: leaderboard sorted correctly within tranche');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
