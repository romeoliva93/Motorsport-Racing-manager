/**
 * Denaro di gioco: interi in euro, mai numeri decimali (DATA_MODEL.md §1).
 * L'interfaccia mostra gli importi in milioni di euro.
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

/**
 * Formato per l'interfaccia, sempre in milioni di euro: € 25,02 mln · € 0,64 mln · € 0,015 mln.
 * Sotto i 100.000 € usa tre decimali per non perdere informazione (es. bonus e premi minori).
 */
export function formatMoney(value: Credits, locale: 'it' | 'en' = 'it'): string {
  const sign = value < 0 ? '−' : '';
  // sotto i 100 mila: cifra intera, più leggibile di "€ 0,027 mln"
  if (value !== 0 && Math.abs(value) < 100_000) {
    const k = Math.round(Math.abs(value))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'it' ? '.' : ',');
    return locale === 'it' ? `${sign}€ ${k}` : `${sign}€${k}`;
  }
  const m = Math.abs(value) / 1_000_000;
  const digits = Math.abs(value) >= 100_000 || value === 0 ? 2 : 3;
  const n = m.toFixed(digits);
  return locale === 'it' ? `${sign}€ ${n.replace('.', ',')} mln` : `${sign}€${n}m`;
}
