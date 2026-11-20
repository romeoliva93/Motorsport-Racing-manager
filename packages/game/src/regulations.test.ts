import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { concessionRank, engineStatus, ENGINE_ALLOCATION, teamConcession } from './regulations.ts';
import { championship } from './views.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
}

describe('regolamento MotoGP', () => {
  it('concessioni: solo in MotoGP, il costruttore più forte in fascia più alta', () => {
    const e = career('reg1');
    const s = e.state;
    const mfr = rows(s, 'manufacturers').sort((a, b) => b.engineeringStrength - a.engineeringStrength);
    expect(concessionRank(s, mfr[0]!.id) <= concessionRank(s, mfr.at(-1)!.id)).toBe(true);
    const moto3 = rows(s, 'teamEntries').find(
      (x) => s.tables.categories[x.categoryId]!.tier === 'lightweight',
    )!;
    expect(teamConcession(s, moto3.teamId)).toBeNull();
    expect(teamConcession(s, e.state.meta.playerTeamId!)).not.toBeNull();
  });

  it('motori: uno ogni 3 GP più quelli rotti; oltre la dotazione si parte dai box', () => {
    const e = career('reg2');
    for (let i = 0; i < 7; i++) {
      e.dispatch({ type: 'ContinueToNextEvent' });
      e.dispatch({ type: 'RunRace', strategies: {} });
    }
    const s = e.state;
    const entry = rows(s, 'teamEntries').find((x) => x.teamId === s.meta.playerTeamId)!;
    const id = entry.seats[0]!.riderId!;
    const st = engineStatus(s, id, entry.seasonId, entry.teamId);
    expect(st.used).toBeGreaterThanOrEqual(3);
    expect(st.allocation).toBe(ENGINE_ALLOCATION[teamConcession(s, entry.teamId)!]);
    expect(
      championship(s)!.independentTeams.every((t) => s.tables.teams[t.teamId as TeamId]!.type !== 'factory'),
    ).toBe(true);
  });
});
