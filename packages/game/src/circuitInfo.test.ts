import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { skipPreseason } from './preseason.ts';
import { calendar, circuitInfo } from './queries.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
}

describe('scheda circuito dal calendario', () => {
  it('tracciato, caratteristiche e pole/vincitore dell’anno prima; dopo la gara anche quelli di quest’anno', () => {
    const e = career('circ-1');
    const cat = rows(e.state, 'teamEntries').find((x) => x.teamId === e.state.meta.playerTeamId)!.categoryId;
    const first = calendar(e.state, cat)[0]!;
    const info = circuitInfo(e.state, first.id)!;
    expect(info.name).toBe(first.circuit);
    expect(info.track.length).toBeGreaterThan(50);
    expect(info.traits).toHaveLength(3);
    expect(info.history).toHaveLength(1);
    const prev = info.history[0]!;
    expect(prev.played).toBe(false);
    expect(prev.pole?.name).toBeTruthy();
    expect(prev.winner?.name).toBeTruthy();
    // Sempre uguale (non cambia aprendo di nuovo la scheda).
    expect(circuitInfo(e.state, first.id)!.history).toEqual(info.history);
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
    const after = circuitInfo(e.state, first.id)!;
    expect(after.history).toHaveLength(2);
    const now = after.history[1]!;
    expect(now.played).toBe(true);
    const race = rows(e.state, 'sessionResults').find((x) => x.roundId === first.id && x.kind === 'race')!;
    const w = e.state.tables.riders[race.rows.find((x) => x.position === 1)!.riderId]!;
    expect(now.winner!.name).toBe(`${w.firstName} ${w.lastName}`);
  });
});
