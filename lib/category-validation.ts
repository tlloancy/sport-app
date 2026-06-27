const SLUG_RE = /^[a-z0-9-]{1,24}$/;
const LABEL_RE = /^[A-Z][A-Za-z0-9 &'-]{0,23}$/;

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

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function normalizeLabel(label: string): string {
  return label.trim();
}
