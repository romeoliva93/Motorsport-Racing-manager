import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { dashboardView } from './dashboard.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
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
