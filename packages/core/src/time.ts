/**
 * Tempo di gioco (DATA_MODEL.md §1).
 * `GameDay` = numero intero di giorni dal 1° gennaio dell'anno di inizio carriera (giorno 0).
 * Calendario gregoriano prolettico, nessun fuso orario: conversioni pure e deterministiche.
 * Algoritmi days-from-civil / civil-from-days di Howard Hinnant.
 */

export type GameDay = number;

export interface CivilDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = lunedì … 6 = domenica

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const n = lengths[month - 1];
  if (n === undefined) throw new RangeError(`Mese non valido: ${month}`);
  return n;
}

/** Giorni dal 1970-01-01 per una data civile. */
export function daysFromCivil({ year, month, day }: CivilDate): number {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Data non valida: ${year}-${month}-${day}`);
  }
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Data civile per un numero di giorni dal 1970-01-01. */
export function civilFromDays(days: number): CivilDate {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** Calendario della carriera: converte tra GameDay e date civili. */
export class GameCalendar {
  private readonly epoch: number;
  readonly startYear: number;

  constructor(startYear: number) {
    this.startYear = startYear;
    this.epoch = daysFromCivil({ year: startYear, month: 1, day: 1 });
  }

  toDate(day: GameDay): CivilDate {
    return civilFromDays(this.epoch + day);
  }

  fromDate(date: CivilDate): GameDay {
    return daysFromCivil(date) - this.epoch;
  }

  weekday(day: GameDay): Weekday {
    // 1970-01-01 era un giovedì (indice 3 con lunedì = 0).
    return ((((this.epoch + day + 3) % 7) + 7) % 7) as Weekday;
  }

  /** Età compiuta in anni a una certa data. */
  ageOn(birthDay: GameDay, day: GameDay): number {
    const b = this.toDate(birthDay);
    const d = this.toDate(day);
    let age = d.year - b.year;
    if (d.month < b.month || (d.month === b.month && d.day < b.day)) age--;
    return age;
  }

  format(day: GameDay, locale: 'it' | 'en' = 'it'): string {
    const { year, month, day: dd } = this.toDate(day);
    const it = [
      'gennaio',
      'febbraio',
      'marzo',
      'aprile',
      'maggio',
      'giugno',
      'luglio',
      'agosto',
      'settembre',
      'ottobre',
      'novembre',
      'dicembre',
    ];
    const en = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return locale === 'it' ? `${dd} ${it[month - 1]} ${year}` : `${en[month - 1]} ${dd}, ${year}`;
  }
}
