import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { rows, teamBalance, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { seasonFinished } from './season.ts';
import { courseCost, managerView } from './manager.ts';
import { askingSalary } from './market.ts';
import { sponsorMonthly } from './economy.ts';
import { freeStaff, staffMarket } from './staffMarket.ts';
import { marketRiders } from './queries.ts';
import { financeView } from './views.ts';

const pick = (e: GameEngine, name: string) =>
  rows(e.state, 'teams').find((t) => t.name === name)!.id as TeamId;
function career(seed: string, team = 'Scuderia Lupo Blu') {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  return skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: pick(tmp, team) }));
}
function playSeason(e: GameEngine) {
  let n = 0;
  while (!seasonFinished(e.state as never) && n < 30) {
    if (!e.dispatch({ type: 'ContinueToNextEvent' }).ok) break;
    e.dispatch({ type: 'RunRace', strategies: {} });
    n++;
  }
}

describe('manager: stipendio, soldi personali, corsi', () => {
  it('lo stipendio lo paga la squadra ogni mese e va nel portafoglio del manager', () => {
    const e = career('mg-1');
    const team = e.state.meta.playerTeamId!;
    expect(e.state.manager!.salary).toBe(1_200_000);
    expect(financeView(e.state as never)!.monthly.salaries).toBeGreaterThan(0);
    e.dispatch({ type: 'AdvanceDays', days: 45 });
    expect(e.state.manager!.wallet).toBeGreaterThan(0);
    const paid = rows(e.state, 'transactions').filter(
      (t) => t.teamId === team && t.note === 'Stipendio del manager',
    );
    expect(paid.length).toBeGreaterThan(0);
  });

  it('i corsi costano soldi personali e hanno effetti reali', () => {
    const e = career('mg-2');
    const team = e.state.meta.playerTeamId!;
    expect(e.dispatch({ type: 'ManagerCourse', skill: 'negotiation' }).ok).toBe(false); // portafoglio vuoto
    e.state.manager!.wallet = 5_000_000;
    const r = rows(e.state, 'riders').find((x) => x.status === 'free')!;
    const ask0 = askingSalary(e.state, r, team);
    const spon0 = sponsorMonthly(e.state, team);
    const cost = courseCost(e.state, 'negotiation')!;
    expect(e.dispatch({ type: 'ManagerCourse', skill: 'negotiation' }).ok).toBe(true);
    expect(e.dispatch({ type: 'ManagerCourse', skill: 'commercial' }).ok).toBe(true);
    expect(e.state.manager!.wallet).toBeLessThan(5_000_000 - cost);
    expect(askingSalary(e.state, r, team)).toBeLessThan(ask0);
    expect(sponsorMonthly(e.state, team)).toBeGreaterThan(spon0);
  });

  it('investire nella squadra sposta soldi dal portafoglio al bilancio', () => {
    const e = career('mg-3');
    const team = e.state.meta.playerTeamId!;
    e.state.manager!.wallet = 2_000_000;
    const b0 = teamBalance(e.state, team);
    expect(e.dispatch({ type: 'InvestInTeam', amount: 3_000_000 }).ok).toBe(false);
    expect(e.dispatch({ type: 'InvestInTeam', amount: 1_000_000 }).ok).toBe(true);
    expect(teamBalance(e.state, team)).toBe(b0 + 1_000_000);
    expect(e.state.manager!.wallet).toBe(1_000_000);
  });
});

describe('mercato degli svincolati', () => {
  it('i piloti svincolati si possono ingaggiare anche a mercato chiuso', () => {
    const e = career('mg-4');
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
    const free = marketRiders(e.state as never, 'free')[0]!;
    const own = rows(e.state, 'teamEntries').find((x) => x.teamId === e.state.meta.playerTeamId)!.seats[1]!
      .riderId!;
    const r = e.dispatch({
      type: 'MakeOffer',
      riderId: free.id as never,
      offer: {
        salary: 9_000_000,
        years: 1,
        winBonus: 0,
        podiumBonus: 0,
        role: 'race',
        replaceRiderId: own as never,
      },
    });
    expect(r.ok).toBe(true);
  });

  it('tecnici svincolati: ingaggio di un capotecnico assegnato a un pilota e di un meccanico in più', () => {
    const e = career('mg-5');
    const v = staffMarket(e.state as never)!;
    const cc = v.free.find((m) => m.role === 'crewChief')!;
    const rider = v.riders[0]!;
    expect(e.dispatch({ type: 'HireStaff', staffId: cc.id, years: 2 }).ok).toBe(false); // manca il pilota
    expect(e.dispatch({ type: 'HireStaff', staffId: cc.id, years: 2, riderId: rider.id }).ok).toBe(true);
    const after = staffMarket(e.state as never)!;
    expect(after.riders[0]!.crewChief).toBe(cc.name);
    expect(freeStaff(e.state).some((m) => m.id === cc.id)).toBe(false);
    const mech = after.free.find((m) => m.role === 'mechanic')!;
    const f0 = after.mechanics.factor;
    expect(e.dispatch({ type: 'HireStaff', staffId: mech.id, years: 1 }).ok).toBe(true);
    expect(staffMarket(e.state as never)!.mechanics.factor).toBeLessThan(f0);
  });
});

describe('bilancio e offerte di lavoro di fine stagione', () => {
  it('una satellite che fa la sua stagione non si arricchisce troppo', () => {
    const e = career('mg-6');
    const team = e.state.meta.playerTeamId!;
    const b0 = teamBalance(e.state, team);
    playSeason(e);
    expect(teamBalance(e.state, team) - b0).toBeLessThan(10_000_000);
  });

  it('a fine stagione: reputazione, offerte con trattativa e cambio di squadra', () => {
    const e = career('mg-7');
    playSeason(e);
    const m = e.state.manager!;
    expect(m.history).toHaveLength(1);
    // Forziamo una stagione ottima per avere tutte e tre le offerte.
    m.offersYear = null;
    m.reputation = 80;
    const exp = rows(e.state, 'teams');
    for (const t of exp) if (t.id === e.state.meta.playerTeamId) t.reputation = 30;
    m.wallet = 1_000_000;
    expect(e.dispatch({ type: 'InvestInTeam', amount: 10_000 }).ok).toBe(true); // ripassa dal motore
    const offers = e.state.manager!.offers;
    expect(offers.length).toBeGreaterThanOrEqual(2);
    const v = managerView(e.state as never)!;
    expect(v.offers.every((o) => o.pitch.length > 10)).toBe(true);
    const star = offers.find((o) => o.kind === 'star') ?? offers[0]!;
    // Chiedere troppo: rilancio, poi accordo entro il massimo.
    const r1 = e.dispatch({ type: 'NegotiateJobOffer', offerId: star.id, salary: star.salary * 3 });
    expect(r1.ok).toBe(true);
    expect(star.rounds[0]!.answer).toBe('countered');
    const r2 = e.dispatch({ type: 'NegotiateJobOffer', offerId: star.id, salary: star.salary });
    expect(r2.ok && star.rounds[1]!.answer).toBe('accepted');
    const before = e.state.meta.playerTeamId;
    expect(e.dispatch({ type: 'AcceptJobOffer', offerId: star.id }).ok).toBe(true);
    expect(e.state.meta.playerTeamId).toBe(star.teamId);
    expect(e.state.meta.playerTeamId).not.toBe(before);
    expect(e.state.manager!.salary).toBe(star.salary);
    if (star.kind === 'star') {
      const seats = rows(e.state, 'teamEntries').find((x) => x.teamId === star.teamId)!.seats;
      expect(seats.some((x) => x.riderId === star.starRiderId)).toBe(true);
    }
    expect(e.state.manager!.offers.filter((o) => o.status === 'open')).toHaveLength(0);
    expect(e.dispatch({ type: 'StartNextSeason' }).ok).toBe(true);
  });

  it('chi va male non riceve offerte', () => {
    const e = career('mg-8', 'Atlas Motorsport');
    playSeason(e);
    expect(e.state.manager!.offers.length).toBe(0);
  });
});
