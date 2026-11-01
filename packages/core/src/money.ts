/**
 * Denaro di gioco: interi in crediti (₡), mai numeri decimali (DATA_MODEL.md §1).
 */

export type Credits = number;

export function credits(value: number): Credits {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Importo non intero: ${value}`);
  return value;
}

export function addCredits(...values: Credits[]): Credits {
  return credits(values.reduce((s, v) => s + v, 0));
}

/** Ripartisce un importo in parti intere proporzionali ai pesi, senza perdere crediti negli arrotondamenti. */
export function splitCredits(total: Credits, weights: readonly number[]): Credits[] {
  credits(total);
  const w = weights.reduce((s, x) => s + x, 0);
  if (w <= 0) throw new RangeError('splitCredits(): pesi non validi');
  const raw = weights.map((x) => (total * x) / w);
  const parts = raw.map(Math.floor);
  let rest = total - parts.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    parts[i] = (parts[i] as number) + 1;
    rest--;
  }
  return parts;
}

/** Formato breve per l'interfaccia: ₡ 18,42 M · ₡ 640 k · ₡ 950. */
export function formatCredits(value: Credits, locale: 'it' | 'en' = 'it'): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const dec = locale === 'it' ? ',' : '.';
  const fmt = (x: number, digits: number) => x.toFixed(digits).replace('.', dec);
  if (abs >= 1_000_000) return `${sign}₡ ${fmt(abs / 1_000_000, 2)} M`;
  if (abs >= 1_000) return `${sign}₡ ${fmt(abs / 1_000, abs >= 100_000 ? 0 : 1)} k`;
  return `${sign}₡ ${abs}`;
}
