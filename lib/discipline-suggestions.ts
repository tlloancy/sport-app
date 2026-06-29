/** Starter hints for the upload datalist (merged with names already on the feed). */
export const DISCIPLINE_MOVEMENT_SUGGESTIONS: Record<string, readonly string[]> = {
  recette: ['oeuf dur', 'omelette', 'crepe', 'salade', 'pates carbonara', 'tarte au citron'],
  'jeu-video': ['celeste', 'elden ring', 'minecraft', 'valorant', 'zelda'],
  creation: ['portrait', 'speedpaint', 'dessin', 'sculpture'],
  morceau: ['piano', 'guitare', 'beatbox', 'cover'],
  libre: [],
};

export function movementSuggestionsForDiscipline(
  discipline: string,
  fromFeed: string[]
): string[] {
  const starters = DISCIPLINE_MOVEMENT_SUGGESTIONS[discipline] ?? [];
  return Array.from(new Set([...starters, ...fromFeed])).sort((a, b) =>
    a.localeCompare(b, 'fr')
  );
}
