import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { rows, teamBalance, validateGameState, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { bikeReliabilityFactor, partReliability, partWear } from './garage.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
}
const weekend = (e: GameEngine) => {
  e.dispatch({ type: 'ContinueToNextEvent' });
  e.dispatch({ type: 'RunRace', strategies: {} });
};

describe('garage: usura e revisione dei componenti', () => {
  it('i chilometri del weekend consumano i pezzi: le prove si dividono fra moto A e B', () => {
    const e = career('g1');
    const team = e.state.meta.playerTeamId!;
    weekend(e);
    const mine = rows(e.state, 'bikes').filter((b) => b.teamId === team && b.riderId);
    const a = mine.find((b) => b.slot === 'A')!;
    const b = mine.find((b) => b.slot === 'B' && b.riderId === a.riderId)!;
    expect(a.mileageKm).toBeGreaterThan(150);
    expect(b.mileageKm).toBeGreaterThan(50);
    expect(a.mileageKm).toBeGreaterThan(b.mileageKm);
    // dopo un weekend la frizione (vita 2 weekend) è a metà circa, il telaio quasi nuovo
    expect(partWear(a, 'clutch')).toBeGreaterThan(0.3);
    expect(partWear(a, 'chassis')).toBeLessThan(0.05);
    expect(validateGameState(e.state)).toEqual([]);
  });

  it("l'usura oltre metà vita abbassa l'affidabilità; la revisione la riporta a nuovo e si paga", () => {
    expect(partReliability(0.4)).toBe(1);
    expect(partReliability(1)).toBeCloseTo(0.92);
    const e = career('g2');
    const team = e.state.meta.playerTeamId!;
    weekend(e);
    weekend(e);
    const a = rows(e.state, 'bikes').find((b) => b.teamId === team && b.slot === 'A' && b.riderId)!;
    expect(bikeReliabilityFactor(a)).toBeLessThan(1);
    const before = teamBalance(e.state, team);
    const res = e.dispatch({ type: 'ServiceParts', bikeId: a.id, parts: ['clutch', 'frontBrake'] });
    expect(res.ok).toBe(true);
    expect(partWear(a, 'clutch')).toBe(0);
    expect(a.parts!.clutch!.services).toBe(1);
    expect(teamBalance(e.state, team)).toBeLessThan(before);
    // MotoGP: il motore segue la dotazione del regolamento, non si revisiona a mano
    expect(e.dispatch({ type: 'ServiceParts', bikeId: a.id, parts: ['engine'] }).ok).toBe(false);
  });

  it('le squadre IA revisionano da sole i pezzi consumati', () => {
    const e = career('g3');
    const team = e.state.meta.playerTeamId!;
    for (let i = 0; i < 4; i++) weekend(e);
    const ai = rows(e.state, 'bikes').filter((b) => b.teamId !== team && b.riderId && b.parts);
    expect(ai.some((b) => (b.parts?.clutch?.services ?? 0) > 0)).toBe(true);
    // il motore MotoGP viene sostituito dopo 3 weekend
    const mine = rows(e.state, 'bikes').find((b) => b.teamId === team && b.slot === 'A' && b.riderId)!;
    expect(mine.parts!.engine!.services).toBeGreaterThanOrEqual(1);
  });
});

describe('garage: gruppi tecnici e capotecnico', () => {
  it('ogni categoria ha il numero di gruppi previsto e nessun componente in due gruppi', async () => {
    const { TECH_GROUPS, GARAGE_KEYS } = await import('@lean-angle/data');
    expect(TECH_GROUPS.premier).toHaveLength(6);
    expect(TECH_GROUPS.intermediate).toHaveLength(4);
    expect(TECH_GROUPS.lightweight).toHaveLength(3);
    expect(TECH_GROUPS.rookies).toHaveLength(2);
    for (const groups of Object.values(TECH_GROUPS)) {
      const all = groups.flatMap((g) => g.parts);
      expect(new Set(all).size).toBe(all.length);
      for (const k of all) expect(GARAGE_KEYS).toContain(k);
    }
    // In MotoGP tutti i 14 componenti sono in un gruppo.
    expect(new Set(TECH_GROUPS.premier.flatMap((g) => g.parts)).size).toBe(14);
  });

  it('condizione, usura e affidabilità di un gruppo sono coerenti fra loro', async () => {
    const { groupStatus } = await import('./garage.ts');
    const { TECH_GROUPS } = await import('@lean-angle/data');
    const g = TECH_GROUPS.premier.find((x) => x.key === 'brakes')!;
    const bike = {
      parts: { frontBrake: { km: 560 * 0.53, services: 0 }, rearBrake: { km: 0, services: 0 } },
    };
    const st = groupStatus(bike as never, g);
    expect(st.condition).toBe(47); // 100 − usura del pezzo più consumato
    expect(st.wear).toBe(27); // media
    expect(st.reliability).toBeCloseTo(99.5, 1); // scende solo oltre metà vita
    expect(st.lifeLeftKm).toBe(263);
  });

  it('il capotecnico revisiona da solo i pezzi ordinari oltre il 70%, non telaio e forcellone', () => {
    const e = career('g4');
    const team = e.state.meta.playerTeamId!;
    weekend(e);
    weekend(e); // al via del 3° weekend la frizione (vita 2 GP) è oltre il 70%
    const a = rows(e.state, 'bikes').find((b) => b.teamId === team && b.slot === 'A' && b.riderId)!;
    a.parts!.chassis = { km: 99999, services: 0 };
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunSession', strategies: {} });
    expect(a.parts!.clutch!.services).toBeGreaterThanOrEqual(1);
    expect(a.parts!.chassis!.services).toBe(0);
    const news = rows(e.state, 'news').filter((n) => n.title.startsWith('Capotecnico'));
    expect(news.length).toBeGreaterThan(0);
  });

  it('in modalità manuale il capotecnico non tocca nulla', () => {
    const e = career('g5');
    const team = e.state.meta.playerTeamId!;
    expect(e.dispatch({ type: 'SetGarageMode', mode: 'manual' }).ok).toBe(true);
    weekend(e);
    weekend(e);
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunSession', strategies: {} });
    const mine = rows(e.state, 'bikes').filter((b) => b.teamId === team && b.riderId);
    expect(mine.every((b) => (b.parts?.clutch?.services ?? 0) === 0)).toBe(true);
  });
});
