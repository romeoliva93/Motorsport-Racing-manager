import { describe, expect, it } from 'vitest';
import { GameCalendar, civilFromDays, daysFromCivil, daysInMonth, isLeapYear } from './time.ts';

describe('date civili', () => {
  it('riconosce gli anni bisestili', () => {
    expect([2024, 2028, 2000].map(isLeapYear)).toEqual([true, true, true]);
    expect([2026, 2100, 1900].map(isLeapYear)).toEqual([false, false, false]);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
  });

  it('converte date note', () => {
    expect(daysFromCivil({ year: 1970, month: 1, day: 1 })).toBe(0);
    expect(daysFromCivil({ year: 2000, month: 3, day: 1 })).toBe(11017);
    expect(civilFromDays(11017)).toEqual({ year: 2000, month: 3, day: 1 });
  });

  it('andata e ritorno su 200 anni', () => {
    const start = daysFromCivil({ year: 1950, month: 1, day: 1 });
    const end = daysFromCivil({ year: 2150, month: 12, day: 31 });
    for (let d = start; d <= end; d += 13) expect(daysFromCivil(civilFromDays(d))).toBe(d);
  });

  it('rifiuta date inesistenti', () => {
    expect(() => daysFromCivil({ year: 2027, month: 2, day: 29 })).toThrow(RangeError);
    expect(() => daysFromCivil({ year: 2027, month: 13, day: 1 })).toThrow(RangeError);
  });
});

describe('GameCalendar', () => {
  const cal = new GameCalendar(2027);

  it('il giorno 0 è il 1° gennaio dell’anno di inizio', () => {
    expect(cal.toDate(0)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(cal.fromDate({ year: 2027, month: 12, day: 31 })).toBe(364);
    expect(cal.toDate(365)).toEqual({ year: 2028, month: 1, day: 1 });
  });

  it('calcola il giorno della settimana', () => {
    // 1° gennaio 2027 è un venerdì (indice 4 con lunedì = 0).
    expect(cal.weekday(0)).toBe(4);
    expect(cal.weekday(3)).toBe(0);
  });

  it('calcola l’età compiuta anche con date di nascita prima dell’inizio carriera', () => {
    const birth = cal.fromDate({ year: 2003, month: 6, day: 14 });
    expect(birth).toBeLessThan(0);
    expect(cal.ageOn(birth, cal.fromDate({ year: 2027, month: 6, day: 13 }))).toBe(23);
    expect(cal.ageOn(birth, cal.fromDate({ year: 2027, month: 6, day: 14 }))).toBe(24);
  });

  it('formatta in italiano e in inglese', () => {
    expect(cal.format(cal.fromDate({ year: 2027, month: 6, day: 14 }))).toBe('14 giugno 2027');
    expect(cal.format(0, 'en')).toBe('January 1, 2027');
  });
});
