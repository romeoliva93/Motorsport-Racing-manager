/**
 * Identificativi stabili con prefisso (DATA_MODEL.md §1): `rdr_000123`, `tem_000004`, …
 * Il tipo `Id<'rdr'>` impedisce di passare per errore l'ID di una squadra dove serve un pilota.
 */

export type Id<P extends string> = `${P}_${string}`;

const ID_PATTERN = /^([a-z]{3})_(\d{6,})$/;

export function isId<P extends string>(value: unknown, prefix: P): value is Id<P> {
  if (typeof value !== 'string') return false;
  const m = ID_PATTERN.exec(value);
  return m !== null && m[1] === prefix;
}

export function idPrefix(id: string): string | null {
  return ID_PATTERN.exec(id)?.[1] ?? null;
}

/** Genera ID progressivi per prefisso. Lo stato (contatori) è serializzabile. */
export class IdFactory {
  private readonly counters: Map<string, number>;

  constructor(saved?: Readonly<Record<string, number>>) {
    this.counters = new Map(Object.entries(saved ?? {}));
  }

  next<P extends string>(prefix: P): Id<P> {
    if (!/^[a-z]{3}$/.test(prefix)) throw new RangeError(`Prefisso ID non valido: "${prefix}"`);
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}_${String(n).padStart(6, '0')}` as Id<P>;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries([...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }
}
