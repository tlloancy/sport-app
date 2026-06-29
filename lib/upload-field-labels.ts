import type { MetricType } from '@/lib/metrics';

export type UploadFieldLabels = {
  movementLabel: string;
  movementPlaceholder: string;
  metricHint?: string;
};

export function uploadFieldLabels(
  family: string,
  metricType: MetricType
): UploadFieldLabels {
  switch (family) {
    case 'jeux':
      return {
        movementLabel: 'Jeu',
        movementPlaceholder: 'Nom du jeu (ex. Celeste, Elden Ring…)',
        metricHint: 'Pas de score — la perf est jugée en duel vidéo (ELO).',
      };
    case 'cuisine':
      return {
        movementLabel: 'Recette',
        movementPlaceholder: 'Nom du plat (ex. oeuf dur, omelette, crêpe, salade…)',
        metricHint: 'Pas de métrique — jugement par duel.',
      };
    case 'art':
      return {
        movementLabel: 'Création',
        movementPlaceholder: 'Type ou titre (ex. portrait, speedpaint…)',
        metricHint: 'Pas de métrique — jugement par duel.',
      };
    case 'musique':
      return {
        movementLabel: 'Morceau',
        movementPlaceholder: 'Titre ou extrait (ex. moonlight sonata…)',
        metricHint: 'Pas de métrique — jugement par duel.',
      };
    case 'autre':
      return {
        movementLabel: 'Performance',
        movementPlaceholder: 'Décris ta perf en quelques mots…',
        metricHint: 'Pas de métrique — jugement par duel.',
      };
    default:
      break;
  }

  switch (metricType) {
    case 'time':
      return {
        movementLabel: 'Épreuve',
        movementPlaceholder: 'ex. 100 m, marathon, boss fight…',
      };
    case 'distance':
      return {
        movementLabel: 'Épreuve',
        movementPlaceholder: 'ex. saut en longueur, lancer…',
      };
    case 'score':
      return {
        movementLabel: 'Épreuve',
        movementPlaceholder: 'ex. figure, combo, run…',
      };
    case 'none':
      return {
        movementLabel: 'Performance',
        movementPlaceholder: 'Décris ta perf…',
        metricHint: 'Pas de métrique — jugement par duel.',
      };
    default:
      return {
        movementLabel: 'Mouvement',
        movementPlaceholder: 'ex. snatch, clean & jerk, jerk…',
      };
  }
}
