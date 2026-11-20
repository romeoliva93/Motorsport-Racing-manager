/** Mercato piloti: trattative con offerte, risposte e controproposte (GDD §5). */
import type { GameDay, Id } from '@lean-angle/core';
import type { RiderId } from './people.ts';
import type { TeamId } from './org.ts';

export type NegotiationId = Id<'neg'>;

export interface ContractOffer {
  /** Stipendio annuo in euro. */
  salary: number;
  years: 1 | 2 | 3;
  role: 'race' | 'test';
  winBonus: number;
  podiumBonus: number;
  /** Pilota titolare che lascia il posto al nuovo arrivato (solo per un ruolo da titolare in un'altra squadra). */
  replaceRiderId: RiderId | null;
}

export type NegotiationResponse = 'accepted' | 'rejected' | 'countered';

export interface NegotiationRound {
  day: GameDay;
  offer: ContractOffer;
  response: NegotiationResponse;
  /** Richiesta del pilota quando risponde con una controproposta. */
  counter?: { salary: number; years: 1 | 2 | 3 };
  /** Risposta del pilota o del suo manager, da mostrare all'utente. */
  message: string;
}

export interface Negotiation {
  id: NegotiationId;
  teamId: TeamId;
  riderId: RiderId;
  kind: 'transfer' | 'renewal';
  status: 'open' | 'signed' | 'rejected' | 'withdrawn';
  /** Clausola di rescissione da pagare alla squadra attuale (0 se il pilota è libero o è un rinnovo). */
  buyout: number;
  /** Quante offerte il pilota è ancora disposto a valutare. */
  patience: number;
  startedDay: GameDay;
  rounds: NegotiationRound[];
}
