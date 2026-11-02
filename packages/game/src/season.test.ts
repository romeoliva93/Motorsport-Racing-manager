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
  it('weekend a sessioni come nel mondiale: prove, Q1/Q2, Sprint, gara', () => {
    const e = career('wk1');
    expect(e.dispatch({ type: 'ContinueToNextEvent' }).ok).toBe(true);
    const w = weekendView(e.state);
    expect(w.state).toBe('today');
    expect(w.sessions.map((x) => x.kind)).toEqual(['fp1', 'practice', 'fp2', 'q1', 'q2', 'sprint', 'race']);
    expect(e.dispatch({ type: 'AdvanceDays', days: 1 }).ok).toBe(false);
    const res = (k: string) =>
      rows(e.state, 'sessionResults').find((x) => x.kind === k && x.categoryId === w.categoryId)!;
    for (let i = 0; i < 5; i++) expect(e.dispatch({ type: 'RunSession' }).ok).toBe(true);
    // Q2: i primi 10 delle Prove + i primi 2 della Q1.
    const practice = res('practice')
      .rows.slice(0, 10)
      .map((r) => r.riderId);
    const q1 = res('q1')
      .rows.slice(0, 2)
      .map((r) => r.riderId);
    expect(
      res('q2')
        .rows.map((r) => r.riderId)
        .sort(),
    ).toEqual([...practice, ...q1].sort());
    expect(res('q1').rows.length).toBe(res('practice').rows.length - 10);
    const grid = res('qualifying').rows;
    expect(
      grid
        .slice(0, 12)
        .map((r) => r.riderId)
        .sort(),
    ).toEqual([...practice, ...q1].sort());
    // Gomme: ogni sessione consuma un treno.
    const me = w.myRiders[0]!;
    const left = weekendView(e.state).myRiders[0]!.tyresLeft;
    expect(left.soft + left.medium + left.hard).toBe(11 - ((q1 as string[]).includes(me.id) ? 5 : 4));
    // Sprint con mezza distanza e punti ai primi 9.
    expect(e.dispatch({ type: 'RunSession', strategies: {} }).ok).toBe(true);
    expect(res('sprint').rows.filter((r) => r.points > 0).length).toBeLessThanOrEqual(9);
    expect(e.lastReplay!.kind).toBe('sprint');
    expect(e.dispatch({ type: 'RunSession', strategies: {} }).ok).toBe(true);
    expect(e.lastReplay!.kind).toBe('race');
    // Tutte le categorie hanno corso lo stesso giorno.
    expect(rows(e.state, 'sessionResults').filter((x) => x.kind === 'race').length).toBe(3);
    expect(validateGameState(e.state)).toEqual([]);
  });

  it('non si possono usare gomme finite', () => {
    const e = career('wk4');
    e.dispatch({ type: 'ContinueToNextEvent' });
    const id = weekendView(e.state).myRiders[0]!.id;
    for (let i = 0; i < 3; i++)
      expect(
        e.dispatch({ type: 'RunSession', strategies: { [id]: { compound: 'hard', mode: 'normal' } } }).ok,
      ).toBe(true);
    const r = e.dispatch({ type: 'RunSession', strategies: { [id]: { compound: 'hard', mode: 'normal' } } });
    expect(r.ok).toBe(false);
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
    expect(pts).toBe(expectedPoints(e));
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

/** Punti attesi: per ogni gara e Sprint, la somma della tabella punti fino all'ultimo pilota arrivato. */
function expectedPoints(e: GameEngine) {
  const race = [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const sprint = [12, 9, 7, 6, 5, 4, 3, 2, 1];
  const cat = championship(e.state)!.categoryId;
  return rows(e.state, 'sessionResults')
    .filter((x) => (x.kind === 'race' || x.kind === 'sprint') && x.categoryId === cat)
    .reduce((t, r) => {
      const fin = r.rows.filter((x) => x.position !== null).length;
      return t + (r.kind === 'race' ? race : sprint).slice(0, fin).reduce((a, b) => a + b, 0);
    }, 0);
}
