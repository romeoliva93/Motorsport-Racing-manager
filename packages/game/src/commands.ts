import type { GarageKey, PartKey, SponsorRisk } from '@lean-angle/data';
/**
 * Comandi: l'unico modo per modificare lo stato (ARCHITECTURE.md §3.2). Giocatore e IA usano gli stessi.
 * Ogni comando viene validato prima di essere applicato; un comando non valido non modifica nulla.
 */
import type { ContractOffer, CustomTeamOptions, RiderId, TeamId } from '@lean-angle/data';

export type Command =
  /** Il giocatore prende la guida di una squadra esistente (inizio carriera). */
  | {
      type: 'SetPlayerTeam';
      teamId: TeamId;
      /** Costruttore che fornisce le moto (squadre clienti); assente = quello attuale. */
      manufacturerId?: string;
    }
  /** Il giocatore crea una squadra nuova e ne prende la guida (inizio carriera). */
  | { type: 'CreateTeam'; team: CustomTeamOptions }
  /** Avanza di un numero di giorni (1–60). */
  | { type: 'AdvanceDays'; days: number }
  /** Avanza fino al prossimo evento del calendario della categoria del giocatore. */
  | { type: 'ContinueToNextEvent' }
  /** Offerta a un pilota (nuovo ingaggio o rinnovo di un proprio pilota). */
  | { type: 'MakeOffer'; riderId: RiderId; offer: ContractOffer }
  /** Accetta la controproposta del pilota nell'ultima risposta della trattativa. */
  | { type: 'AcceptCounter'; riderId: RiderId; replaceRiderId: RiderId | null }
  /** Chiude una trattativa aperta. */
  | { type: 'WithdrawNegotiation'; riderId: RiderId }
  /** Prossima sessione del weekend di oggi (prove, qualifiche, Sprint o gara); strategie per Sprint e gara. */
  | {
      type: 'RunSession';
      /** Sprint/gara in diretta: la simulazione avanza a passi e le strategie si cambiano in corsa. */
      live?: boolean;
      strategies?: Record<
        string,
        {
          compound: 'soft' | 'medium' | 'hard' | 'wet';
          mode: 'veryConservative' | 'conservative' | 'normal' | 'attack' | 'maxAttack';
          /** Prove libere: programma di lavoro del pilota. */
          program?: 'track' | 'setup' | 'longRun';
        }
      >;
    }
  /** Simula tutto il resto del weekend di oggi con la strategia indicata. */
  | {
      type: 'RunRace';
      strategies: Record<
        string,
        {
          compound: 'soft' | 'medium' | 'hard' | 'wet';
          mode: 'veryConservative' | 'conservative' | 'normal' | 'attack' | 'maxAttack';
        }
      >;
    }
  /** Chiude la stagione conclusa e apre la successiva. */
  | { type: 'StartNextSeason' }
  /** Compra il livello successivo di un componente della moto. */
  | { type: 'BuyUpgrade'; part: PartKey }
  | { type: 'ServiceParts'; bikeId: string; parts: GarageKey[] }
  /** Strategia in corsa di un proprio pilota (gara in diretta): ritmo, mappa carburante, gestione gomme. */
  | {
      type: 'SetRaceStrategy';
      riderId: string;
      mode?: 'veryConservative' | 'conservative' | 'normal' | 'attack' | 'maxAttack';
      fuelMap?: 'save' | 'standard' | 'performance';
      tyreMode?: 'conservative' | 'balanced' | 'performance';
    }
  /** Porta a termine la gara in diretta (salta alla fine). */
  | { type: 'FinishLiveRace' }
  | { type: 'SetGarageMode'; mode: 'auto' | 'assisted' | 'manual' }
  | { type: 'BuySpare'; group: string }
  | { type: 'ReplaceGroup'; bikeId: string; group: string }
  | { type: 'SetSetup'; riderId: string; condition: 'dry' | 'wet'; values: Record<string, number> }
  /** Ingaggia un tecnico svincolato (capotecnico/ingegnere: assegnato a un pilota). */
  | { type: 'HireStaff'; staffId: string; years: number; riderId?: string; replaceStaffId?: string }
  /** Giornata di test pre-stagionale: programma di lavoro per ciascun pilota. */
  | { type: 'RunTestDay'; programs: Record<string, 'track' | 'setup' | 'longRun' | 'development'> }
  /** Il manager paga un corso con i suoi soldi. */
  | { type: 'ManagerCourse'; skill: 'negotiation' | 'commercial' | 'technical' }
  /** Il manager mette soldi propri nella squadra. */
  | { type: 'InvestInTeam'; amount: number }
  /** Trattativa sullo stipendio di un'offerta di lavoro. */
  | { type: 'NegotiateJobOffer'; offerId: string; salary: number }
  | { type: 'AcceptJobOffer'; offerId: string }
  /** Firma l'offerta dello sponsor con obiettivo stagionale. */
  | { type: 'SignSponsorDeal'; risk: SponsorRisk };

export type CommandType = Command['type'];

export type GameEvents = {
  PlayerTeamSet: { teamId: TeamId };
  TeamCreated: { teamId: TeamId; name: string };
  TimeAdvanced: { from: number; to: number };
  RoundReached: { roundId: string; roundNumber: number; circuitId: string; categoryId: string };
  OfferAnswered: { riderId: RiderId; response: 'accepted' | 'rejected' | 'countered'; message: string };
  RiderSigned: {
    riderId: RiderId;
    teamId: TeamId;
    salary: number;
    years: number;
    kind: 'transfer' | 'renewal';
  };
  RiderReleased: { riderId: RiderId; teamId: TeamId };
  AiRiderSigned: { riderId: RiderId; teamId: TeamId };
  SessionDone: { roundId: string; session: string };
  RaceDone: { roundId: string; summary: string };
  SeasonStarted: { year: number };
  UpgradeBought: { part: string; level: number };
  PartsServiced: { bikeId: string; parts: string[]; cost: number };
  GarageModeSet: { mode: string };
  LiveRaceStarted: { roundId: string; kind: string };
  RaceStrategyChanged: { riderId: string };
  SpareBought: { group: string; cost: number };
  GroupReplaced: { bikeId: string; group: string };
  SetupChanged: { riderId: string; condition: string };
  SponsorSigned: { risk: string };
  StaffHired: { staffId: string; role: string };
  TestDayDone: { testId: string; day: number };
  ManagerCourseTaken: { skill: string; level: number };
  ManagerInvested: { amount: number };
  JobOfferAnswered: { offerId: string; answer: string; offer: number };
  JobAccepted: { teamId: string };
};
