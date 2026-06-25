// Auto-generated from lexicons/sport.tranche.json — do not edit manually.

export const MOVEMENT_THRESHOLDS = {
  "snatch": {
    "T1": [
      0,
      30
    ],
    "T2": [
      31,
      50
    ],
    "T3": [
      51,
      70
    ],
    "T4": [
      71,
      90
    ],
    "T5": [
      91,
      999
    ]
  },
  "deadlift": {
    "T1": [
      0,
      60
    ],
    "T2": [
      61,
      100
    ],
    "T3": [
      101,
      140
    ],
    "T4": [
      141,
      180
    ],
    "T5": [
      181,
      999
    ]
  }
} as const;

export type TrancheUnit = keyof typeof MOVEMENT_THRESHOLDS extends string
  ? "kg"
  : never;

/** Assign tranche from movement thresholds (kg movements only for now). */
export function assignTranche(movement: string, value: number, unit: string): string {
  if (unit !== "kg") {
    throw new Error(`Tranche assignment not defined for unit: ${unit}`);
  }
  const bands = MOVEMENT_THRESHOLDS[movement as keyof typeof MOVEMENT_THRESHOLDS];
  if (!bands) {
    throw new Error(`Unknown movement for tranche: ${movement}`);
  }
  for (const [id, range] of Object.entries(bands)) {
    const [min, max] = range as [number, number];
    if (value >= min && value <= max) return id;
  }
  const ids = Object.keys(bands);
  return ids[ids.length - 1] ?? "T1";
}
