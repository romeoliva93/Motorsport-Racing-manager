import { describe, expect, it } from 'vitest';
import { buildMiniWorld } from './testing/fixtures.ts';
import { deserializeState, SaveFormatError, serializeState, type Migration } from './serialize.ts';
import { SCHEMA_VERSION } from './schema/state.ts';

describe('serializzazione', () => {
  it('andata e ritorno senza perdite', () => {
    const s = buildMiniWorld();
    const back = deserializeState(serializeState(s));
    expect(back).toEqual(s);
    expect(serializeState(back)).toBe(serializeState(s));
  });

  it('rifiuta salvataggi corrotti o di versioni future', () => {
    expect(() => deserializeState('{not json')).toThrow(SaveFormatError);
    expect(() => deserializeState('{"meta":{},"tables":{}}')).toThrow(/versione/);
    expect(() =>
      deserializeState(JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, meta: {}, tables: {} })),
    ).toThrow(/più recente/);
  });

  it('migra i salvataggi della versione 1 (senza trattative)', () => {
    const v1 = JSON.parse(serializeState(buildMiniWorld())) as Record<string, unknown> & {
      tables: Record<string, unknown>;
    };
    v1.schemaVersion = 1;
    delete v1.tables.negotiations;
    delete v1.tables.sessionResults;
    delete v1.tables.news;
    const migrated = deserializeState(JSON.stringify(v1));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.tables.negotiations).toEqual({});
    expect(migrated.tables.sessionResults).toEqual({});
    expect(migrated.tables.news).toEqual({});
  });

  it('applica le migrazioni in sequenza', () => {
    const old = { ...buildMiniWorld(), schemaVersion: SCHEMA_VERSION - 1 } as Record<string, unknown>;
    if (SCHEMA_VERSION - 1 < 1) {
      // Con lo schema alla versione 1 non esistono versioni precedenti: verifichiamo il meccanismo con una catena fittizia.
      const v0 = { ...buildMiniWorld(), schemaVersion: 1 } as Record<string, unknown>;
      const migrations: Record<number, Migration> = { 1: (d) => ({ ...d, migrated: true }) };
      expect(() => deserializeState(JSON.stringify(v0), migrations)).not.toThrow();
      return;
    }
    expect(() => deserializeState(JSON.stringify(old), {})).toThrow(/Migrazione mancante/);
  });
});
