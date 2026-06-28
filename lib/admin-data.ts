import { getFeed } from '@/lib/atproto';
import { getModerationMap, listActiveDisciplines, listAllDisciplines } from '@/lib/db';
import { formatMetricValue } from '@/lib/metrics';
import { pdsUrls } from '@/lib/upload-agent';

export type AdminPerformance = {
  uri: string;
  rkey: string;
  family: string;
  discipline: string;
  movement: string;
  metricType: string;
  displayValue: string;
  createdAt: string;
  hidden: boolean;
  deleted: boolean;
};

export async function listPerformancesForAdmin(): Promise<AdminPerformance[]> {
  const disciplines = listActiveDisciplines();
  const moderation = getModerationMap();
  const byUri = new Map<string, AdminPerformance>();

  for (const discipline of disciplines) {
    const feed = await getFeed(discipline.slug, undefined, pdsUrls());
    for (const { uri, record } of feed) {
      const mod = moderation.get(uri);
      byUri.set(uri, {
        uri,
        rkey: uri.split('/').pop()!,
        family: record.family,
        discipline: record.discipline,
        movement: record.movement,
        metricType: record.metricType,
        displayValue: formatMetricValue(record.metricType, record.value, record.unit),
        createdAt: record.createdAt,
        hidden: (mod?.hidden ?? 0) === 1,
        deleted: (mod?.deleted ?? 0) === 1,
      });
    }
  }

  return Array.from(byUri.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listDisciplinesForAdmin() {
  return listAllDisciplines().map(({ slug, label, family, metric_type, active }) => ({
    slug,
    label,
    family,
    metricType: metric_type,
    active: active === 1,
  }));
}
