import { getLeaderboard, getPerformancesByDid, type PerformanceRecord } from '@/lib/atproto';
import { formatDidHandle } from '@/lib/did-display';
import {
  getActiveCategorySlugs,
  getEloScoresForUris,
  getModeratedOutUris,
  listActiveCategories,
  normalizeMovementSlug,
} from '@/lib/db';
import { pdsUrls } from '@/lib/upload-agent';

export type ProfilePerformance = {
  uri: string;
  rkey: string;
  record: PerformanceRecord;
  eloScore: number;
  voteCount: number;
};

export type TrancheRank = {
  tranche: string;
  label: string;
  topPercent: number;
};

export type ProfileCategory = {
  slug: string;
  label: string;
  eloScore: number;
  ranks: TrancheRank[];
  performances: ProfilePerformance[];
};

export type ProfilePayload = {
  did: string;
  handle: string;
  categories: ProfileCategory[];
};

function categoryLabel(slug: string): string {
  return listActiveCategories().find((c) => c.slug === slug)?.label ?? slug;
}

async function computeTrancheRank(
  movement: string,
  tranche: string,
  userBestValue: number
): Promise<TrancheRank | null> {
  const board = await getLeaderboard(movement, tranche, pdsUrls());
  if (board.length === 0) return null;

  const index = board.findIndex((entry) => entry.record.value <= userBestValue);
  const rank = index === -1 ? board.length : index + 1;
  const topPercent = Math.max(1, Math.ceil((rank / board.length) * 100));
  const label = categoryLabel(normalizeMovementSlug(movement));

  return {
    tranche,
    label: `Top ${topPercent}% en ${label} ${tranche}`,
    topPercent,
  };
}

export async function loadProfile(did: string): Promise<ProfilePayload> {
  const moderatedOut = getModeratedOutUris();
  const activeSlugs = getActiveCategorySlugs();
  const raw = (await getPerformancesByDid(did, pdsUrls())).filter(
    (item) => !moderatedOut.has(item.uri)
  );

  const uris = raw.map((item) => item.uri);
  const eloMap = getEloScoresForUris(uris);

  const byCategory = new Map<string, ProfilePerformance[]>();

  for (const item of raw) {
    const slug = normalizeMovementSlug(item.record.movement);
    if (!activeSlugs.has(slug)) continue;

    const elo = eloMap.get(item.uri)!;
    const perf: ProfilePerformance = {
      uri: item.uri,
      rkey: item.rkey,
      record: item.record,
      eloScore: elo.score,
      voteCount: elo.vote_count,
    };
    const list = byCategory.get(slug) ?? [];
    list.push(perf);
    byCategory.set(slug, list);
  }

  const categories: ProfileCategory[] = [];

  for (const [slug, performances] of Array.from(byCategory.entries())) {
    const eloScore =
      performances.reduce((sum, p) => sum + p.eloScore, 0) / performances.length;

    const bestByTranche = new Map<string, number>();
    for (const perf of performances) {
      const t = perf.record.tranche;
      if (!t) continue;
      const prev = bestByTranche.get(t);
      if (prev == null || perf.record.value > prev) {
        bestByTranche.set(t, perf.record.value);
      }
    }

    const ranks: TrancheRank[] = [];
    for (const [tranche, bestValue] of Array.from(bestByTranche.entries())) {
      const rank = await computeTrancheRank(slug, tranche, bestValue);
      if (rank) ranks.push(rank);
    }
    ranks.sort((a, b) => a.tranche.localeCompare(b.tranche));

    categories.push({
      slug,
      label: categoryLabel(slug),
      eloScore: Math.round(eloScore),
      ranks,
      performances: performances.sort(
        (a, b) =>
          new Date(b.record.createdAt).getTime() - new Date(a.record.createdAt).getTime()
      ),
    });
  }

  categories.sort((a, b) => a.label.localeCompare(b.label));

  return {
    did,
    handle: formatDidHandle(did),
    categories,
  };
}
