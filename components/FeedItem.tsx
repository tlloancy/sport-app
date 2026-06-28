import VideoPlayer from '@/components/VideoPlayer';
import { resolvePeerFromDID, type PerformanceRecord } from '@/lib/atproto';
import { formatMetricValue, type MetricType } from '@/lib/metrics';
import { pdsUrl } from '@/lib/upload-agent';

export default async function FeedItem({
  uri,
  record,
}: {
  uri: string;
  record: PerformanceRecord;
}) {
  const rkey = uri.split('/').pop()!;
  const did = uri.replace(/^at:\/\//, '').split('/')[0]!;
  const hashes = record.chunkManifest
    ? (JSON.parse(record.chunkManifest) as string[])
    : [];
  const peerId = (await resolvePeerFromDID(did, pdsUrl())) ?? 'local-peer';
  const metricDisplay = formatMetricValue(
    record.metricType as MetricType,
    record.value,
    record.unit
  );

  return (
    <article
      data-testid={`feed-item-${rkey}`}
      className="border-b border-neutral-200 py-8 first:pt-0 last:border-b-0"
    >
      <header className="mb-4">
        <h2 className="text-lg font-medium">
          {record.movement}
          {metricDisplay !== '—' ? (
            <>
              {' '}
              <span className="text-neutral-500">·</span> {metricDisplay}
            </>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">{record.discipline}</p>
      </header>
      {hashes.length > 0 ? (
        <VideoPlayer chunkManifest={hashes} peers={[peerId]} autoPlay={false} />
      ) : null}
    </article>
  );
}
