/**
 * Serializzazione dello stato con versione e migrazioni (ADR-0002, ARCHITECTURE.md §7).
 * La compressione (fflate) e l'accesso al disco appartengono al pacchetto persistence.
 */
import { SCHEMA_VERSION, type GameState } from './schema/state.ts';

/** Migrazione dalla versione n alla n+1. Registrata con chiave n. */
export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /** v1 → v2: aggiunta la tabella delle trattative di mercato. */
  1: (s) => {
    const tables = (s.tables ?? {}) as Record<string, unknown>;
    return { ...s, tables: { ...tables, negotiations: tables.negotiations ?? {} } };
  },
  /** v2 → v3: risultati delle sessioni e notizie. */
  2: (s) => {
    const tables = (s.tables ?? {}) as Record<string, unknown>;
    return {
      ...s,
      tables: { ...tables, sessionResults: tables.sessionResults ?? {}, news: tables.news ?? {} },
    };
  },
  /** v3 → v4: upgrade dei componenti e sponsor con obiettivo stagionale. */
  3: (s) => {
    const tables = (s.tables ?? {}) as Record<string, unknown>;
    return {
      ...s,
      upgrades: s.upgrades ?? {},
      tables: { ...tables, sponsorDeals: tables.sponsorDeals ?? {} },
    };
  },
  /** v4 → v5: ordini degli upgrade alla fabbrica (tempi di produzione). */
  4: (s) => {
    const tables = (s.tables ?? {}) as Record<string, unknown>;
    return { ...s, tables: { ...tables, upgradeOrders: tables.upgradeOrders ?? {} } };
  },
  /**
   * v5 → v6: la griglia iniziale è solo maschile. Le due pilote della Intermediate del mondo fisso
   * diventano due piloti nuovi: stesso identificativo (contratti, risultati, legami restano validi),
   * nuovo nome. Aggiornate anche le notizie che le citavano.
   */
  5: (s) => {
    const tables = (s.tables ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
    const riders = tables.riders ?? {};
    const taken = new Set(Object.values(riders).map((r) => `${r.firstName} ${r.lastName}`));
    const renames: [string, string][] = [];
    for (const [from, to] of RIDER_RENAMES_V6) {
      const [f0, l0, nat] = from;
      const r = Object.values(riders).find(
        (x) => x.firstName === f0 && x.lastName === l0 && x.nationality === nat,
      );
      if (!r || taken.has(`${to[0]} ${to[1]}`)) continue;
      r.firstName = to[0];
      r.lastName = to[1];
      renames.push([`${f0} ${l0}`, `${to[0]} ${to[1]}`], [l0, to[1]]);
    }
    if (renames.length > 0)
      for (const n of Object.values(tables.news ?? {}))
        for (const k of ['title', 'body'] as const)
          if (typeof n[k] === 'string')
            n[k] = renames.reduce((t, [a, b]) => (t as string).split(a).join(b), n[k]);
    return s;
  },
};

/** Pilote della griglia iniziale sostituite in v6: [nome, cognome, nazionalità] → [nome, cognome]. */
export const RIDER_RENAMES_V6: readonly [readonly [string, string, string], readonly [string, string]][] = [
  [
    ['Beatrice', 'Galimberti', 'ITA'],
    ['Elia', 'Rinaldini'],
  ],
  [
    ['Paula', 'Urquiza', 'ESP'],
    ['Gonzalo', 'Llorente'],
  ],
];

export class SaveFormatError extends Error {}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(
  json: string,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): GameState {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new SaveFormatError('Salvataggio non leggibile (JSON non valido)');
  }
  const raw = data.schemaVersion;
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1) {
    throw new SaveFormatError('Salvataggio senza versione dello schema');
  }
  let version: number = raw;
  if (version > SCHEMA_VERSION) {
    throw new SaveFormatError(
      `Salvataggio creato con una versione più recente del gioco (schema ${version})`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const m = migrations[version];
    if (!m) throw new SaveFormatError(`Migrazione mancante dalla versione ${version}`);
    data = m(data);
    version += 1;
    data.schemaVersion = version;
  }
  if (
    typeof data.meta !== 'object' ||
    typeof data.tables !== 'object' ||
    data.meta === null ||
    data.tables === null
  ) {
    throw new SaveFormatError('Struttura del salvataggio non valida');
  }
  return data as unknown as GameState;
}
