export const ELO_INITIAL = 1000;
export const ELO_K = 32;

function expected(score: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - score) / 400));
}

export function computeEloUpdate(
  winnerScore: number,
  loserScore: number
): { winner: number; loser: number } {
  const ew = expected(winnerScore, loserScore);
  const el = expected(loserScore, winnerScore);
  return {
    winner: winnerScore + ELO_K * (1 - ew),
    loser: loserScore + ELO_K * (0 - el),
  };
}
