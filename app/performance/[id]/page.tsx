export const dynamic = 'force-dynamic';

import PerformanceClient from './PerformanceClient';
import { getPerformanceByRkey, resolvePeerFromDID } from '@/lib/atproto';
import { getGatewayPeerId } from '@/lib/p2p-gateway';
import { formatMetricValue, type MetricType } from '@/lib/metrics';
import { pdsUrl } from '@/lib/upload-agent';

export default async function PerformancePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { did?: string };
}) {
  const did = searchParams.did;
  if (!did) {
    return (
      <main className="p-8">
        <p className="text-red-600">Missing did query parameter.</p>
      </main>
    );
  }

  const { record } = await getPerformanceByRkey(pdsUrl(), did, params.id);
  const hashes = record.chunkManifest ? (JSON.parse(record.chunkManifest) as string[]) : [];
  const peerId =
    (await resolvePeerFromDID(did, pdsUrl())) ?? (await getGatewayPeerId()) ?? 'local-peer';
  const peers = [peerId];

  const metricDisplay = formatMetricValue(
    record.metricType as MetricType,
    record.value,
    record.unit
  );

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-8">
      <h1 className="text-xl font-semibold">
        {record.movement}
        {metricDisplay !== '—' ? ` — ${metricDisplay}` : ''}
      </h1>
      <p className="text-sm text-gray-500">
        {record.discipline}
      </p>
      <PerformanceClient chunkManifest={hashes} peers={peers} />
    </main>
  );
}
