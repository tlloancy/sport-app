export type MetricType = 'weight' | 'time' | 'distance' | 'score' | 'none';

export type MetricUnit = 'kg' | 'lb' | 's' | 'm' | 'km' | 'pts';

export const METRIC_TYPES: MetricType[] = ['weight', 'time', 'distance', 'score', 'none'];

export const METRIC_UNITS: Record<MetricType, readonly MetricUnit[]> = {
  weight: ['kg', 'lb'],
  time: ['s'],
  distance: ['m', 'km'],
  score: ['pts'],
  none: [],
};

export const METRIC_LABELS: Record<MetricType, string> = {
  weight: 'Poids',
  time: 'Temps',
  distance: 'Distance',
  score: 'Score',
  none: 'Sans métrique',
};

export function isMetricType(value: string): value is MetricType {
  return (METRIC_TYPES as string[]).includes(value);
}

export function defaultMetricUnit(metricType: MetricType): MetricUnit | undefined {
  return METRIC_UNITS[metricType][0];
}

export function formatMetricValue(
  metricType: MetricType,
  value?: number,
  unit?: string
): string {
  if (metricType === 'none' || value == null) return '—';
  if (metricType === 'time' && unit === 's') {
    if (value >= 60) {
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
    return `${value}s`;
  }
  return `${value} ${unit ?? ''}`.trim();
}

/** Higher return = better performance (used for leaderboard sort). */
export function compareMetricValues(
  metricType: MetricType,
  a: number,
  b: number
): number {
  if (metricType === 'time') return b - a;
  return a - b;
}

export function validateMetricPayload(
  metricType: MetricType,
  value?: number,
  unit?: string
): string | null {
  if (metricType === 'none') {
    if (value != null) return 'Pas de métrique attendue pour cette discipline.';
    return null;
  }
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return 'Indique une valeur numérique valide.';
  }
  if (!unit || !METRIC_UNITS[metricType].includes(unit as MetricUnit)) {
    return 'Unité invalide pour cette discipline.';
  }
  return null;
}
