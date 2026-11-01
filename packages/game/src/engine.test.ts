import { describe, expect, it } from 'vitest';
import { rows, validateGameState, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import {
  careerSummary,
  calendar,
  potentialEstimate,
  riderDetail,
  teamCards,
  teamOverview,
  teamRiders,
  teamStaff,
  staffDetail,
  categories,
} from './queries.ts';

const lupoBlu = (e: GameEngine) =>
  rows(e.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;

describe('GameEngine', () => {
  it('nuova carriera: mondo valido e squadra del giocatore impostata', () => {
    const tmp = GameEngine.newCareer({ seed: 's1', saveName: 'prova' });
    const e = GameEngine.newCareer({ seed: 's1', saveName: 'prova', teamId: lupoBlu(tmp) });
    expect(validateGameState(e.state)).toEqual([]);
    expect(e.state.meta.playerTeamId).toBe(lupoBlu(e));
    expect(e.availableCommands()).toEqual([
      'AdvanceDays',
      'ContinueToNextEvent',
      'MakeOffer',
      'AcceptCounter',
      'WithdrawNegotiation',
    ]);
  });

  it('valida i comandi senza modificare lo stato in caso di errore', () => {
    const e = GameEngine.newCareer({ seed: 's2', saveName: 'prova' });
    expect(e.availableCommands()).toEqual(['SetPlayerTeam', 'CreateTeam']);
    const before = e.version;
    expect(e.dispatch({ type: 'AdvanceDays', days: 3 }).ok).toBe(false);
    const rookiesOrg = rows(e.state, 'teams').find((t) => t.type === 'organizer')!.id;
    expect(e.dispatch({ type: 'SetPlayerTeam', teamId: rookiesOrg })).toEqual({
      ok: false,
      error: 'La Rookies Cup non ha squadre gestibili',
    });
    expect(e.dispatch({ type: 'SetPlayerTeam', teamId: 'tem_999999' }).ok).toBe(false);
    expect(e.version).toBe(before);
    expect(e.dispatch({ type: 'SetPlayerTeam', teamId: lupoBlu(e) }).ok).toBe(true);
    expect(e.dispatch({ type: 'SetPlayerTeam', teamId: lupoBlu(e) }).ok).toBe(false);
    expect(e.dispatch({ type: 'AdvanceDays', days: 0 }).ok).toBe(false);
    expect(e.dispatch({ type: 'AdvanceDays', days: 61 }).ok).toBe(false);
  });

  it('avanza il tempo e raggiunge il primo evento del calendario', () => {
    const e = GameEngine.newCareer({ seed: 's3', saveName: 'prova' });
    e.dispatch({ type: 'SetPlayerTeam', teamId: lupoBlu(e) });
    const first = e.nextRound()!;
    const r = e.dispatch({ type: 'ContinueToNextEvent' });
    expect(r.ok).toBe(true);
    expect(e.state.meta.currentDay).toBe(first.startDay);
    const types = r.ok ? r.value.map((x) => x.type) : [];
    expect(types).toContain('RoundReached');
    expect(types.at(-1)).toBe('TimeAdvanced');
    expect(e.nextRound()!.number).toBe(2);
  });

  it('AdvanceDays sposta la data del numero di giorni richiesto', () => {
    const e = GameEngine.newCareer({ seed: 's4', saveName: 'prova' });
    e.dispatch({ type: 'SetPlayerTeam', teamId: lupoBlu(e) });
    e.dispatch({ type: 'AdvanceDays', days: 10 });
    expect(e.state.meta.currentDay).toBe(10);
    expect(careerSummary(e.state as never).date).toBe('11 gennaio 2027');
  });
});

describe('viste', () => {
  const tmp = GameEngine.newCareer({ seed: 'views', saveName: 'v' });
  const e = GameEngine.newCareer({ seed: 'views', saveName: 'v', teamId: lupoBlu(tmp) });
  const s = e.state as Parameters<typeof teamCards>[0];
  const team = lupoBlu(e);

  it('categorie e schede squadra per la nuova carriera', () => {
    const cats = categories(s);
    expect(cats.map((c) => c.tier)).toEqual(['premier', 'intermediate', 'lightweight', 'rookies']);
    expect(cats.find((c) => c.tier === 'premier')!.bikesPerRider).toBe(2);
    const cards = teamCards(s, cats[0]!.id);
    expect(cards).toHaveLength(11);
    expect(cards.find((c) => c.id === team)!.riders.map((r) => r.number)).toEqual([27, 61]);
  });

  it('riepilogo carriera con prossimo evento', () => {
    const sum = careerSummary(s);
    expect(sum.team!.name).toBe('Scuderia Lupo Blu');
    expect(sum.category!.bikesPerRider).toBe(2);
    expect(sum.nextRound!.number).toBe(1);
    expect(sum.roundsTotal).toBe(20);
  });

  it('panoramica squadra, piloti, staff e calendario', () => {
    const o = teamOverview(s, team)!;
    expect(o.facilities).toHaveLength(12);
    expect(o.bikes).toEqual({ total: 4, perRider: 2 });
    expect(o.payroll.riders).toBeGreaterThan(0);
    const riders = teamRiders(s, team);
    expect(riders.filter((r) => r.role === 'race').map((r) => r.lastName)).toEqual(['Varriale', 'Oyarzún']);
    const staff = teamStaff(s, team);
    expect(staff.find((x) => x.name === 'Marco Doria')!.assignedTo).toBe('T. Varriale');
    expect(calendar(s, careerSummary(s).category!.id)[0]!.status).toBe('next');
  });

  it('scheda pilota: staff, moto e potenziale solo come stima', () => {
    const v = teamRiders(s, team).find((r) => r.lastName === 'Varriale')!;
    const d = riderDetail(s, v.id)!;
    expect(d.staff.map((x) => x.name)).toEqual(['Marco Doria', 'Anja Kessler']);
    expect(d.bikes.map((b) => b.slot)).toEqual(['A', 'B']);
    expect(d.attributes).toHaveLength(17);
    const [lo, hi] = d.potential;
    expect(hi - lo).toBeLessThanOrEqual(6);
    expect(JSON.stringify(d)).not.toContain('"potential":89');
    const rival = teamCards(s, careerSummary(s).category!.id).find((c) => c.id !== team)!.riders[0]!;
    const est = potentialEstimate(s, s.tables.riders[rival.id as `rdr_${string}`]!, team);
    expect(est[1] - est[0]).toBe(16);
  });

  it('scheda staff con rapporti con i piloti', () => {
    const doria = teamStaff(s, team).find((x) => x.name === 'Marco Doria')!;
    const d = staffDetail(s, doria.id)!;
    expect(d.role).toBe('crewChief');
    expect(d.bonds[0]!.rider).toBe('Teo Varriale');
    expect(d.potential % 5).toBe(0);
  });
});
