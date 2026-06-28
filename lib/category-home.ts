import { listActiveDisciplines, listFamilies } from '@/lib/db';
import { loadFeedPage } from '@/lib/feed-server';
import type { FeedEntry } from '@/lib/feed-pagination';

export type FamilySummary = {
  slug: string;
  label: string;
  emoji: string;
  disciplineCount: number;
};

export type DisciplineSummary = {
  slug: string;
  label: string;
  family: string;
  metricType: string;
  perfCount: number;
  latest: FeedEntry | null;
};

export async function loadFamilySummaries(): Promise<FamilySummary[]> {
  const families = listFamilies();
  const disciplines = listActiveDisciplines();

  return families.map((family) => ({
    slug: family.slug,
    label: family.label,
    emoji: family.emoji,
    disciplineCount: disciplines.filter((d) => d.family === family.slug).length,
  }));
}

export async function loadDisciplineSummaries(family: string): Promise<DisciplineSummary[]> {
  const disciplines = listActiveDisciplines(family);
  const summaries: DisciplineSummary[] = [];

  for (const { slug, label, family: familySlug, metric_type } of disciplines) {
    const page = await loadFeedPage(slug, 1);
    summaries.push({
      slug,
      label,
      family: familySlug,
      metricType: metric_type,
      perfCount: page.total,
      latest: page.items[0] ?? null,
    });
  }

  return summaries;
}

export function getDefaultDisciplineSlug(): string {
  const disciplines = listActiveDisciplines();
  return disciplines[0]?.slug ?? 'halterophilie';
}
