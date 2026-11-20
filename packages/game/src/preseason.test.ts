import { describe, expect, it } from 'vitest';
import { rows, teamBalance, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { nextTestDay, preseasonTests, testToday } from './preseason.ts';
import { baseProgramLevels, bikeBase, devFactor, programLevels } from './preseasonEffects.ts';
import { preseasonInfo } from './queries.ts';
import { leadDays, upgradeCost } from './upgrades.ts';
import { careerSummary } from './queries.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
}
const mine = (e: GameEngine) =>
  rows(e.state, 'teamEntries')
    .find((x) => x.teamId === e.state.meta.playerTeamId)!
    .seats.map((x) => x.riderId!);

describe('test pre-stagionali', () => {
  it('MotoGP: due test prima del primo GP; «Vai al…» si ferma al primo giorno di test', () => {
    const e = career('pre-1');
    const tests = preseasonTests(e.state);
    expect(tests.map((t) => t.days)).toEqual([3, 2]);
    expect(careerSummary(e.state).nextTest?.name).toBe('Test pre-stagionale 1');
    expect(e.dispatch({ type: 'ContinueToNextEvent' }).ok).toBe(true);
    expect(e.state.meta.currentDay).toBe(tests[0]!.startDay);
    expect(testToday(e.state)?.id).toBe(tests[0]!.id);
    expect(e.availableCommands()).toContain('RunTestDay');
  });

  it('una giornata: tempi di tutti, confidenza di partenza in crescita, costo, giorno dopo', () => {
    const e = career('pre-2');
    e.dispatch({ type: 'ContinueToNextEvent' });
    const [a, b] = mine(e) as [string, string];
    const day0 = e.state.meta.currentDay;
    const bal0 = teamBalance(e.state, e.state.meta.playerTeamId!);
    const la = programLevels(e.state, a, true);
    const lb = programLevels(e.state, b, true);
    const bike0 = bikeBase(e.state, a, true);
    // Ogni pilota parte da percentuali sue (diverse fra loro).
    expect(la).not.toEqual(lb);
    const view = preseasonInfo(e.state)!.today!.riders.find((x) => x.id === a)!;
    expect(view.boost.setup.setup).toBeGreaterThan(view.boost.setup.track);
    expect(
      e.dispatch({ type: 'RunTestDay', programs: { [a]: 'setup', [b]: 'development' }, all: true }).ok,
    ).toBe(true);
    expect(e.lastTiming?.kind).toBe('test');
    expect(e.lastTiming!.riders.length).toBeGreaterThan(15);
    const la2 = programLevels(e.state, a, true);
    const lb2 = programLevels(e.state, b, true);
    // Il programma scelto ha il boost più grande (quello mostrato in anteprima).
    expect(la2.setup - la.setup).toBeCloseTo(view.boost.setup.setup, 0);
    expect(la2.setup - la.setup).toBeGreaterThan(la2.track - la.track);
    expect(lb2.development - lb.development).toBeGreaterThan(lb2.setup - lb.setup);
    expect(bikeBase(e.state, a, true)).toBeGreaterThan(bike0);
    expect(teamBalance(e.state, e.state.meta.playerTeamId!)).toBeLessThan(bal0);
    expect(e.state.meta.currentDay).toBe(day0 + 1);
    expect(testToday(e.state)?.done).toBe(1);
  });

  it('test completi: base di confidenza alta e sviluppo che accelera e sconta gli upgrade', () => {
    const e = career('pre-3');
    const team = e.state.meta.playerTeamId!;
    e.dispatch({ type: 'ContinueToNextEvent' });
    const [a, b] = mine(e) as [string, string];
    const cost0 = upgradeCost(e.state, team, 'engine', b)!;
    const lead0 = leadDays(e.state, team, 'engine', 1, b);
    let n = 0;
    while (testToday(e.state) && n < 10) {
      e.dispatch({ type: 'RunTestDay', programs: { [a]: 'setup', [b]: 'development' }, all: true });
      if (!testToday(e.state)) e.dispatch({ type: 'ContinueToNextEvent' });
      n++;
    }
    expect(n).toBe(5); // 3 + 2 giornate
    expect(bikeBase(e.state, a, true)).toBeGreaterThan(65);
    expect(devFactor(e.state, team, b).lead).toBeLessThan(devFactor(e.state, team, a).lead);
    expect(upgradeCost(e.state, team, 'engine', b)!).toBeLessThan(cost0);
    expect(leadDays(e.state, team, 'engine', 1, b)).toBeLessThan(lead0);
    // Ora si va al primo GP.
    expect(nextTestDay(e.state)).toBeNull();
  });

  it('chi salta i test resta ai valori di partenza; le IA i test li fanno sempre', () => {
    const e = career('pre-4');
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'ContinueToNextEvent' }); // salta il primo test
    expect(e.state.preseason!.skipped.length).toBe(1);
    e.dispatch({ type: 'ContinueToNextEvent' }); // salta il secondo
    const [a] = mine(e) as [string];
    expect(programLevels(e.state, a, true)).toEqual(baseProgramLevels(e.state, a));
    expect(bikeBase(e.state, a, false)).toBeGreaterThan(bikeBase(e.state, a, true));
    expect(careerSummary(e.state).nextTest).toBeNull();
  });
});
