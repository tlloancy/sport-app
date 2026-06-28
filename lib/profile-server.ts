import { getLeaderboard, getPerformancesByDid, type PerformanceRecord } from '@/lib/atproto';
import { formatDidHandle } from '@/lib/did-display';
import {
  getActiveDisciplineSlugs,
  getDiscipline,
  getEloScoresForUris,
  getModeratedOutUris,
  listActiveDisciplines,
  normalizeMovement,
} from '@/lib/db';
import { compareMetricValues, formatMetricValue, type MetricType } from '@/lib/metrics';
import { pdsUrls } from '@/lib/upload-agent';

export type ProfilePerformance = {
  uri: string;
  rkey: string;
  record: PerformanceRecord;
  eloScore: number;
  voteCount: number;
};

export type MovementRank = {
  movement: string;
  label: string;
  topPercent: number;
};

export type ProfileDiscipline = {
  slug: string;
  label: string;
  eloScore: number;
  ranks: MovementRank[];
  performances: ProfilePerformance[];
};

export type ProfilePayload = {
  did: string;
  handle: string;
  disciplines: ProfileDiscipline[];
};

function disciplineLabel(slug: string): string {
  return listActiveDisciplines().find((d) => d.slug === slug)?.label ?? slug;
}

async function computeMovementRank(
  discipline: string,
  movement: string,
  metricType: MetricType,
  userBestValue: number
): Promise<MovementRank | null> {
  const board = await getLeaderboard(discipline, movement, pdsUrls());
  if (board.length === 0) return null;

  const index = board.findIndex(
    (entry) =>
      compareMetricValues(metricType, entry.record.value!, userBestValue) <= 0
  );
  const rank = index === -1 ? board.length : index + 1;
  const topPercent = Math.max(1, Math.ceil((rank / board.length) * 100));

  return {
    movement,
    label: `Top ${topPercent}% en ${movement} (${disciplineLabel(discipline)})`,
    topPercent,
  };
}

export async function loadProfile(did: string): Promise<ProfilePayload> {
  const moderatedOut = getModeratedOutUris();
  const activeSlugs = getActiveDisciplineSlugs();
  const raw = (await getPerformancesByDid(did, pdsUrls())).filter(
    (item) => !moderatedOut.has(item.uri)
  );

  const uris = raw.map((item) => item.uri);
  const eloMap = getEloScoresForUris(uris);

  const byDiscipline = new Map<string, ProfilePerformance[]>();

  for (const item of raw) {
    const slug = item.record.discipline.trim().toLowerCase();
    if (!activeSlugs.has(slug)) continue;

    const elo = eloMap.get(item.uri)!;
    const perf: ProfilePerformance = {
      uri: item.uri,
      rkey: item.rkey,
      record: item.record,
      eloScore: elo.score,
      voteCount: elo.vote_count,
    };
    const list = byDiscipline.get(slug) ?? [];
    list.push(perf);
    byDiscipline.set(slug, list);
  }

  const disciplines: ProfileDiscipline[] = [];

  for (const [slug, performances] of Array.from(byDiscipline.entries())) {
    const discipline = getDiscipline(slug);
    const metricType = (discipline?.metric_type ?? 'none') as MetricType;
    const eloScore =
      performances.reduce((sum, p) => sum + p.eloScore, 0) / performances.length;

    const bestByMovement = new Map<string, number>();
    for (const perf of performances) {
      if (perf.record.value == null) continue;
      const movement = normalizeMovement(perf.record.movement);
      const prev = bestByMovement.get(movement);
      if (
        prev == null ||
        compareMetricValues(metricType, perf.record.value, prev) > 0
      ) {
        bestByMovement.set(movement, perf.record.value);
      }
    }

    const ranks: MovementRank[] = [];
    if (metricType !== 'none') {
      for (const [movement, bestValue] of Array.from(bestByMovement.entries())) {
        const rank = await computeMovementRank(slug, movement, metricType, bestValue);
        if (rank) ranks.push(rank);
      }
    }
    ranks.sort((a, b) => a.movement.localeCompare(b.movement));

    disciplines.push({
      slug,
      label: disciplineLabel(slug),
      eloScore: Math.round(eloScore),
      ranks,
      performances: performances.sort(
        (a, b) =>
          new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
      ),
    });
  }

  disciplines.sort((a, b) => a.label.localeCompare(b.label));

  return {
    did,
    handle: formatDidHandle(did),
    disciplines,
  };
}

export { formatMetricValue };
