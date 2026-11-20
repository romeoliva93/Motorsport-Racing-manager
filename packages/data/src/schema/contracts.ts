import type { Credits, GameDay, Id } from '@lean-angle/core';
import type { TeamId, SponsorId } from './org.ts';
import type { RiderId, StaffId } from './people.ts';

export type ContractId = Id<'ctr'>;

export type ContractKind = 'rider' | 'staff' | 'sponsor' | 'substitute';

export interface Bonus {
  condition: 'win' | 'podium' | 'top10' | 'points' | 'title' | 'racesStarted';
  amount: Credits;
}

export interface Contract {
  id: ContractId;
  kind: ContractKind;
  employerId: TeamId;
  counterpartyId: RiderId | StaffId | SponsorId;
  startDay: GameDay;
  endDay: GameDay;
  /** Stipendio annuo (contratti normali) o compenso per gara (sostituti). */
  salary: Credits;
  bonuses: Bonus[];
  role: string;
  status: 'active' | 'pending' | 'ended' | 'terminated';
  /** Solo contratti temporanei per sostituti (INJURIES_AND_TESTERS.md §2). */
  substitute?: {
    scope: 'singleRound' | 'multiRound' | 'untilReturn';
    replacesRiderId: RiderId;
    earlyReleaseOnReturn: boolean;
    signingCost: Credits;
  };
}
