import { describe, expect, it } from 'vitest';
import { rows, teamBalance, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { idealSetup, setupFactor, setupMatch } from './setup.ts';
import { partWear, sparesOf } from './garage.ts';
import { bikeView } from './views.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
}

describe('assetto per pilota', () => {
  it('i due piloti hanno assetti indipendenti e l’intesa cambia davvero il ritmo', () => {
    const e = career('st1');
    const v = bikeView(e.state)!;
    const [a, b] = v.setups;
    const ra = e.state.tables.riders[a!.riderId as never]!;
    const ideal = idealSetup(ra, 14, false);
    const vals = Object.fromEntries(a!.keys.map((k) => [k.key, ideal[k.key]!]));
    expect(e.dispatch({ type: 'SetSetup', riderId: a!.riderId, condition: 'dry', values: vals }).ok).toBe(
      true,
    );
    // Il secondo pilota non cambia.
    expect(e.state.setups?.[b!.riderId]).toBeUndefined();
    const match = setupMatch(e.state, ra, 'premier', 14, false, true);
    expect(match).toBe(1);
    expect(setupFactor(match)).toBeCloseTo(1.015);
    // Assetto opposto: intesa più bassa e ritmo più lento.
    const bad = Object.fromEntries(a!.keys.map((k) => [k.key, ideal[k.key]! > 0 ? -5 : 5]));
    e.dispatch({ type: 'SetSetup', riderId: a!.riderId, condition: 'dry', values: bad });
    expect(setupMatch(e.state, ra, 'premier', 14, false, true)).toBeLessThan(0.5);
    // Il bagnato è separato.
    expect(e.state.setups![a!.riderId]!.wet).toEqual({});
  });

  it('rifiuta regolazioni non consentite o fuori scala', () => {
    const e = career('st2');
    const id = bikeView(e.state)!.setups[0]!.riderId;
    expect(
      e.dispatch({ type: 'SetSetup', riderId: id, condition: 'dry', values: { forkPreload: 9 } }).ok,
    ).toBe(false);
    expect(e.dispatch({ type: 'SetSetup', riderId: id, condition: 'dry', values: { volante: 1 } }).ok).toBe(
      false,
    );
  });
});

describe('ricambi e sostituzioni', () => {
  it('il ricambio si paga, va in magazzino e si monta azzerando l’usura del gruppo', () => {
    const e = career('sp1');
    const team = e.state.meta.playerTeamId!;
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
    const bike = rows(e.state, 'bikes').find((x) => x.teamId === team && x.slot === 'A' && x.riderId)!;
    expect(partWear(bike, 'frontBrake')).toBeGreaterThan(0.3);
    expect(e.dispatch({ type: 'ReplaceGroup', bikeId: bike.id, group: 'brakes' }).ok).toBe(false); // niente ricambi
    const before = teamBalance(e.state, team);
    expect(e.dispatch({ type: 'BuySpare', group: 'brakes' }).ok).toBe(true);
    expect(teamBalance(e.state, team)).toBeLessThan(before);
    expect(sparesOf(e.state, team, 'brakes')).toBe(1);
    expect(e.dispatch({ type: 'ReplaceGroup', bikeId: bike.id, group: 'brakes' }).ok).toBe(true);
    expect(partWear(bike, 'frontBrake')).toBe(0);
    expect(sparesOf(e.state, team, 'brakes')).toBe(0);
  });

  it('manutenzione assistita: nessun intervento, ma un avviso del capotecnico', () => {
    const e = career('sp2');
    const team = e.state.meta.playerTeamId!;
    e.dispatch({ type: 'SetGarageMode', mode: 'assisted' });
    for (let i = 0; i < 2; i++) {
      e.dispatch({ type: 'ContinueToNextEvent' });
      e.dispatch({ type: 'RunRace', strategies: {} });
    }
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunSession', strategies: {} });
    const mine = rows(e.state, 'bikes').filter((x) => x.teamId === team && x.riderId);
    expect(mine.every((x) => (x.parts?.clutch?.services ?? 0) === 0)).toBe(true);
    expect(rows(e.state, 'news').some((n) => n.title === 'Capotecnico: revisioni consigliate')).toBe(true);
  });

  it('l’upgrade consegnato monta pezzi nuovi (usura azzerata)', () => {
    const e = career('sp3');
    const team = e.state.meta.playerTeamId!;
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
    const bike = rows(e.state, 'bikes').find((x) => x.teamId === team && x.slot === 'A' && x.riderId)!;
    expect(partWear(bike, 'frontBrake')).toBeGreaterThan(0);
    e.dispatch({ type: 'BuyUpgrade', part: 'brakes' });
    const order = rows(e.state, 'upgradeOrders').find((o) => o.teamId === team && o.part === 'brakes')!;
    e.dispatch({ type: 'AdvanceDays', days: order.readyDay - e.state.meta.currentDay });
    expect(partWear(bike, 'frontBrake')).toBe(0);
  });
});
