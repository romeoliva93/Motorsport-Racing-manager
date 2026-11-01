import { describe, expect, it } from 'vitest';
import { rows, teamBalance, validateGameState, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { championship, financeView, newsFeed, seasonReview, weekendView } from './views.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
}

/** Gioca una stagione intera: continua fino a ogni GP, qualifiche, gara. */
function playSeason(e: GameEngine) {
  let guard = 0;
  while (!e.availableCommands().includes('StartNextSeason') && guard++ < 200) {
    const cmds = e.availableCommands();
    if (cmds.includes('RunQualifying')) expect(e.dispatch({ type: 'RunQualifying' }).ok).toBe(true);
    if (e.availableCommands().includes('RunRace')) {
      const w = weekendView(e.state);
      const strategies = Object.fromEntries(w.myRiders.map((r) => [r.id, r.suggested]));
      const res = e.dispatch({ type: 'RunRace', strategies });
      expect(res.ok).toBe(true);
      continue;
    }
    const r = e.dispatch({ type: 'ContinueToNextEvent' });
    expect(r.ok, r.ok ? '' : r.error).toBe(true);
  }
}

describe('stagione giocabile', () => {
  it('il tempo si ferma al GP e non si può proseguire senza correrlo', () => {
    const e = career('wk1');
    expect(e.dispatch({ type: 'ContinueToNextEvent' }).ok).toBe(true);
    const w = weekendView(e.state);
    expect(w.state).toBe('today');
    expect(e.availableCommands()).toContain('RunQualifying');
    expect(e.dispatch({ type: 'AdvanceDays', days: 1 }).ok).toBe(false);
    expect(e.dispatch({ type: 'RunQualifying' }).ok).toBe(true);
    expect(weekendView(e.state).qualifying!.length).toBeGreaterThan(10);
    expect(e.dispatch({ type: 'RunRace', strategies: {} }).ok).toBe(true);
    expect(e.lastReplay!.frames.length).toBeGreaterThan(100);
    expect(e.lastReplay!.riders.some((r) => r.mine)).toBe(true);
    // Tutte le categorie hanno corso lo stesso giorno.
    expect(rows(e.state, 'sessionResults').filter((x) => x.kind === 'race').length).toBe(3);
    expect(validateGameState(e.state)).toEqual([]);
  });

  it('stagione completa: classifiche, economia, notizie, cambio stagione', () => {
    const e = career('wk2');
    const team = e.state.meta.playerTeamId!;
    const start = teamBalance(e.state, team);
    playSeason(e);
    const ch = championship(e.state)!;
    expect(ch.racesDone).toBe(20);
    expect(ch.riders[0]!.points).toBeGreaterThan(200);
    const pts = ch.riders.reduce((a, r) => a + r.points, 0);
    expect(pts).toBe(
      20 * [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].reduce((a, b) => a + b, 0) - lostPoints(e),
    );
    // Vittorie distribuite fra più piloti (nessun risultato predeterminato).
    expect(ch.riders.filter((r) => r.wins > 0).length).toBeGreaterThan(2);
    const f = financeView(e.state)!;
    expect(f.balance).not.toBe(start);
    expect(f.byCategory.some((x) => x.category === 'salaries' && x.amount < 0)).toBe(true);
    expect(f.byCategory.some((x) => x.category === 'prizeMoney')).toBe(true);
    expect(newsFeed(e.state).some((n) => n.tag === 'campionato' && n.title.includes('campione'))).toBe(true);
    const rev = seasonReview(e.state)!;
    expect(rev.champions.length).toBe(4);
    expect(validateGameState(e.state)).toEqual([]);

    expect(e.availableCommands()).toContain('MakeOffer'); // finestra di mercato di fine stagione
    expect(e.dispatch({ type: 'StartNextSeason' }).ok).toBe(true);
    expect(validateGameState(e.state)).toEqual([]);
    const ch2 = championship(e.state)!;
    expect(ch2.year).toBe(ch.year + 1);
    expect(ch2.racesDone).toBe(0);
    // Ogni squadra IA ha ancora due piloti.
    for (const en of rows(e.state, 'teamEntries'))
      if (en.teamId !== team)
        expect(
          en.seats.every((x) => x.riderId !== null),
          en.teamId,
        ).toBe(true);
    expect(e.dispatch({ type: 'ContinueToNextEvent' }).ok).toBe(true);
    expect(weekendView(e.state).state).toBe('today');
  });

  it('stesso seme e stesse scelte → stessa gara', () => {
    const run = () => {
      const e = career('wk3');
      e.dispatch({ type: 'ContinueToNextEvent' });
      e.dispatch({ type: 'RunRace', strategies: {} });
      return championship(e.state)!
        .riders.map((r) => `${r.riderId}:${r.points}`)
        .join();
    };
    expect(run()).toBe(run());
  });
});

/** Punti non assegnati quando arrivano meno di 15 piloti al traguardo. */
function lostPoints(e: GameEngine) {
  const pts = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const cat = championship(e.state)!.categoryId;
  return rows(e.state, 'sessionResults')
    .filter((x) => x.kind === 'race' && x.categoryId === cat)
    .reduce((t, r) => {
      const fin = r.rows.filter((x) => x.position !== null).length;
      return t + pts.slice(fin).reduce((a, b) => a + b, 0);
    }, 0);
}
