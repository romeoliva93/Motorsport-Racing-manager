import { describe, expect, it } from 'vitest';
import { GameCalendar } from '@lean-angle/core';
import { generateWorld } from './generateWorld.ts';
import { validateGameState, teamBalance } from '../validate.ts';
import { serializeState } from '../serialize.ts';
import { rows } from '../tables.ts';
import { isBlockedSurname } from '../content/realNames.ts';
import { RIDER_ATTRIBUTES, type Rider } from '../schema/people.ts';
import type { GameState } from '../schema/state.ts';

const world = generateWorld({ seed: 'lean-angle-test' });
const avg = (r: Rider) => RIDER_ATTRIBUTES.reduce((s, a) => s + r.attributes[a], 0) / RIDER_ATTRIBUTES.length;
const catOf = (s: GameState, tier: string) => rows(s, 'categories').find((c) => c.tier === tier)!;
const entriesOf = (s: GameState, tier: string) =>
  rows(s, 'teamEntries').filter((e) => e.categoryId === catOf(s, tier).id);

describe('generateWorld', () => {
  it('produce un mondo che supera tutte le regole del validatore', () => {
    expect(validateGameState(world)).toEqual([]);
  });

  it('è deterministico: stesso seme → stesso mondo', () => {
    const again = generateWorld({ seed: 'lean-angle-test' });
    expect(serializeState(again)).toBe(serializeState(world));
  });

  it('semi diversi producono mondi diversi', () => {
    const other = generateWorld({ seed: 'altro-seme' });
    const names = (s: GameState) =>
      rows(s, 'riders')
        .map((r) => `${r.firstName} ${r.lastName}`)
        .sort()
        .join('|');
    expect(names(other)).not.toBe(names(world));
    expect(validateGameState(other)).toEqual([]);
  });

  it('genera le griglie previste per categoria', () => {
    const grid = (tier: string) => entriesOf(world, tier).flatMap((e) => e.seats).length;
    expect(entriesOf(world, 'premier')).toHaveLength(11);
    expect(grid('premier')).toBe(22);
    expect(entriesOf(world, 'intermediate')).toHaveLength(15);
    expect(grid('intermediate')).toBe(30);
    expect(entriesOf(world, 'lightweight')).toHaveLength(14);
    expect(grid('lightweight')).toBe(28);
    expect(grid('rookies')).toBe(24);
  });

  it('moto per pilota: Premier 2 (A e B), altre categorie 1', () => {
    for (const tier of ['premier', 'intermediate', 'lightweight', 'rookies']) {
      const expected = tier === 'premier' ? ['A', 'B'] : ['A'];
      for (const seat of entriesOf(world, tier).flatMap((e) => e.seats)) {
        const slots = rows(world, 'bikes')
          .filter((b) => b.riderId === seat.riderId && b.label !== 'test')
          .map((b) => b.slot)
          .sort();
        expect(slots).toEqual(expected);
      }
    }
  });

  it('la Rookies Cup usa un solo costruttore e non ha la seconda moto', () => {
    const e = entriesOf(world, 'rookies');
    expect(new Set(e.map((x) => x.manufacturerId)).size).toBe(1);
    expect(
      rows(world, 'bikes').some((b) => b.categoryId === catOf(world, 'rookies').id && b.slot === 'B'),
    ).toBe(false);
  });

  it('ogni pilota titolare delle categorie gestite ha capotecnico e ingegnere di pista', () => {
    for (const tier of ['premier', 'intermediate', 'lightweight']) {
      for (const seat of entriesOf(world, tier).flatMap((e) => e.seats)) {
        const a = world.staffAssignments.find((x) => x.riderId === seat.riderId);
        expect(world.tables.staff[a!.crewChiefId]!.role).toBe('crewChief');
        expect(world.tables.staff[a!.trackEngineerId]!.role).toBe('trackEngineer');
      }
    }
  });

  it('nessun nome duplicato e nessun cognome di piloti reali', () => {
    const people = [...rows(world, 'riders'), ...rows(world, 'staff')];
    const names = people.map((p) => `${p.firstName} ${p.lastName}`);
    expect(new Set(names).size).toBe(names.length);
    expect(people.filter((p) => isBlockedSurname(p.lastName))).toEqual([]);
  });

  it('include i personaggi della documentazione con staff e numeri previsti', () => {
    const v = rows(world, 'riders').find((r) => r.lastName === 'Varriale')!;
    const a = world.staffAssignments.find((x) => x.riderId === v.id)!;
    expect(world.tables.staff[a.crewChiefId]!.lastName).toBe('Doria');
    expect(world.tables.staff[a.trackEngineerId]!.lastName).toBe('Kessler');
    const seatOf = (id: string) =>
      rows(world, 'teamEntries')
        .flatMap((e) => e.seats)
        .find((s) => s.riderId === id)!;
    expect(seatOf(v.id).number).toBe(27);
    const fv = rows(world, 'riders').find((r) => r.lastName === 'Vitellino')!;
    expect(seatOf(fv.id).number).toBe(44);
    expect(world.tables.categories[fv.categoryId!]!.tier).toBe('lightweight');
  });

  it('le età rispettano le categorie e le squadre ufficiali Premier hanno un collaudatore', () => {
    const cal = new GameCalendar(world.meta.startYear);
    const ages = (tier: string) =>
      entriesOf(world, tier)
        .flatMap((e) => e.seats)
        .map((s) => cal.ageOn(world.tables.riders[s.riderId!]!.birthDay, 0));
    expect(Math.min(...ages('rookies'))).toBeGreaterThanOrEqual(13);
    expect(Math.max(...ages('rookies'))).toBeLessThanOrEqual(17);
    expect(Math.min(...ages('premier'))).toBeGreaterThanOrEqual(18);
    const factories = rows(world, 'teams').filter(
      (t) => t.type === 'factory' && entriesOf(world, 'premier').some((e) => e.teamId === t.id),
    );
    for (const t of factories) {
      const testers = rows(world, 'contracts').filter((c) => c.employerId === t.id && c.role === 'test');
      expect(testers).toHaveLength(1);
      expect(
        world.tables.riders[testers[0]!.counterpartyId as `rdr_${string}`]!.developmentSkill,
      ).toBeGreaterThan(0);
    }
  });

  it('le categorie hanno livelli di qualità credibili e ordinati', () => {
    const mean = (tier: string) => {
      const rs = entriesOf(world, tier)
        .flatMap((e) => e.seats)
        .map((s) => avg(world.tables.riders[s.riderId!]!));
      return rs.reduce((a, b) => a + b, 0) / rs.length;
    };
    expect(mean('premier')).toBeGreaterThan(mean('intermediate'));
    expect(mean('intermediate')).toBeGreaterThan(mean('lightweight'));
    expect(mean('lightweight')).toBeGreaterThan(mean('rookies'));
  });

  it('budget e strutture coerenti con il tipo di squadra', () => {
    const premierTeams = entriesOf(world, 'premier').map((e) => world.tables.teams[e.teamId]!);
    const bal = (type: string) =>
      premierTeams.filter((t) => t.type === type).map((t) => teamBalance(world, t.id));
    expect(Math.min(...bal('factory'))).toBeGreaterThan(Math.max(...bal('private')));
    for (const t of premierTeams)
      expect(rows(world, 'facilities').filter((f) => f.teamId === t.id)).toHaveLength(12);
  });

  it('crea un mercato iniziale di piloti e staff liberi', () => {
    expect(rows(world, 'riders').filter((r) => r.status === 'free').length).toBeGreaterThanOrEqual(10);
    expect(rows(world, 'staff').filter((s) => s.status === 'free').length).toBeGreaterThanOrEqual(30);
  });

  it('il calendario Premier ha 20 round in ordine cronologico', () => {
    const season = rows(world, 'seasons').find((s) => s.categoryId === catOf(world, 'premier').id)!;
    const days = season.roundIds.map((id) => world.tables.rounds[id]!.startDay);
    expect(days).toHaveLength(20);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
});

describe('contenuti e varietà', () => {
  it('nessun cognome ripetuto fra i piloti titolari della stessa categoria', () => {
    for (const tier of ['premier', 'intermediate', 'lightweight', 'rookies']) {
      const last = entriesOf(world, tier)
        .flatMap((e) => e.seats)
        .map((s) => world.tables.riders[s.riderId!]!.lastName);
      expect(new Set(last).size).toBe(last.length);
    }
  });

  it('i Rookies hanno margini di crescita da futuri talenti', () => {
    const rookies = entriesOf(world, 'rookies')
      .flatMap((e) => e.seats)
      .map((s) => world.tables.riders[s.riderId!]!);
    expect(Math.max(...rookies.map((r) => r.potential))).toBeGreaterThanOrEqual(75);
    for (const r of rookies) expect(r.potential).toBeGreaterThanOrEqual(Math.round(avg(r)) - 1);
  });
});
