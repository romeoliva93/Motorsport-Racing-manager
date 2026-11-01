/**
 * Motore di gioco puro (nessuna dipendenza da browser o UI). Esegue i comandi sullo stato e
 * registra gli eventi di dominio. Il pacchetto engine-host lo fa girare in un Web Worker.
 */
import { EventLog, err, ok, type DomainEvent, type Result } from '@lean-angle/core';
import { generateWorld, rows, type GameState, type Round, type TeamId } from '@lean-angle/data';
import type { Command, CommandType, GameEvents } from './commands.ts';

export interface NewCareerOptions {
  seed: string;
  saveName: string;
  teamId?: TeamId;
  startYear?: number;
}

const MAX_ADVANCE_DAYS = 60;

export class GameEngine {
  readonly events = new EventLog<GameEvents>();
  private stateValue: GameState;
  /** Incrementato a ogni modifica: l'interfaccia lo usa per sapere quando rileggere i dati. */
  version = 0;

  private constructor(state: GameState) {
    this.stateValue = state;
  }

  static newCareer(opts: NewCareerOptions): GameEngine {
    const state = generateWorld({
      seed: opts.seed,
      saveName: opts.saveName,
      ...(opts.startYear ? { startYear: opts.startYear } : {}),
    });
    const engine = new GameEngine(state);
    if (opts.teamId) {
      const r = engine.dispatch({ type: 'SetPlayerTeam', teamId: opts.teamId });
      if (!r.ok) throw new Error(r.error);
    }
    return engine;
  }

  static fromState(state: GameState): GameEngine {
    return new GameEngine(state);
  }

  get state(): Readonly<GameState> {
    return this.stateValue;
  }

  /** Comandi eseguibili ora: l'interfaccia mostra attivi solo questi (niente pulsanti finti). */
  availableCommands(): CommandType[] {
    const out: CommandType[] = [];
    if (this.stateValue.meta.playerTeamId === null) out.push('SetPlayerTeam');
    else out.push('AdvanceDays', 'ContinueToNextEvent');
    return out;
  }

  dispatch(cmd: Command): Result<DomainEvent[], string> {
    const before = this.events.lastSeq;
    const check = this.validate(cmd);
    if (!check.ok) return check;
    this.apply(cmd);
    this.version++;
    return ok([...this.events.since(before)]);
  }

  private validate(cmd: Command): Result<true, string> {
    const s = this.stateValue;
    switch (cmd.type) {
      case 'SetPlayerTeam': {
        if (s.meta.playerTeamId !== null) return err('La squadra del giocatore è già stata scelta');
        const team = s.tables.teams[cmd.teamId];
        if (!team) return err('Squadra inesistente');
        if (team.type === 'organizer') return err('La Velocity Rookies Cup non ha squadre gestibili');
        return ok(true);
      }
      case 'AdvanceDays':
        if (s.meta.playerTeamId === null) return err('Scegli prima una squadra');
        if (!Number.isInteger(cmd.days) || cmd.days < 1 || cmd.days > MAX_ADVANCE_DAYS) {
          return err(`Numero di giorni non valido (1–${MAX_ADVANCE_DAYS})`);
        }
        return ok(true);
      case 'ContinueToNextEvent':
        if (s.meta.playerTeamId === null) return err('Scegli prima una squadra');
        if (!this.nextRound()) return err('Nessun altro evento in calendario per questa stagione');
        return ok(true);
    }
  }

  private apply(cmd: Command): void {
    const s = this.stateValue;
    switch (cmd.type) {
      case 'SetPlayerTeam':
        s.meta.playerTeamId = cmd.teamId;
        this.events.emit('PlayerTeamSet', s.meta.currentDay, { teamId: cmd.teamId });
        return;
      case 'AdvanceDays':
        this.advanceTo(s.meta.currentDay + cmd.days);
        return;
      case 'ContinueToNextEvent':
        this.advanceTo(this.nextRound()!.startDay);
        return;
    }
  }

  /** Avanza giorno per giorno: ogni giorno è il punto in cui i sistemi futuri (economia, mercato…) verranno eseguiti. */
  private advanceTo(target: number): void {
    const s = this.stateValue;
    const from = s.meta.currentDay;
    const rounds = this.playerRounds();
    for (let day = from + 1; day <= target; day++) {
      s.meta.currentDay = day;
      for (const r of rounds) {
        if (r.startDay === day) {
          const season = s.tables.seasons[r.seasonId]!;
          this.events.emit('RoundReached', day, {
            roundId: r.id,
            roundNumber: r.number,
            circuitId: r.circuitId,
            categoryId: season.categoryId,
          });
        }
      }
    }
    this.events.emit('TimeAdvanced', target, { from, to: target });
  }

  /** Round della categoria in cui corre la squadra del giocatore, in ordine di data. */
  playerRounds(): Round[] {
    const s = this.stateValue;
    const teamId = s.meta.playerTeamId;
    if (!teamId) return [];
    const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
    if (!entry) return [];
    const season = s.tables.seasons[entry.seasonId]!;
    return season.roundIds.map((id) => s.tables.rounds[id]!).sort((a, b) => a.startDay - b.startDay);
  }

  nextRound(): Round | undefined {
    return this.playerRounds().find((r) => r.startDay > this.stateValue.meta.currentDay);
  }
}
