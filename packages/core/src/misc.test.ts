import { describe, expect, it } from 'vitest';
import { IdFactory, idPrefix, isId } from './ids.ts';
import { credits, formatCredits, splitCredits } from './money.ts';
import { EventLog } from './events.ts';
import { attr01, clamp, invLerp, roundTo, sigmoid } from './math.ts';
import { err, ok, unwrap } from './result.ts';

describe('IdFactory', () => {
  it('genera ID progressivi per prefisso e riprende dai contatori salvati', () => {
    const f = new IdFactory();
    expect(f.next('rdr')).toBe('rdr_000001');
    expect(f.next('rdr')).toBe('rdr_000002');
    expect(f.next('tem')).toBe('tem_000001');
    const g = new IdFactory(f.snapshot());
    expect(g.next('rdr')).toBe('rdr_000003');
    expect(() => f.next('RIDER')).toThrow();
  });

  it('riconosce gli ID e i loro prefissi', () => {
    expect(isId('rdr_000001', 'rdr')).toBe(true);
    expect(isId('tem_000001', 'rdr')).toBe(false);
    expect(isId('rdr_1', 'rdr')).toBe(false);
    expect(idPrefix('stf_000042')).toBe('stf');
  });
});

describe('denaro', () => {
  it('accetta solo interi', () => {
    expect(credits(1_000)).toBe(1_000);
    expect(() => credits(10.5)).toThrow(RangeError);
  });

  it('ripartisce senza perdere crediti', () => {
    const parts = splitCredits(1_000_001, [1, 1, 1]);
    expect(parts.reduce((s, x) => s + x, 0)).toBe(1_000_001);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it('formatta gli importi', () => {
    expect(formatCredits(18_420_000)).toBe('₡ 18,42 M');
    expect(formatCredits(640_000)).toBe('₡ 640 k');
    expect(formatCredits(38_000)).toBe('₡ 38,0 k');
    expect(formatCredits(-4_960_000)).toBe('−₡ 4,96 M');
    expect(formatCredits(950)).toBe('₡ 950');
  });
});

describe('EventLog', () => {
  type Events = {
    RaceFinished: { roundId: string; winnerId: string };
    ContractSigned: { contractId: string };
  };

  it('registra gli eventi in ordine e notifica i sottoscrittori', () => {
    const log = new EventLog<Events>();
    const seen: string[] = [];
    const off = log.on('RaceFinished', (e) => seen.push(e.payload.winnerId));
    log.on('*', (e) => seen.push(`*${e.type}`));
    log.emit('RaceFinished', 10, { roundId: 'rnd_000001', winnerId: 'rdr_000001' });
    log.emit('ContractSigned', 11, { contractId: 'ctr_000001' });
    off();
    log.emit('RaceFinished', 17, { roundId: 'rnd_000002', winnerId: 'rdr_000002' });
    expect(seen).toEqual(['rdr_000001', '*RaceFinished', '*ContractSigned', '*RaceFinished']);
    expect(log.size).toBe(3);
    expect(log.since(1).map((e) => e.seq)).toEqual([2, 3]);
    expect(log.ofType('RaceFinished')).toHaveLength(2);
  });

  it('gli eventi sono immutabili', () => {
    const log = new EventLog<Events>();
    const e = log.emit('ContractSigned', 0, { contractId: 'ctr_000001' });
    expect(Object.isFrozen(e)).toBe(true);
  });
});

describe('math e result', () => {
  it('funzioni di base', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(invLerp(10, 20, 15)).toBe(0.5);
    expect(sigmoid(0)).toBe(0.5);
    expect(roundTo(1.23456, 2)).toBe(1.23);
    expect(attr01(1)).toBe(0);
    expect(attr01(100)).toBe(1);
  });

  it('Result', () => {
    expect(unwrap(ok(3))).toBe(3);
    expect(() => unwrap(err('no'))).toThrow();
  });
});
