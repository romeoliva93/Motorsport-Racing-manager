import { describe, expect, it } from 'vitest';
import { generateTrack, pointAt } from './track.ts';
import { runQualifying, runRace, type RaceRider } from './race.ts';

const track = generateTrack('brennholz', 14);
const rider = (id: string, skill: number, bike = 0.8, extra: Partial<RaceRider> = {}): RaceRider => ({
  id,
  skill,
  bike,
  overtaking: 0.7,
  defending: 0.7,
  consistency: 0.75,
  concentration: 0.8,
  aggression: 0.5,
  tyreManagement: 0.7,
  reliability: 0.9,
  compound: 'medium',
  mode: 'normal',
  ...extra,
});
const grid = Array.from({ length: 22 }, (_, i) => rider(`r${i}`, 0.9 - i * 0.01));

describe('tracciati', () => {
  it('sono stabili e diversi per circuito', () => {
    expect(generateTrack('brennholz', 14)).toEqual(track);
    expect(generateTrack('vltava', 14).points[10]).not.toEqual(track.points[10]);
    expect(track.points).toHaveLength(480);
    const meanInv = track.speed.reduce((s, v) => s + 1 / v, 0) / track.speed.length;
    expect(meanInv).toBeCloseTo(1, 5);
    const [x, y] = pointAt(track, 0.5);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(1);
  });
});

describe('qualifiche e gara', () => {
  it('le qualifiche ordinano per tempo e i più forti stanno davanti in media', () => {
    const q = runQualifying('q1', 100, grid);
    expect(q.map((x) => x.position)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
    const avgPos = (ids: string[]) =>
      ids.reduce((s, id) => s + q.find((x) => x.riderId === id)!.position, 0) / ids.length;
    expect(avgPos(['r0', 'r1', 'r2', 'r3'])).toBeLessThan(avgPos(['r18', 'r19', 'r20', 'r21']));
  });

  it('la gara è deterministica e produce risultati coerenti', () => {
    const setup = { seed: 'race-1', track, lengthM: 4600, laps: 12, refLap: 100, grid };
    const a = runRace(setup);
    const b = runRace(setup);
    expect(a.results).toEqual(b.results);
    const fin = a.results.filter((r) => r.status === 'finished');
    expect(fin[0]!.position).toBe(1);
    expect(fin[0]!.gap).toBe(0);
    for (let i = 1; i < fin.length; i++)
      if (fin[i]!.gap !== null && fin[i - 1]!.gap !== null)
        expect(fin[i]!.gap!).toBeGreaterThanOrEqual(fin[i - 1]!.gap!);
    expect(a.results).toHaveLength(22);
    expect(a.frames.length).toBeGreaterThan(100);
    expect(a.events.some((e) => e.kind === 'overtake')).toBe(true);
    // Durata realistica: circa giri × giro di riferimento.
    expect(a.duration).toBeGreaterThan(12 * 100 * 0.95);
    expect(a.duration).toBeLessThan(12 * 100 * 1.25);
  });

  it('su molte gare vince più spesso chi è più forte, ma non sempre', () => {
    const wins = new Map<string, number>();
    for (let i = 0; i < 40; i++) {
      const out = runRace({
        seed: `stat-${i}`,
        track,
        lengthM: 4600,
        laps: 20,
        refLap: 100,
        grid: [...grid].reverse(),
      });
      const w = out.results[0]!.riderId;
      wins.set(w, (wins.get(w) ?? 0) + 1);
    }
    // Dai primi cinque per abilità ci si aspetta la maggior parte delle vittorie, anche partendo dal fondo.
    const topWins = ['r0', 'r1', 'r2', 'r3', 'r4'].reduce((t, id) => t + (wins.get(id) ?? 0), 0);
    expect(topWins).toBeGreaterThan(15); // a caso sarebbero ~9
    expect(wins.size).toBeGreaterThan(2);
  });

  it("il ritmo d'attacco aumenta le cadute", () => {
    let calm = 0,
      attack = 0;
    for (let i = 0; i < 30; i++) {
      const g1 = grid.map((r) => ({ ...r, mode: 'conservative' as const }));
      const g2 = grid.map((r) => ({ ...r, mode: 'attack' as const }));
      calm += runRace({
        seed: `c-${i}`,
        track,
        lengthM: 4600,
        laps: 10,
        refLap: 100,
        grid: g1,
      }).events.filter((e) => e.kind === 'crash').length;
      attack += runRace({
        seed: `c-${i}`,
        track,
        lengthM: 4600,
        laps: 10,
        refLap: 100,
        grid: g2,
      }).events.filter((e) => e.kind === 'crash').length;
    }
    expect(attack).toBeGreaterThan(calm);
  });
});
