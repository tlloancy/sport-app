import { METRIC_TYPES, type MetricType } from '@/lib/metrics';

const SLUG_RE = /^[a-z0-9-]{1,24}$/;
const LABEL_RE = /^[A-ZÀ-ÖØ-Ý][A-Za-z0-9À-ÖØ-öø-ÿ &'-]{0,23}$/;
const MOVEMENT_RE = /^[a-z0-9][a-z0-9 &'-]{0,47}$/;

export function validateSlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_RE.test(normalized)) {
    return 'Slug invalide (max 24 car., lowercase, a-z 0-9 -).';
  }
  return null;
}

export function validateLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!LABEL_RE.test(trimmed)) {
    return 'Label invalide (max 24 car., commence par une majuscule).';
  }
  return null;
}

export function validateFamily(family: string): string | null {
  if (!family.trim()) return 'Famille requise.';
  return validateSlug(family);
}

export function validateMetricType(metricType: string): string | null {
  if (!(METRIC_TYPES as string[]).includes(metricType)) {
    return 'Type de métrique invalide.';
  }
  return null;
}

export function validateMovement(movement: string): string | null {
  const normalized = normalizeMovementInput(movement);
  if (!normalized) return 'Mouvement requis.';
  if (!MOVEMENT_RE.test(normalized)) {
    return 'Mouvement invalide (max 48 car., lowercase).';
  }
  return null;
}

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function normalizeLabel(label: string): string {
  return label.trim();
}

export function normalizeMovementInput(movement: string): string {
  return movement.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseMetricType(metricType: string): MetricType | null {
  return (METRIC_TYPES as string[]).includes(metricType) ? (metricType as MetricType) : null;
}
