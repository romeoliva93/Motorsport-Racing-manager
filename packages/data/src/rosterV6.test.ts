import { describe, expect, it } from 'vitest';
import { generateWorld } from './worldgen/generateWorld.ts';
import { deserializeState, RIDER_RENAMES_V6, serializeState } from './serialize.ts';
import { rows } from './index.ts';

const SEED = 'lean-angle-universo-1';

describe('griglia iniziale solo maschile (v6)', () => {
  it('nessuna pilota nel mondo fisso; i due nuovi piloti hanno gli identificativi di prima', () => {
    const s = generateWorld({ seed: SEED });
    const riders = rows(s, 'riders');
    for (const [[f, l]] of RIDER_RENAMES_V6)
      expect(riders.some((r) => r.firstName === f && r.lastName === l)).toBe(false);
    expect(riders.find((r) => r.id === 'rdr_000030')).toMatchObject({
      firstName: 'Elia',
      lastName: 'Rinaldini',
      nationality: 'ITA',
    });
    expect(riders.find((r) => r.id === 'rdr_000046')).toMatchObject({
      firstName: 'Gonzalo',
      lastName: 'Llorente',
      nationality: 'ESP',
    });
    expect(new Set(riders.map((r) => `${r.firstName} ${r.lastName}`)).size).toBe(riders.length);
  });

  it('la migrazione v5 → v6 rinomina le pilote nei salvataggi esistenti e lascia tutto il resto', () => {
    const now = generateWorld({ seed: SEED });
    const old = JSON.parse(serializeState(now)) as {
      schemaVersion: number;
      tables: Record<string, Record<string, Record<string, unknown>>>;
    };
    old.schemaVersion = 5;
    old.tables.riders!.rdr_000030!.firstName = 'Beatrice';
    old.tables.riders!.rdr_000030!.lastName = 'Galimberti';
    old.tables.riders!.rdr_000046!.firstName = 'Paula';
    old.tables.riders!.rdr_000046!.lastName = 'Urquiza';
    old.tables.news = {
      n1: {
        id: 'n1',
        day: 0,
        tag: 'gara',
        title: 'Galimberti sul podio',
        body: 'Beatrice Galimberti terza.',
        mine: false,
      },
    };
    const back = deserializeState(JSON.stringify(old));
    expect(back.tables.riders).toEqual(now.tables.riders);
    expect(back.tables.contracts).toEqual(now.tables.contracts);
    const n = (back.tables.news as Record<string, { title: string; body: string }>).n1!;
    expect(n.title).toBe('Rinaldini sul podio');
    expect(n.body).toBe('Elia Rinaldini terza.');
  });
});
