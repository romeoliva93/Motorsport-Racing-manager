import { describe, expect, it } from 'vitest';
import { Rng, RngStreams, cyrb128 } from './rng.ts';
import { mean, stdDev } from './math.ts';

describe('Rng', () => {
  it('è deterministico: stesso seme, stessa sequenza', () => {
    const a = Rng.fromSeed('lean-angle');
    const b = Rng.fromSeed('lean-angle');
    const sa = Array.from({ length: 50 }, () => a.nextUint32());
    const sb = Array.from({ length: 50 }, () => b.nextUint32());
    expect(sa).toEqual(sb);
  });

  it('semi diversi producono sequenze diverse', () => {
    const a = Rng.fromSeed('seed-1').nextUint32();
    const b = Rng.fromSeed('seed-2').nextUint32();
    expect(a).not.toBe(b);
  });

  it('fissa i valori di riferimento (protegge da modifiche involontarie dell’algoritmo)', () => {
    const r = Rng.fromSeed('golden');
    const first = [r.nextUint32(), r.nextUint32(), r.nextUint32()];
    const again = Rng.fromSeed('golden');
    expect([again.nextUint32(), again.nextUint32(), again.nextUint32()]).toEqual(first);
    expect(cyrb128('golden')).toHaveLength(4);
    expect(first.every((x) => Number.isInteger(x) && x >= 0 && x < 2 ** 32)).toBe(true);
  });

  it('riprende esattamente da uno stato salvato', () => {
    const r = Rng.fromSeed('save');
    for (let i = 0; i < 100; i++) r.next();
    const state = r.getState();
    const expected = Array.from({ length: 20 }, () => r.next());
    const restored = Rng.fromState(state);
    expect(Array.from({ length: 20 }, () => restored.next())).toEqual(expected);
  });

  it('next() è uniforme in [0,1)', () => {
    const r = Rng.fromSeed('uniform');
    const xs = Array.from({ length: 100_000 }, () => r.next());
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mean(xs)).toBeCloseTo(0.5, 2);
    const buckets = new Array(10).fill(0);
    for (const x of xs) buckets[Math.floor(x * 10)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
  });

  it('int() copre tutti i valori con estremi inclusi', () => {
    const r = Rng.fromSeed('int');
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) seen.add(r.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => r.int(5, 1)).toThrow(RangeError);
    expect(() => r.int(0.5, 2)).toThrow(RangeError);
  });

  it('normal() ha media e deviazione standard attese', () => {
    const r = Rng.fromSeed('normal');
    const xs = Array.from({ length: 50_000 }, () => r.normal(10, 2));
    expect(mean(xs)).toBeCloseTo(10, 1);
    expect(stdDev(xs)).toBeCloseTo(2, 1);
  });

  it('weightedPick() rispetta i pesi', () => {
    const r = Rng.fromSeed('weights');
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 30_000; i++) counts[r.weightedPick(['a', 'b', 'c'] as const, [1, 2, 0])]++;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(1.85);
    expect(counts.b / counts.a).toBeLessThan(2.15);
    expect(() => r.weightedPick(['x'], [0])).toThrow();
  });

  it('shuffle() restituisce una permutazione senza modificare l’originale', () => {
    const r = Rng.fromSeed('shuffle');
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((a, b) => a - b)).toEqual(src);
  });
});

describe('RngStreams', () => {
  it('i flussi sono indipendenti: usarne uno non altera gli altri', () => {
    const s1 = new RngStreams('career-1');
    const s2 = new RngStreams('career-1');
    for (let i = 0; i < 1000; i++) s1.get('weather').next();
    expect(s1.get('market').next()).toBe(s2.get('market').next());
  });

  it('snapshot() permette di riprendere tutti i flussi', () => {
    const s = new RngStreams('career-2');
    s.get('race').next();
    s.get('market').next();
    const restored = new RngStreams('career-2', s.snapshot());
    expect(restored.get('race').next()).toBe(s.get('race').next());
    expect(restored.get('market').next()).toBe(s.get('market').next());
  });
});
