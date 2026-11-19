import { describe, expect, it } from 'vitest';
import type { ReplayData, SessionTiming } from '@lean-angle/game';
import { RaceTiming, sessionModel, sessionRows } from './timing.ts';

const rider = (id: string, n: number) => ({
  id,
  firstName: 'Nome',
  lastName: id,
  nationality: 'ITA',
  number: n,
  team: 'T',
  color: '#ff0000',
  color2: '#000',
  mine: n === 1,
  bike: 'Moto',
  compound: 'soft',
});

const session: SessionTiming = {
  roundId: 'r',
  kind: 'fp1',
  circuit: 'C',
  lengthM: 4000,
  length: 600,
  sectors: [0.25, 0.5, 0.75],
  q2Cut: 0,
  riders: [
    {
      ...rider('A', 1),
      laps: [
        { start: 0, seg: [30, 30, 30, 30], type: 'out' },
        { start: 120, seg: [25, 25, 25, 25], type: 'push' },
        { start: 220, seg: [24, 26, 26, 26], type: 'push' },
      ],
    },
    {
      ...rider('B', 2),
      laps: [{ start: 130, seg: [26, 24, 25, 26], type: 'push' }],
    },
  ],
};

describe('schermata tempi: sessioni', () => {
  const m = sessionModel(session);
  it('colori in ordine di tempo: assoluto rosso, personale arancio, più lento grigio; uscite sempre grigie', () => {
    const A = m.passes[0]!,
      B = m.passes[1]!;
    expect(A.slice(0, 4).every((p) => p.color === 'slow')).toBe(true); // giro di uscita
    expect(A[4]!.color).toBe('best'); // primo settore valido
    expect(B[0]!.color).toBe('pb'); // 26 > 25 assoluto, ma è il suo primo settore: miglior personale
    expect(B[1]!.color).toBe('best'); // 24 < 25
    expect(A[8]!.color).toBe('best'); // 24 < 25 (assoluto)
    expect(A[9]!.color).toBe('slow'); // 26: peggio del suo 25 e dell'assoluto 24
  });
  it('classifica per giro migliore, distacchi e stato in pista/box', () => {
    const r = sessionRows(m, 250);
    expect(r[0]!.info.id).toBe('A');
    expect(r[0]!.best).toBe(100);
    expect(r[1]!.best).toBe(101);
    expect(r[1]!.gapFirst).toBeCloseTo(1);
    expect(r[0]!.status).toBe('push');
    expect(r[1]!.status).toBe('box');
    // A è nel secondo settore del terzo giro: S1 fatto, S2 in riempimento.
    expect(r[0]!.cells[0]).toMatchObject({ state: 'done', time: 24 });
    expect(r[0]!.cells[1]!.state).toBe('progress');
    expect(r[0]!.cells[1]!.fill).toBeCloseTo(6 / 26);
  });
  it('prima di uscire nessun tempo', () => {
    const r = sessionRows(m, 10);
    expect(r.every((x) => x.best === null)).toBe(true);
  });
});

describe('schermata tempi: gara dai fotogrammi', () => {
  // Due piloti a velocità costante: 40 m/s e 38 m/s, giro di 4000 m, 2 giri, un fotogramma al secondo.
  const frames = Array.from({ length: 230 }, (_, i) => [Math.min(8000, 40 * i), Math.min(8000, 38 * i)]);
  const data = {
    lengthM: 4000,
    laps: 2,
    frameEvery: 1,
    timingSectors: [0.25, 0.5, 0.75],
    riders: [rider('A', 1), rider('B', 2)].map((r) => ({
      ...r,
      short: r.id,
      portrait: { key: '', pool: '' },
    })),
  } as unknown as ReplayData;
  it('passaggi ai checkpoint interpolati, giri e distacchi all’ultimo checkpoint in comune', () => {
    const rt = new RaceTiming(data).update(frames);
    expect(rt.model.passes[0]![0]!.t).toBeCloseTo(25);
    expect(rt.model.laps[0]![0]!.end).toBeCloseTo(100);
    const rows = rt.rows(150, [0, 1], new Set(), new Set());
    expect(rows[1]!.gapFirst).toBeCloseTo(4000 / 38 + 1000 / 38 - 125, 1);
    expect(rows[0]!.laps).toBe(1);
    // Anche se l'ordine in pista passato è sbagliato, la tabella segue i checkpoint: distacchi mai negativi.
    const swapped = rt.rows(150, [1, 0], new Set(), new Set());
    expect(swapped.map((r) => r.info.id)).toEqual(['A', 'B']);
    expect(swapped[1]!.gapPrev!).toBeGreaterThan(0);
  });
  it('incrementale: stessi passaggi a pezzi o tutti insieme', () => {
    const a = new RaceTiming(data).update(frames);
    const b = new RaceTiming(data);
    for (let k = 20; k <= frames.length; k += 20) b.update(frames.slice(0, k));
    b.update(frames);
    expect(b.model.passes).toEqual(a.model.passes);
  });
});
