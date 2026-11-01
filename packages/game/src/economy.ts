/**
 * Economia di base: il primo giorno di ogni mese ogni squadra paga gli stipendi (un dodicesimo dei contratti
 * attivi di piloti e staff), i costi fissi di gestione e incassa la rata degli sponsor, proporzionale alla reputazione.
 * Premi e diritti commerciali si incassano dopo ogni gara (weekend.ts).
 */
import { GameCalendar, type IdFactory } from '@lean-angle/core';
import { RUNNING_COST_MONTHLY, SPONSOR_MONTHLY, rows, type GameState, type TeamId } from '@lean-angle/data';

export function sponsorMonthly(s: GameState, teamId: TeamId): number {
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  if (!entry) return 0;
  const tier = s.tables.categories[entry.categoryId]!.tier;
  const rep = s.tables.teams[teamId]!.reputation;
  return Math.round((SPONSOR_MONTHLY[tier] * (rep / 70)) / 1000) * 1000;
}

export function payrollMonthly(s: GameState, teamId: string): number {
  const yearly = rows(s, 'contracts')
    .filter(
      (c) =>
        c.employerId === teamId &&
        c.status === 'active' &&
        (c.kind === 'rider' || c.kind === 'staff' || c.kind === 'substitute'),
    )
    .reduce((t, c) => t + c.salary, 0);
  return Math.round(yearly / 12 / 1000) * 1000;
}

/** Da chiamare per ogni giorno di gioco: agisce solo il primo del mese. */
export function monthlyFinance(s: GameState, ids: IdFactory): void {
  const d = new GameCalendar(s.meta.startYear).toDate(s.meta.currentDay);
  if (d.day !== 1) return;
  for (const acc of s.accounts) {
    const pay = payrollMonthly(s, acc.teamId);
    const spon = sponsorMonthly(s, acc.teamId);
    for (const [amount, category, note] of [
      [-pay, 'salaries', 'Stipendi di piloti e staff'],
      [spon, 'sponsor', 'Rata mensile degli sponsor'],
      [-runningCostMonthly(s, acc.teamId), 'facilities', 'Costi di gestione (sede, officina, ricambi)'],
    ] as const) {
      if (amount === 0) continue;
      const id = ids.next('trx');
      s.tables.transactions[id] = { id, teamId: acc.teamId, day: s.meta.currentDay, amount, category, note };
    }
  }
}

export function runningCostMonthly(s: GameState, teamId: TeamId): number {
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  return entry ? RUNNING_COST_MONTHLY[s.tables.categories[entry.categoryId]!.tier] : 0;
}
