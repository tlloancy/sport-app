import crypto from 'crypto';
import {
  actorStoreRootForPds,
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
    family: 'sport',
    discipline: 'halterophilie',
    movement,
    metricType: 'weight',
    value,
    unit: 'kg',
    videoHash,
    chunkManifest: '[]',
    createdAt,
  };
}

async function main() {
  const stamp = crypto.randomBytes(3).toString('hex');
  const accountSnatch = await createAccountOnPds(
    PDS_1,
    `snatch-${stamp}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_1)
  );
  const accountCj = await createAccountOnPds(
    PDS_2,
    `cj-${stamp}.test`,
    PASSWORD,
    undefined,
    actorStoreRootForPds(PDS_2)
  );

  if (!accountSnatch.agent || !accountCj.agent) {
    throw new Error('missing agents after account creation');
  }

  const now = Date.now();
  await publishPerformance(
    accountSnatch.agent,
    perf('snatch', 35, `hash-snatch-${stamp}`, new Date(now - 2000).toISOString())
  );
  await publishPerformance(
    accountSnatch.agent,
    perf('snatch', 40, `hash-snatch-40-${stamp}`, new Date(now - 1000).toISOString())
  );
  await publishPerformance(
    accountCj.agent,
    perf('clean & jerk', 50, `hash-cj-${stamp}`, new Date(now).toISOString())
  );

  const snatchFeed = await getFeed('halterophilie', 'snatch', PDS_URLS);
  const cjFeed = await getFeed('halterophilie', 'clean & jerk', PDS_URLS);

  const snatchValues = snatchFeed
    .filter((e) => e.record.videoHash.includes(stamp))
    .map((e) => e.record.value);
  const cjValues = cjFeed
    .filter((e) => e.record.videoHash.includes(stamp))
    .map((e) => e.record.value);

  if (!snatchValues.includes(35) || !snatchValues.includes(40)) {
    console.error('FAIL: snatch feed missing test performances', { snatchValues });
    process.exit(1);
  }
  if (!cjValues.includes(50)) {
    console.error('FAIL: clean & jerk feed missing test performance', { cjValues });
    process.exit(1);
  }
  console.log('PASS: movement filter isolates snatch vs clean & jerk');

  const board = await getLeaderboard('halterophilie', 'snatch', PDS_URLS);
  const ours = board.filter((e) => e.record.videoHash.includes(stamp));
  const values = ours.map((e) => e.record.value);

  if (values.length < 2 || values[0] !== 40) {
    console.error('FAIL: snatch leaderboard not sorted by weight', { values });
    process.exit(1);
  }
  console.log('PASS: leaderboard sorted correctly within movement');
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
