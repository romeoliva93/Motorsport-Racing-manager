import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { nextSession, playerRoundToday } from './weekend.ts';
import { weekendView } from './views.ts';
import {
  BREAK_MINUTES,
  confidenceFactor,
  defaultConfidence,
  grownBikeConf,
  grownTrackConf,
} from './practice.ts';

function weekend(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  const e = skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
  e.dispatch({ type: 'ContinueToNextEvent' });
  const w = weekendView(e.state as never);
  return { e, riders: w.myRiders.map((r) => r.id) };
}

describe('prove: confidenza', () => {
  it('cresce con i giri, con rendimenti decrescenti; più lenta sul bagnato', () => {
    const a = grownTrackConf(40, 16, 'track', false);
    const b = grownTrackConf(a, 16, 'track', false);
    expect(a).toBeGreaterThan(40);
    expect(b - a).toBeLessThan(a - 40);
    expect(grownTrackConf(40, 16, 'track', true)).toBeLessThan(a);
    expect(grownTrackConf(40, 16, 'setup', false)).toBeLessThan(a);
  });
  it('la confidenza con la moto insegue l’intesa con l’assetto, più in fretta col programma Assetto', () => {
    expect(grownBikeConf(50, 90, 'setup')).toBeGreaterThan(grownBikeConf(50, 90, 'track'));
    expect(grownBikeConf(80, 40, 'setup')).toBeLessThan(80);
  });
  it('vale in pista: ±1% di ritmo', () => {
    expect(confidenceFactor(100, 100)).toBeCloseTo(1.01);
    expect(confidenceFactor(0, 0)).toBeCloseTo(0.99);
  });
  it('le IA guadagnano confidenza sessione dopo sessione', () => {
    const { e } = weekend('pr-ai');
    const r = rows(e.state, 'riders')[0]!;
    const c0 = defaultConfidence(r, []);
    const c2 = defaultConfidence(r, ['fp1', 'practice']);
    expect(c2.trackConf).toBeGreaterThan(c0.trackConf);
    expect(c2.bikeConf).toBeGreaterThan(c0.bikeConf);
  });
});

describe('prove: programma, briefing, tempi di lavoro e cronologia', () => {
  it('un’uscita registra giri, confidenza e cronologia; le modifiche costano minuti', () => {
    const { e, riders } = weekend('pr-1');
    const [a, b] = riders as [string, string];
    const round = playerRoundToday(e.state as never)!;
    expect(nextSession(e.state as never, round)).toBe('fp1');
    // Prima del weekend: nessun limite di tempo.
    expect(weekendView(e.state as never).myRiders[0]!.practice.minutesLeft).toBeNull();
    expect(
      e.dispatch({
        type: 'RunSession',
        strategies: {
          [a]: { compound: 'hard', mode: 'normal', program: 'setup' },
          [b]: { compound: 'hard', mode: 'normal', program: 'longRun' },
        },
      }).ok,
    ).toBe(true);
    const p = e.state.practice!;
    expect(p.riders[a]!.laps).toBe(16);
    expect(p.riders[a]!.log[0]).toMatchObject({ session: 'FP1', kind: 'run', laps: 16 });
    expect(p.riders[b]!.longRun).toBe(true);
    const v = weekendView(e.state as never).myRiders.find((x) => x.id === a)!.practice;
    expect(v.minutesLeft).toBe(BREAK_MINUTES);
    expect(v.feedback.length).toBeGreaterThan(0);
    expect(v.advice.text.length).toBeGreaterThan(5);
    // Una modifica enorme non sta nella pausa.
    const big = e.dispatch({
      type: 'SetSetup',
      riderId: a,
      condition: 'dry',
      values: { forkPreload: 5, shock: -5, rideHeight: 5, gearing: -5 },
    });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toMatch(/Tempo insufficiente/);
    // Una piccola sì: minuti scalati e cronologia.
    expect(
      e.dispatch({ type: 'SetSetup', riderId: a, condition: 'dry', values: { forkPreload: 1 } }).ok,
    ).toBe(true);
    const after = weekendView(e.state as never).myRiders.find((x) => x.id === a)!.practice;
    expect(after.minutesLeft).toBeLessThan(BREAK_MINUTES);
    expect(after.log.at(-1)).toMatchObject({ session: 'FP1', kind: 'change' });
    expect(after.log.at(-1)!.text).toMatch(/Precarico forcella 0 → \+1/);
    // Applicare il consiglio del capotecnico, se c'è e se c'è tempo.
    if (after.advice.change && after.advice.change.minutes <= (after.minutesLeft ?? 0)) {
      const c = after.advice.change;
      expect(
        e.dispatch({ type: 'SetSetup', riderId: a, condition: 'dry', values: { [c.key]: c.to } }).ok,
      ).toBe(true);
    }
    // Nuova sessione: la pausa riparte da capo.
    e.dispatch({ type: 'RunSession', strategies: {} });
    expect(weekendView(e.state as never).myRiders.find((x) => x.id === a)!.practice.minutesLeft).toBe(
      BREAK_MINUTES,
    );
    expect(e.state.practice!.riders[a]!.laps).toBeGreaterThan(16);
  });

  it('al weekend successivo le prove ripartono da zero', () => {
    const { e, riders } = weekend('pr-2');
    e.dispatch({ type: 'RunRace', strategies: {} });
    const r1 = e.state.practice!.roundId;
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunSession', strategies: {} });
    expect(e.state.practice!.roundId).not.toBe(r1);
    expect(e.state.practice!.riders[riders[0]!]!.log).toHaveLength(1);
  });
});
