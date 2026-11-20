import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import {
  rows,
  validateGameState,
  teamBalance,
  type RiderId,
  type TeamId,
  type GameState,
} from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { activeRiderContract, askingSalary, buyoutFor, marketOpen } from './market.ts';

function career(seed = 'market') {
  const tmp = GameEngine.newCareer({ seed, saveName: 'm' });
  const lupo = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return { e: skipPreseason(GameEngine.newCareer({ seed, saveName: 'm', teamId: lupo })), lupo };
}
const st = (e: GameEngine) => e.state as GameState;
const riderOf = (e: GameEngine, teamName: string, i = 0) => {
  const t = rows(e.state, 'teams').find((x) => x.name === teamName)!;
  const entry = rows(e.state, 'teamEntries').find((x) => x.teamId === t.id)!;
  return { rider: e.state.tables.riders[entry.seats[i]!.riderId!]!, teamId: t.id };
};
const seatsOf = (e: GameEngine, teamId: string) =>
  rows(e.state, 'teamEntries').find((x) => x.teamId === teamId)!.seats;

describe('mercato piloti', () => {
  it('è aperto prima del campionato e si chiude al primo round', () => {
    const { e } = career();
    expect(marketOpen(st(e))).toBe(true);
    e.dispatch({ type: 'ContinueToNextEvent' });
    expect(marketOpen(st(e))).toBe(false);
    expect(e.availableCommands()).not.toContain('MakeOffer');
  });

  it("un'offerta troppo bassa riceve una controproposta, poi si chiude se si insiste", () => {
    const { e, lupo } = career();
    const { rider } = riderOf(e, 'Team Meridian');
    const out = seatsOf(e, lupo)[1]!.riderId!;
    const r1 = e.dispatch({
      type: 'MakeOffer',
      riderId: rider.id,
      offer: { salary: 300_000, years: 2, role: 'race', winBonus: 0, podiumBonus: 0, replaceRiderId: out },
    });
    expect(r1.ok).toBe(true);
    const neg = rows(e.state, 'negotiations')[0]!;
    expect(neg.rounds[0]!.response).toBe('countered');
    expect(neg.rounds[0]!.counter!.salary).toBeGreaterThan(300_000);
    e.dispatch({
      type: 'MakeOffer',
      riderId: rider.id,
      offer: { salary: 300_000, years: 2, role: 'race', winBonus: 0, podiumBonus: 0, replaceRiderId: out },
    });
    expect(rows(e.state, 'negotiations')[0]!.status).toBe('rejected');
    const again = e.dispatch({
      type: 'MakeOffer',
      riderId: rider.id,
      offer: { salary: 5_000_000, years: 2, role: 'race', winBonus: 0, podiumBonus: 0, replaceRiderId: out },
    });
    expect(again.ok).toBe(false);
  });

  it("accettare la controproposta firma il pilota: clausola pagata, sostituito liberato, vuoto riempito dall'IA", () => {
    const { e, lupo } = career('market-2');
    const { rider, teamId: meridian } = riderOf(e, 'Team Meridian');
    const out = seatsOf(e, lupo)[1]!.riderId!;
    const s = st(e);
    const buyout = buyoutFor(s, activeRiderContract(s, rider.id));
    const before = teamBalance(s, lupo);
    e.dispatch({
      type: 'MakeOffer',
      riderId: rider.id,
      offer: {
        salary: Math.round(askingSalary(s, rider, lupo) * 0.85),
        years: 2,
        role: 'race',
        winBonus: 0,
        podiumBonus: 0,
        replaceRiderId: out,
      },
    });
    const neg = rows(e.state, 'negotiations')[0]!;
    if (neg.status === 'open') {
      const r = e.dispatch({ type: 'AcceptCounter', riderId: rider.id, replaceRiderId: out });
      expect(r.ok).toBe(true);
    }
    expect(neg.status).toBe('signed');
    expect(seatsOf(e, lupo).map((x) => x.riderId)).toContain(rider.id);
    expect(seatsOf(e, lupo).map((x) => x.riderId)).not.toContain(out);
    expect(e.state.tables.riders[out]!.status).toBe('free');
    expect(teamBalance(st(e), lupo)).toBeLessThan(before - buyout + 1);
    // Il nuovo pilota ha capotecnico, ingegnere e due moto; Meridian ha di nuovo due titolari (presi dai liberi).
    expect(e.state.staffAssignments.some((a) => a.riderId === rider.id && a.teamId === lupo)).toBe(true);
    expect(rows(e.state, 'bikes').filter((b) => b.riderId === rider.id)).toHaveLength(2);
    expect(seatsOf(e, meridian).every((x) => x.riderId !== null)).toBe(true);
    expect(validateGameState(st(e))).toEqual([]);
  });

  it('rinnovo di un proprio pilota', () => {
    const { e, lupo } = career('market-3');
    const own = seatsOf(e, lupo)[0]!.riderId! as RiderId;
    const s = st(e);
    const ask = askingSalary(s, s.tables.riders[own]!, lupo);
    const r = e.dispatch({
      type: 'MakeOffer',
      riderId: own,
      offer: {
        salary: Math.round(ask * 1.1),
        years: 3,
        role: 'race',
        winBonus: 0,
        podiumBonus: 0,
        replaceRiderId: null,
      },
    });
    expect(r.ok).toBe(true);
    const c = activeRiderContract(st(e), own)!;
    expect(c.employerId).toBe(lupo);
    expect(c.salary).toBe(Math.round((ask * 1.1) / 1000) * 1000);
    expect(validateGameState(st(e))).toEqual([]);
  });

  it('rifiuta offerte non valide senza modificare lo stato', () => {
    const { e } = career('market-4');
    const { rider } = riderOf(e, 'Team Meridian');
    const v = e.version;
    expect(
      e.dispatch({
        type: 'MakeOffer',
        riderId: rider.id,
        offer: {
          salary: 2_000_000,
          years: 2,
          role: 'race',
          winBonus: 0,
          podiumBonus: 0,
          replaceRiderId: null,
        },
      }),
    ).toEqual({ ok: false, error: 'Scegli quale tuo pilota titolare lascia il posto' });
    const rookie = rows(e.state, 'riders').find(
      (r) =>
        e.state.tables.categories[r.categoryId ?? ('cat_x' as never)]?.tier === 'rookies' &&
        r.role === 'race',
    )!;
    const res = e.dispatch({
      type: 'MakeOffer',
      riderId: rookie.id,
      offer: { salary: 100_000, years: 1, role: 'race', winBonus: 0, podiumBonus: 0, replaceRiderId: null },
    });
    expect(res.ok).toBe(false);
    expect(e.version).toBe(v);
  });
});

describe('crea la tua squadra', () => {
  it('crea una squadra con posti vacanti, staff e budget; poi si ingaggiano i piloti dal mercato', () => {
    const e = GameEngine.newCareer({ seed: 'custom', saveName: 'c' });
    const s = st(e);
    const moto2 = rows(s, 'categories').find((c) => c.tier === 'intermediate')!;
    const mfr = rows(s, 'manufacturers').find((m) => m.categories.includes(moto2.id))!;
    const r = e.dispatch({
      type: 'CreateTeam',
      team: {
        name: 'Racing Romeo',
        shortName: 'RRM',
        nationality: 'ITA',
        baseCity: 'Napoli',
        colors: { primary: '#d4141c', secondary: '#111111' },
        type: 'independent',
        tier: 'intermediate',
        manufacturerId: mfr.id,
      },
    });
    expect(r.ok).toBe(true);
    const teamId = st(e).meta.playerTeamId!;
    expect(st(e).tables.teams[teamId]!.name).toBe('Racing Romeo');
    expect(seatsOf(e, teamId).map((x) => x.riderId)).toEqual([null, null]);
    expect(teamBalance(st(e), teamId)).toBeGreaterThan(0);
    expect(validateGameState(st(e))).toEqual([]);
    // Ingaggio di un pilota libero con un'offerta generosa.
    const free = rows(st(e), 'riders')
      .filter((x) => x.status === 'free')
      .sort((a, b) => a.reputation - b.reputation)[0]!;
    const sign = e.dispatch({
      type: 'MakeOffer',
      riderId: free.id,
      offer: { salary: 2_000_000, years: 2, role: 'race', winBonus: 0, podiumBonus: 0, replaceRiderId: null },
    });
    expect(sign.ok).toBe(true);
    expect(seatsOf(e, teamId).some((x) => x.riderId === free.id)).toBe(true);
    expect(validateGameState(st(e))).toEqual([]);
  });

  it('valida i dati della nuova squadra', () => {
    const e = GameEngine.newCareer({ seed: 'custom-2', saveName: 'c' });
    const s = st(e);
    const moto3 = rows(s, 'categories').find((c) => c.tier === 'lightweight')!;
    const wrongMfr = rows(s, 'manufacturers').find((m) => !m.categories.includes(moto3.id))!;
    const bad = e.dispatch({
      type: 'CreateTeam',
      team: {
        name: 'X',
        shortName: 'xx',
        nationality: 'ITA',
        baseCity: 'Roma',
        colors: { primary: '#ffffff', secondary: '#000000' },
        type: 'private',
        tier: 'lightweight',
        manufacturerId: wrongMfr.id,
      },
    });
    expect(bad.ok).toBe(false);
    expect(st(e).meta.playerTeamId).toBeNull();
  });
});
