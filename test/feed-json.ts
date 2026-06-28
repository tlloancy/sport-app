import {
  DEFAULT_PDS_URL,
  getFeed,
  publishPerformance,
  type PerformanceRecord,
} from '../lib/atproto';
import { getUploadAgent } from '../lib/upload-agent';

function assertRecordShape(item: {
  uri: string;
  record: PerformanceRecord;
  source: string;
}): void {
  const { uri, record, source } = item;
  if (!uri.startsWith('at://')) throw new Error(`invalid uri: ${uri}`);
  if (source !== DEFAULT_PDS_URL) throw new Error(`unexpected source: ${source}`);
  if (typeof record.discipline !== 'string') throw new Error('record.discipline missing');
  if (typeof record.movement !== 'string') throw new Error('record.movement missing');
  if (typeof record.metricType !== 'string') throw new Error('record.metricType missing');
  if (typeof record.videoHash !== 'string') throw new Error('record.videoHash missing');
  if (typeof record.createdAt !== 'string') throw new Error('record.createdAt missing');
}

async function main() {
  const marker = `feed-json-${Date.now()}`;
  const agent = await getUploadAgent();
  const performance: PerformanceRecord = {
    family: 'sport',
    discipline: 'halterophilie',
    movement: 'snatch',
    metricType: 'weight',
    value: 37,
    unit: 'kg',
    videoHash: marker,
    chunkManifest: '[]',
    createdAt: new Date().toISOString(),
  };

  await publishPerformance(agent, performance);

  const feed = await getFeed('halterophilie', undefined, [DEFAULT_PDS_URL]);
  if (feed.length === 0) {
    throw new Error('getFeed returned no records');
  }

  for (const item of feed) {
    assertRecordShape(item);
  }

  const published = feed.find((item) => item.record.videoHash === marker);
  if (!published) {
    throw new Error(`published record not found in feed (marker=${marker})`);
  }

  console.log('PASS: feed returns valid JSON records');
  console.log(
    JSON.stringify(
      {
        count: feed.length,
        sample: {
          uri: published.uri,
          discipline: published.record.discipline,
          movement: published.record.movement,
          value: published.record.value,
          unit: published.record.unit,
          videoHash: published.record.videoHash,
          createdAt: published.record.createdAt,
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
