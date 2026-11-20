import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { deserializeState, rows, serializeState, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { nextSession, playerRoundToday } from './weekend.ts';

function toSprint(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  const e = skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
  e.dispatch({ type: 'ContinueToNextEvent' });
  while (nextSession(e.state as never, playerRoundToday(e.state as never)!) !== 'sprint')
    expect(e.dispatch({ type: 'RunSession', strategies: {} }).ok).toBe(true);
  return e;
}
const mine = (e: GameEngine) => e.lastReplay!.riders.filter((r) => r.mine).map((r) => r.id);

describe('gara in diretta', () => {
  it('avanza a pezzi, accetta strategie in corsa e si chiude con risultati e punti', () => {
    const e = toSprint('live-1');
    expect(e.dispatch({ type: 'RunSession', live: true, strategies: {} }).ok).toBe(true);
    expect(e.liveRace?.kind).toBe('sprint');
    expect(e.availableCommands()).toContain('SetRaceStrategy');
    expect(e.dispatch({ type: 'RunRace', strategies: {} }).ok).toBe(false); // gara in corso
    let frames = 0,
      events = 0;
    const c1 = e.liveAdvance(60, frames, events)!;
    frames += c1.frames.length;
    events += c1.events.length;
    expect(c1.t).toBeGreaterThanOrEqual(60);
    expect(c1.live.find((x) => x.id === mine(e)[0])!.fuel).toBeGreaterThan(0);
    const [me] = mine(e);
    expect(
      e.dispatch({ type: 'SetRaceStrategy', riderId: me!, mode: 'maxAttack', fuelMap: 'performance' }).ok,
    ).toBe(true);
    // Solo i propri piloti.
    const other = e.lastReplay!.riders.find((r) => !r.mine)!.id;
    expect(e.dispatch({ type: 'SetRaceStrategy', riderId: other, mode: 'maxAttack' }).ok).toBe(false);
    const c2 = e.liveAdvance(120, frames, events)!;
    expect(c2.live.find((x) => x.id === me)!.mode).toBe('maxAttack');
    expect(c2.events.some((x) => x.kind === 'strategy' && x.riderId === me)).toBe(true);
    const end = e.liveAdvance(1e9, 0, 0)!;
    expect(end.done).toBe(true);
    expect(end.replay!.results.length).toBeGreaterThan(10);
    expect(e.liveRace).toBeNull();
    expect(rows(e.state, 'sessionResults').some((r) => r.kind === 'sprint')).toBe(true);
    expect(e.state.liveSession).toBeUndefined();
  });

  it('salvataggio a metà gara e caricamento: si riprende esattamente dallo stesso punto', () => {
    const play = (save: boolean) => {
      let e = toSprint('live-2');
      e.dispatch({ type: 'RunSession', live: true, strategies: {} });
      const [me] = mine(e);
      e.liveAdvance(90, 0, 0, 80);
      e.dispatch({ type: 'SetRaceStrategy', riderId: me!, tyreMode: 'conservative', mode: 'conservative' });
      e.liveAdvance(200, 0, 0, 190);
      if (save) {
        e.syncLive();
        const json = serializeState(e.state as never);
        e = GameEngine.fromState(deserializeState(json));
        expect(e.liveRace!.viewerT).toBe(190);
        expect(e.lastReplay!.frames.length).toBeGreaterThan(300);
      }
      e.dispatch({ type: 'SetRaceStrategy', riderId: me!, mode: 'attack' });
      return e.liveAdvance(1e9, 0, 0)!.replay!.results;
    };
    expect(play(true)).toEqual(play(false));
  });

  it('senza gara in diretta la sessione si simula tutta insieme come prima', () => {
    const e = toSprint('live-3');
    expect(e.dispatch({ type: 'RunSession', strategies: {} }).ok).toBe(true);
    expect(e.liveRace).toBeNull();
    expect(e.lastReplay!.results.length).toBeGreaterThan(10);
  });
});
