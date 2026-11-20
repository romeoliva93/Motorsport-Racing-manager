import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { dashboardView } from './dashboard.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
}

describe('Home (dashboard)', () => {
  it('prima della prima gara: preparazione, sponsor da scegliere, niente classifica', () => {
    const e = career('d1');
    const d = dashboardView(e.state)!;
    expect(d.nextGp?.number).toBe(1);
    expect(d.nextGp?.forecast).not.toBeNull();
    expect(d.riders).toHaveLength(2);
    expect(d.standings).toBeNull();
    expect(d.preparation!.find((p) => p.text.startsWith('Sponsor'))!.done).toBe(false);
    expect(d.tasks.some((t) => t.section === 'sponsors')).toBe(true);
  });

  it('dopo una gara: classifica, posizione e ultimo risultato dei piloti dai dati reali', () => {
    const e = career('d2');
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
    const d = dashboardView(e.state)!;
    expect(d.standings).not.toBeNull();
    expect(d.standings!.some((r) => r.mine)).toBe(true);
    for (const r of d.riders) {
      expect(r.lastResult).not.toBeNull();
      expect(r.lastResult!.circuit.length).toBeGreaterThan(0);
    }
    expect(d.preparation).toBeNull();
  });
});

describe('forma e morale dopo la gara', () => {
  it('cambiano con il risultato e restano nei limiti', () => {
    const e = career('fm1');
    const before = Object.fromEntries(rows(e.state, 'riders').map((r) => [r.id, [r.form, r.morale]]));
    e.dispatch({ type: 'ContinueToNextEvent' });
    e.dispatch({ type: 'RunRace', strategies: {} });
    const race = rows(e.state, 'sessionResults').find((r) => r.kind === 'race')!;
    let changed = 0;
    for (const row of race.rows) {
      const r = e.state.tables.riders[row.riderId]!;
      expect(r.form).toBeGreaterThanOrEqual(-10);
      expect(r.form).toBeLessThanOrEqual(10);
      expect(r.morale).toBeGreaterThanOrEqual(0);
      expect(r.morale).toBeLessThanOrEqual(100);
      if (r.form !== before[r.id]![0] || r.morale !== before[r.id]![1]) changed++;
    }
    expect(changed).toBeGreaterThan(race.rows.length / 2);
    const winner = race.rows.find((x) => x.position === 1)!;
    expect(e.state.tables.riders[winner.riderId]!.morale).toBeGreaterThan(before[winner.riderId]![1]!);
  });
});
