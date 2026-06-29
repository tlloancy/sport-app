export function buildUploadHref(family?: string, discipline?: string): string {
  const params = new URLSearchParams();
  if (family) params.set('family', family.toLowerCase());
  if (discipline) params.set('discipline', discipline.toLowerCase());
  const qs = params.toString();
  return qs ? `/upload?${qs}` : '/upload';
}

export function familyHref(family: string): string {
  return `/famille/${family.toLowerCase()}`;
}

export function disciplineFeedHref(discipline: string): string {
  return `/${discipline.toLowerCase()}`;
}
