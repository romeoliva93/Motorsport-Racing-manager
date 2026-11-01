import type { Credits, GameDay, Id } from '@lean-angle/core';
import type { TeamId } from './org.ts';

export type TransactionId = Id<'trx'>;

export const INCOME_CATEGORIES = [
  'sponsor',
  'prizeMoney',
  'commercialRights',
  'investors',
  'merchandising',
  'supply',
] as const;
export const EXPENSE_CATEGORIES = [
  'salaries',
  'development',
  'production',
  'travel',
  'facilities',
  'repairs',
  'logistics',
  'other',
] as const;
export type TransactionCategory = (typeof INCOME_CATEGORIES)[number] | (typeof EXPENSE_CATEGORIES)[number];

export interface Transaction {
  id: TransactionId;
  teamId: TeamId;
  day: GameDay;
  /** Positivo = entrata, negativo = uscita. */
  amount: Credits;
  category: TransactionCategory;
  note: string;
}

export interface FinanceAccount {
  teamId: TeamId;
  /** Saldo iniziale della carriera; il saldo corrente = apertura + somma delle transazioni. */
  openingBalance: Credits;
  creditLimit: Credits;
}
