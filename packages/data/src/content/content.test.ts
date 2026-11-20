import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CIRCUITS,
  MANUFACTURERS,
  NAMES,
  PRESET_RIDERS,
  RIDER_NATIONALITY_WEIGHTS,
  STAFF_NATIONALITY_WEIGHTS,
  TEAMS,
} from './index.ts';
import { isBlockedSurname } from './realNames.ts';

describe('content pack', () => {
  const mfr = new Map(MANUFACTURERS.map((m) => [m.key, m]));

  it('ogni squadra usa un costruttore esistente che fornisce la sua categoria', () => {
    for (const t of TEAMS) {
      const m = mfr.get(t.manufacturer);
      expect(m, t.key).toBeDefined();
      expect(m!.categories, t.key).toContain(t.category);
      if ('manufacturer' in t.owner) expect(t.owner.manufacturer, t.key).toBe(t.manufacturer);
    }
  });

  it('chiavi uniche e colori validi', () => {
    for (const list of [
      TEAMS.map((t) => t.key),
      MANUFACTURERS.map((m) => m.key),
      CIRCUITS.map((c) => c.key),
    ]) {
      expect(new Set(list).size).toBe(list.length);
    }
    for (const t of TEAMS)
      for (const c of Object.values(t.colors)) expect(c, t.key).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('squadre per categoria compatibili con la griglia', () => {
    for (const c of CATEGORIES) {
      const n = TEAMS.filter((t) => t.category === c.key).length;
      if (c.teamsManaged) expect(n * 2, c.key).toBe(c.maxGrid);
      else expect(n, c.key).toBe(1);
    }
  });

  it('calendario in ordine cronologico e round delle categorie esistenti', () => {
    const d = CIRCUITS.map((c) => c.date[0] * 100 + c.date[1]);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    for (const c of CATEGORIES) for (const i of c.rounds ?? []) expect(CIRCUITS[i], c.key).toBeDefined();
  });

  it('nomi: ogni nazionalità pesata ha un elenco e nessun cognome di piloti reali', () => {
    for (const n of [...Object.keys(RIDER_NATIONALITY_WEIGHTS), ...Object.keys(STAFF_NATIONALITY_WEIGHTS)])
      expect(NAMES[n], n).toBeDefined();
    const blocked = Object.entries(NAMES).flatMap(([n, p]) =>
      p.last.filter(isBlockedSurname).map((l) => `${n}:${l}`),
    );
    expect(blocked).toEqual([]);
    for (const p of PRESET_RIDERS) expect(isBlockedSurname(p.lastName)).toBe(false);
  });
});
