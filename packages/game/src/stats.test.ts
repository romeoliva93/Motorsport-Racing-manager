import { describe, expect, it } from 'vitest';
import { deserializeState, rows, serializeState, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { championship, riderProfile } from './views.ts';
import { teamRiders } from './queries.ts';
import { riderHistory } from './stats.ts';
import { standings } from './weekend.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
}
function playRaces(e: GameEngine, n: number) {
  for (let i = 0; i < n; i++) {
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
  }
}

describe('classifiche e statistiche', () => {
  const e = career('st1');
  playRaces(e, 6);
  const ch = championship(e.state)!;
  const seasonId = rows(e.state, 'seasons').find(
    (x) => x.categoryId === ch.categoryId && x.year === ch.year,
  )!.id;

  it('pole, vittorie e giri veloci: uno per gara, mai duplicati', () => {
    expect(ch.racesDone).toBe(6);
    expect(ch.riders.reduce((t, r) => t + r.wins, 0)).toBe(6);
    expect(ch.riders.reduce((t, r) => t + r.poles, 0)).toBe(6);
    expect(ch.riders.reduce((t, r) => t + r.fastestLaps, 0)).toBe(6);
    // Una sola sessione per tipo e per round.
    const keys = rows(e.state, 'sessionResults').map((r) => `${r.roundId}:${r.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('lo storico di ogni pilota torna con la classifica', () => {
    for (const r of ch.riders) {
      const h = riderHistory(e.state, r.riderId).find((x) => x.seasonId === seasonId)!;
      expect(h.points).toBe(r.points);
      expect(h.wins).toBe(r.wins);
      expect(h.podiums).toBe(r.podiums);
      expect(h.poles).toBe(r.poles);
      expect(h.fastestLaps).toBe(r.fastestLaps);
      expect(h.position).toBe(ch.riders.indexOf(r) + 1);
      expect(h.results.length).toBeLessThanOrEqual(6);
    }
  });

  it('dopo salvataggio e caricamento classifiche e storico sono identici', () => {
    const loaded = deserializeState(serializeState(e.state));
    expect(standings(loaded, seasonId)).toEqual(standings(e.state, seasonId));
    const id = ch.riders[0]!.riderId;
    expect(riderHistory(loaded, id)).toEqual(riderHistory(e.state, id));
  });

  it('selettore piloti: i titolari vengono dai contratti e ogni scheda è del suo pilota', () => {
    const team = e.state.meta.playerTeamId!;
    const racers = teamRiders(e.state, team).filter((r) => r.role === 'race');
    expect(racers).toHaveLength(2);
    const [a, b] = racers.map((r) => riderProfile(e.state, r.id)!);
    expect(a!.detail.id).not.toBe(b!.detail.id);
    expect(a!.detail.number).not.toBe(b!.detail.number);
    expect(a!.contract).not.toBeNull();
    expect(a!.preferences.length).toBeGreaterThan(3);
    expect(a!.current!.starts).toBe(6);
  });
});

describe('universo fisso', () => {
  it('ogni carriera parte dagli stessi personaggi, ma le gare cambiano', () => {
    const a = career('carriera-a');
    const b = career('carriera-b');
    const names = (e: GameEngine) =>
      rows(e.state, 'riders')
        .map((r) => `${r.firstName} ${r.lastName}`)
        .sort();
    expect(names(a)).toEqual(names(b));
    playRaces(a, 1);
    playRaces(b, 1);
    const winner = (e: GameEngine) =>
      championship(e.state)!
        .riders.map((r) => r.riderId)
        .join();
    expect(winner(a)).not.toEqual(winner(b));
  });
});
