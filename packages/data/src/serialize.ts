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
};

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
