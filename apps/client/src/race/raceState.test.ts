import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from '@lean-angle/game';
import { buildScene } from './circuitScene.ts';
import { INTRO, duration, lastDistances, raceFrame, teamsOf } from './raceState.ts';

function raceReplay() {
  const tmp = GameEngine.newCareer({ seed: 'vista', saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  const e = GameEngine.newCareer({ seed: 'vista', saveName: 'x', teamId: team });
  e.dispatch({ type: 'ContinueToNextEvent' });
  e.dispatch({ type: 'RunRace', strategies: {} });
  return e.lastReplay!;
}

describe('stato di gara condiviso fra vista 2D e 3D', () => {
  const data = raceReplay();
  const teams = teamsOf(data);
  const scene = buildScene(
    data.circuit,
    data.country,
    data.track.points,
    data.track.sectors,
    teams,
    data.track.longLap,
  );
  const last = lastDistances(data);
  const at = (t: number, sel: string | null = null) => raceFrame(data, scene, teams, last, t, sel);

  it('è una funzione pura: lo stesso istante dà sempre le stesse posizioni', () => {
    for (const t of [-INTRO + 5, 0, 37.3, duration(data) / 2, duration(data)]) {
      const a = at(t),
        b = at(t);
      expect(b.order.map((o) => o.r.id)).toEqual(a.order.map((o) => o.r.id));
      expect(b.bikes.map((x) => x.pos)).toEqual(a.bikes.map((x) => x.pos));
      expect(b.lap).toBe(a.lap);
    }
  });

  it('cambiare pilota selezionato (o vista) non cambia classifica, giro né posizioni', () => {
    const t = duration(data) * 0.4;
    const a = at(t, data.riders[0]!.id),
      b = at(t, data.riders[5]!.id);
    expect(b.order.map((o) => o.r.id)).toEqual(a.order.map((o) => o.r.id));
    const pos = (f: typeof a) => Object.fromEntries(f.bikes.map((x) => [x.id, x.pos]));
    expect(pos(b)).toEqual(pos(a));
    expect(b.bikes.filter((x) => x.selected).map((x) => x.id)).toEqual([data.riders[5]!.id]);
  });

  it('il tempo scorre in avanti senza salti: il giro non torna mai indietro', () => {
    let lap = 0;
    for (let t = 0; t <= duration(data); t += 3) {
      const f = at(t);
      expect(f.lap).toBeGreaterThanOrEqual(lap);
      lap = f.lap;
    }
    expect(lap).toBe(data.laps);
  });

  it("all'arrivo la classifica mostrata coincide con il risultato della simulazione", () => {
    const end = at(duration(data));
    expect(end.finished).toBe(true);
    const finishers = data.results.filter((r) => r.status === 'finished').map((r) => r.riderId);
    expect(end.order.slice(0, finishers.length).map((o) => o.r.id)).toEqual(finishers);
  });
});
