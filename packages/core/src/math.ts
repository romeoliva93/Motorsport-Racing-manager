/** Utilità numeriche condivise dalla simulazione. */

export const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));
export const clamp01 = (x: number): number => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Posizione di x fra a e b (0..1 se compreso). */
export const invLerp = (a: number, b: number, x: number): number => (a === b ? 0 : (x - a) / (b - a));

/** Funzione logistica, usata per probabilità (es. sorpassi, diagnosi). */
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

export const sum = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0);
export const mean = (xs: readonly number[]): number => (xs.length === 0 ? NaN : sum(xs) / xs.length);

export function stdDev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/** Arrotonda a `decimals` cifre decimali. */
export const roundTo = (x: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
};

/** Converte un attributo visibile 1–100 nel valore 0–1 usato dalla simulazione (DATA_MODEL.md §1). */
export const attr01 = (rating: number): number => clamp01((rating - 1) / 99);
