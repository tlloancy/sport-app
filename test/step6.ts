import crypto from 'crypto';
import { AtpAgent } from '@atproto/api';
import {
  createAccountOnPds,
  getRecord,
  publishPerformance,
  type PerformanceRecord,
} from '../lib/atproto';

const PDS_URL = process.env.PDS_URL ?? 'http://localhost:2583';

async function main() {
  const handle = `athlete-${crypto.randomBytes(4).toString('hex')}.test`;
  const password = 'testpass-step6';

  const identity = await createAccountOnPds(PDS_URL, handle, password);
  const agent = identity.agent;
  if (!agent?.session?.did) {
    throw new Error('failed to create/authenticate account on local PDS');
  }

  const performance: PerformanceRecord = {
    family: 'sport',
    discipline: 'halterophilie',
    movement: 'snatch',
    metricType: 'weight',
    value: 35,
    unit: 'kg',
    videoHash: 'fakehash123',
    chunkManifest: '[]',
    createdAt: new Date().toISOString(),
  };

  const uri = await publishPerformance(agent, performance);
  const retrieved = await getRecord(agent, uri);
  const record = retrieved.value as unknown as PerformanceRecord;

  if (
    record.movement !== 'snatch' ||
    record.value !== 35 ||
    record.discipline !== 'halterophilie'
  ) {
    console.error('FAIL: record fields mismatch', record);
    process.exit(1);
  }

  console.log('PASS: record retrieved from PDS via getRecord()');
  console.log(`URI: ${uri}`);
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
