import { describe, expect, it } from 'vitest';
import { rows, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { weatherOf, sessionsOf } from './weekend.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return GameEngine.newCareer({ seed, saveName: 'x', teamId: team });
}

describe('meteo', () => {
  it('deterministico, realistico e vario nel corso della stagione', () => {
    const e = career('wx1');
    const s = e.state;
    const premierSeason = rows(s, 'seasons').find(
      (x) => s.tables.categories[x.categoryId]!.tier === 'premier',
    )!;
    const rounds = premierSeason.roundIds.map((id) => s.tables.rounds[id]!);
    let sessions = 0,
      wet = 0;
    for (const r of rounds) {
      const w = weatherOf(s, r);
      expect(weatherOf(s, r)).toEqual(w);
      expect(w.map((x) => x.kind)).toEqual(sessionsOf(s, r));
      for (const x of w) {
        sessions++;
        if (x.grip !== 'dry') wet++;
        expect(x.airTemp).toBeGreaterThan(-5);
        expect(x.airTemp).toBeLessThan(45);
        expect(x.trackTemp).toBeGreaterThanOrEqual(x.airTemp - 3);
        if (x.sky === 'sun') expect(x.trackTemp).toBeGreaterThan(x.airTemp + 10);
      }
    }
    // Piove in una parte delle sessioni, non in tutte né in nessuna.
    expect(wet / sessions).toBeGreaterThan(0.03);
    expect(wet / sessions).toBeLessThan(0.4);
    // Il deserto a marzo è più caldo della Germania a giugno di notte… almeno in media.
    const avg = (country: string) => {
      const rs = rounds.filter((r) => s.tables.circuits[r.circuitId]!.country === country);
      const ts = rs.flatMap((r) => weatherOf(s, r).map((x) => x.airTemp));
      return ts.reduce((a, b) => a + b, 0) / ts.length;
    };
    expect(avg('UAE')).toBeGreaterThan(avg('GBR'));
  });

  it('sul bagnato si usano le gomme da pioggia e i tempi salgono', () => {
    const FP = ['fp1', 'practice', 'fp2'];
    for (let i = 0; i < 20; i++) {
      const e = career(`wx-${i}`);
      const st = e.state;
      const season = rows(st, 'seasons').find((x) => st.tables.categories[x.categoryId]!.tier === 'premier')!;
      const target = season.roundIds
        .map((id) => st.tables.rounds[id]!)
        .sort((a, b) => a.startDay - b.startDay)
        .find((r) => {
          const w = weatherOf(st, r);
          return (
            w.some((x) => x.grip === 'wet' && FP.includes(x.kind)) &&
            w.some((x) => x.grip === 'dry' && FP.includes(x.kind))
          );
        });
      if (!target) continue;
      while (e.state.meta.currentDay < target.startDay) {
        if (e.availableCommands().includes('RunRace')) e.dispatch({ type: 'RunRace', strategies: {} });
        else e.dispatch({ type: 'ContinueToNextEvent' });
      }
      e.dispatch({ type: 'RunRace', strategies: {} });
      const w = weatherOf(e.state, target);
      const res = (k: string) =>
        rows(e.state, 'sessionResults').find((x) => x.roundId === target.id && x.kind === k)!;
      const wetRes = res(w.find((x) => x.grip === 'wet' && FP.includes(x.kind))!.kind);
      const dryRes = res(w.find((x) => x.grip === 'dry' && FP.includes(x.kind))!.kind);
      expect(wetRes.rows.filter((r) => r.compound === 'wet').length).toBeGreaterThan(wetRes.rows.length / 2);
      expect(dryRes.rows.filter((r) => r.compound === 'wet').length).toBe(0);
      expect(wetRes.rows[0]!.time!).toBeGreaterThan(dryRes.rows[0]!.time! * 1.04);
      return;
    }
    throw new Error('Nessun weekend bagnato trovato nei semi di prova');
  }, 60000);
});
