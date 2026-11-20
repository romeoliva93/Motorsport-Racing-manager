import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { skipPreseason } from './preseason.ts';
import { nextSession, playerRoundToday } from './weekend.ts';
import { weekendView } from './views.ts';
import { PIT_MINUTES } from './practice.ts';
import { idealSetup, turnsOf } from './setup.ts';
import { preseasonInfo } from './queries.ts';

function career(seed: string, skip = true) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  const e = GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
  if (skip) skipPreseason(e);
  e.dispatch({ type: 'ContinueToNextEvent' });
  return e;
}

describe('prove a uscite: rientro ai box', () => {
  it('ogni uscita: tempi, rientro con commenti del pilota e proposte del capotecnico; alla terza la sessione si chiude', () => {
    const e = career('stint-1');
    const round = playerRoundToday(e.state)!;
    expect(nextSession(e.state, round)).toBe('fp1');
    expect(e.dispatch({ type: 'RunSession', stint: true }).ok).toBe(true);
    expect(e.lastTiming?.run).toEqual({ n: 1, of: 3 });
    let w = weekendView(e.state);
    expect(w.stint).toMatchObject({ kind: 'fp1', done: 1, runs: 3 });
    expect(w.stint!.debrief).toHaveLength(2);
    const d = w.stint!.debrief[0]!;
    expect(d.quote.length).toBeGreaterThan(10);
    expect(d.minutesLeft).toBe(PIT_MINUTES);
    // La sessione non è ancora finita.
    expect(nextSession(e.state, round)).toBe('fp1');
    // Il manager applica la prima proposta (se c'è e se il tempo basta).
    const sug = d.suggestions.find((x) => x.minutes <= PIT_MINUTES);
    if (sug) {
      expect(
        e.dispatch({
          type: 'SetSetup',
          riderId: d.riderId,
          condition: d.wet ? 'wet' : 'dry',
          values: { [sug.key]: sug.to },
        }).ok,
      ).toBe(true);
      w = weekendView(e.state);
      expect(w.stint!.debrief.find((x) => x.riderId === d.riderId)!.minutesLeft).toBe(
        PIT_MINUTES - sug.minutes,
      );
    }
    // Una modifica che richiede più dei minuti rimasti ai box viene rifiutata.
    const big = { forkPreload: 5, shock: -5, rideHeight: 5, gearing: -5 };
    expect(e.dispatch({ type: 'SetSetup', riderId: d.riderId, condition: 'dry', values: big }).ok).toBe(
      false,
    );
    e.dispatch({ type: 'RunSession', stint: true });
    expect(weekendView(e.state).stint!.done).toBe(2);
    e.dispatch({ type: 'RunSession', stint: true });
    expect(weekendView(e.state).stint).toBeNull();
    expect(nextSession(e.state, round)).not.toBe('fp1');
    const res = rows(e.state, 'sessionResults').find((x) => x.roundId === round.id && x.kind === 'fp1')!;
    expect(res.rows.length).toBeGreaterThan(15);
    // Cronologia: tre uscite registrate.
    expect(e.state.practice!.riders[d.riderId]!.log.filter((x) => x.kind === 'run')).toHaveLength(3);
  });

  it('a sessione cominciata, «corri la sessione» chiude le uscite rimaste', () => {
    const e = career('stint-2');
    const round = playerRoundToday(e.state)!;
    e.dispatch({ type: 'RunSession', stint: true });
    e.dispatch({ type: 'RunSession' });
    expect(e.state.stint).toBeUndefined();
    expect(rows(e.state, 'sessionResults').some((x) => x.roundId === round.id && x.kind === 'fp1')).toBe(
      true,
    );
  });

  it('anche i test hanno le uscite con rientro ai box; il boost arriva a fine giornata', () => {
    const e = career('stint-3', false);
    const v0 = preseasonInfo(e.state)!;
    const [a, b] = v0.today!.riders.map((r) => r.id) as [string, string];
    e.dispatch({ type: 'RunTestDay', programs: { [a]: 'setup', [b]: 'track' } });
    const v1 = preseasonInfo(e.state)!;
    expect(v1.stint).toMatchObject({ kind: 'test', done: 1, runs: 3 });
    expect(v1.stint!.debrief).toHaveLength(2);
    expect(v1.today!.day).toBe(1);
    expect(v1.riders[0]!.levels).toEqual(v0.riders[0]!.levels);
    e.dispatch({ type: 'RunTestDay', programs: { [a]: 'setup', [b]: 'track' } });
    e.dispatch({ type: 'RunTestDay', programs: { [a]: 'setup', [b]: 'track' } });
    const v3 = preseasonInfo(e.state)!;
    expect(v3.stint).toBeNull();
    expect(v3.today!.day).toBe(2);
    expect(v3.riders.find((r) => r.id === a)!.levels.setup).toBeGreaterThan(
      v0.riders.find((r) => r.id === a)!.levels.setup,
    );
  });

  it('il pilota non è sempre contento: assetto sbagliato = si lamenta, assetto giusto = gli piace', () => {
    const e = career('stint-mood');
    const round = playerRoundToday(e.state)!;
    const ids = weekendView(e.state).myRiders.map((r) => r.id);
    const [a, b] = ids as [string, string];
    const ra = e.state.tables.riders[a as never]!;
    const ideal = idealSetup(ra, turnsOf(e.state, round), false);
    const keys = weekendView(e.state).myRiders.length ? Object.keys(ideal) : [];
    // Pilota A: assetto ideale. Pilota B: tutto all'opposto.
    const set = (id: string, values: Record<string, number>) =>
      expect(e.dispatch({ type: 'SetSetup', riderId: id, condition: 'dry', values }).ok).toBe(true);
    set(a, Object.fromEntries(keys.map((k) => [k, ideal[k] ?? 0])));
    set(b, Object.fromEntries(keys.map((k) => [k, (ideal[k] ?? 0) >= 0 ? -5 : 5])));
    e.dispatch({ type: 'RunSession', stint: true });
    const d = weekendView(e.state).stint!.debrief;
    const da = d.find((x) => x.riderId === a)!;
    const db = d.find((x) => x.riderId === b)!;
    expect(da.wet).toBe(false);
    expect(da.mood).toBe('good');
    expect(db.mood).toBe('bad');
    expect(db.quote).not.toMatch(/mi piace,/);
    expect(db.suggestions.length).toBeGreaterThan(0);
  });
});
