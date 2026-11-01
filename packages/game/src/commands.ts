/**
 * Comandi: l'unico modo per modificare lo stato (ARCHITECTURE.md §3.2). Giocatore e IA usano gli stessi.
 * Ogni comando viene validato prima di essere applicato; un comando non valido non modifica nulla.
 */
import type { TeamId } from '@lean-angle/data';

export type Command =
  /** Il giocatore prende la guida di una squadra (inizio carriera). */
  | { type: 'SetPlayerTeam'; teamId: TeamId }
  /** Avanza di un numero di giorni (1–60). */
  | { type: 'AdvanceDays'; days: number }
  /** Avanza fino al prossimo evento del calendario della categoria del giocatore. */
  | { type: 'ContinueToNextEvent' };

export type CommandType = Command['type'];

export type GameEvents = {
  PlayerTeamSet: { teamId: TeamId };
  TimeAdvanced: { from: number; to: number };
  RoundReached: { roundId: string; roundNumber: number; circuitId: string; categoryId: string };
};
