/**
 * Motore di gioco puro (nessuna dipendenza da browser o UI). Esegue i comandi sullo stato e
 * registra gli eventi di dominio. Il pacchetto engine-host lo fa girare in un Web Worker.
 */
import { EventLog, IdFactory, RngStreams, err, ok, type DomainEvent, type Result } from '@lean-angle/core';
import {
  createCustomTeam,
  generateWorld,
  rows,
  teamBalance,
  validateCustomTeam,
  type ContractOffer,
  type GameState,
  type Negotiation,
  type NegotiationId,
  type Round,
  type TeamId,
} from '@lean-angle/data';
import type { Command, CommandType, GameEvents } from './commands.ts';
import {
  activeRiderContract,
  aiFillVacancy,
  buyoutFor,
  clampOffer,
  entryOf,
  evaluateOffer,
  executeSigning,
  ineligibility,
  marketOpen,
} from './market.ts';
import { monthlyFinance } from './economy.ts';
import { playerRoundToday, runQualifyingDay, runRaceDay, type ReplayData } from './weekend.ts';
import { addNews } from './news.ts';
import { seasonFinished, startNextSeason } from './season.ts';

export interface NewCareerOptions {
  seed: string;
  saveName: string;
  teamId?: TeamId;
  startYear?: number;
}

const MAX_ADVANCE_DAYS = 60;
const MAX_SALARY = 30_000_000;

export class GameEngine {
  readonly events = new EventLog<GameEvents>();
  private stateValue: GameState;
  private ids: IdFactory;
  private streams: RngStreams;
  /** Incrementato a ogni modifica: l'interfaccia lo usa per sapere quando rileggere i dati. */
  version = 0;
  /** Dati per rivedere l'ultima gara del giocatore (solo in memoria, non salvati). */
  lastReplay: ReplayData | null = null;

  private constructor(state: GameState) {
    this.stateValue = state;
    this.ids = new IdFactory(state.idCounters);
    this.streams = new RngStreams(state.meta.seed, state.rng);
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
    const s = this.stateValue;
    if (s.meta.playerTeamId === null) return ['SetPlayerTeam', 'CreateTeam'];
    const out: CommandType[] = [];
    const today = playerRoundToday(s);
    if (today && today.status !== 'raced') {
      if (!today.status) out.push('RunQualifying');
      out.push('RunRace');
    } else if (seasonFinished(s)) {
      out.push('StartNextSeason');
    } else {
      out.push('AdvanceDays');
      if (this.nextRound()) out.push('ContinueToNextEvent');
    }
    if (marketOpen(s)) out.push('MakeOffer', 'AcceptCounter', 'WithdrawNegotiation');
    return out;
  }

  dispatch(cmd: Command): Result<DomainEvent[], string> {
    const before = this.events.lastSeq;
    const check = this.validate(cmd);
    if (!check.ok) return check;
    this.apply(cmd);
    // Stato del generatore casuale e dei contatori sempre salvati con lo stato.
    this.stateValue.idCounters = this.ids.snapshot();
    this.stateValue.rng = this.streams.snapshot();
    this.version++;
    return ok([...this.events.since(before)]);
  }

  // -------------------------------------------------------------------------------------------
  private openNegotiation(riderId: string): Negotiation | undefined {
    const team = this.stateValue.meta.playerTeamId;
    return rows(this.stateValue, 'negotiations').find(
      (n) => n.riderId === riderId && n.teamId === team && n.status === 'open',
    );
  }

  private validateOffer(riderId: string, offer: ContractOffer): Result<true, string> {
    const s = this.stateValue;
    const teamId = s.meta.playerTeamId!;
    if (!marketOpen(s)) return err('Il mercato è chiuso: si riapre a fine stagione');
    const r = s.tables.riders[riderId as `rdr_${string}`];
    if (!r) return err('Pilota inesistente');
    const closed = rows(s, 'negotiations').find(
      (n) => n.riderId === riderId && n.teamId === teamId && n.status === 'rejected',
    );
    if (closed && s.meta.currentDay - closed.rounds.at(-1)!.day < 14) {
      return err(
        `${r.firstName} ${r.lastName} non vuole riaprire la trattativa per ora (riprova fra qualche settimana)`,
      );
    }
    if (!(offer.salary >= 0 && offer.salary <= MAX_SALARY)) return err('Stipendio non valido');
    if (![1, 2, 3].includes(offer.years)) return err('Durata non valida (1–3 anni)');
    if (offer.winBonus < 0 || offer.podiumBonus < 0) return err('Bonus non validi');
    const c = activeRiderContract(s, r.id);
    const renewal = c?.employerId === teamId;
    if (renewal) return ok(true);
    const why = ineligibility(s, r, teamId, offer.role);
    if (why) return err(why);
    if (offer.role === 'race') {
      const entry = entryOf(s, teamId)!;
      const vacant = entry.seats.some((x) => x.riderId === null);
      if (!vacant && !offer.replaceRiderId) return err('Scegli quale tuo pilota titolare lascia il posto');
      if (offer.replaceRiderId && !entry.seats.some((x) => x.riderId === offer.replaceRiderId)) {
        return err('Il pilota da sostituire non è un tuo titolare');
      }
    }
    const buyout = buyoutFor(s, c);
    if (buyout > teamBalance(s, teamId))
      return err('Budget insufficiente per pagare la clausola rescissoria');
    return ok(true);
  }

  private validate(cmd: Command): Result<true, string> {
    const s = this.stateValue;
    switch (cmd.type) {
      case 'SetPlayerTeam': {
        if (s.meta.playerTeamId !== null) return err('La squadra del giocatore è già stata scelta');
        const team = s.tables.teams[cmd.teamId];
        if (!team) return err('Squadra inesistente');
        if (team.type === 'organizer') return err('La Rookies Cup non ha squadre gestibili');
        return ok(true);
      }
      case 'CreateTeam': {
        if (s.meta.playerTeamId !== null) return err('La squadra del giocatore è già stata scelta');
        const why = validateCustomTeam(s, cmd.team);
        return why ? err(why) : ok(true);
      }
      case 'AdvanceDays':
        if (s.meta.playerTeamId === null) return err('Scegli prima una squadra');
        if (this.raceDue()) return err('Prima corri il Gran Premio di oggi');
        if (seasonFinished(s)) return err('Stagione finita: inizia la nuova stagione');
        if (!Number.isInteger(cmd.days) || cmd.days < 1 || cmd.days > MAX_ADVANCE_DAYS) {
          return err(`Numero di giorni non valido (1–${MAX_ADVANCE_DAYS})`);
        }
        return ok(true);
      case 'ContinueToNextEvent':
        if (s.meta.playerTeamId === null) return err('Scegli prima una squadra');
        if (this.raceDue()) return err('Prima corri il Gran Premio di oggi');
        if (!this.nextRound()) return err('Nessun altro evento in calendario per questa stagione');
        return ok(true);
      case 'MakeOffer':
        if (s.meta.playerTeamId === null) return err('Scegli prima una squadra');
        return this.validateOffer(cmd.riderId, clampOffer(cmd.offer));
      case 'AcceptCounter': {
        if (s.meta.playerTeamId === null) return err('Scegli prima una squadra');
        const n = this.openNegotiation(cmd.riderId);
        const last = n?.rounds.at(-1);
        if (!n || !last?.counter) return err('Nessuna controproposta da accettare');
        return this.validateOffer(cmd.riderId, {
          ...last.offer,
          ...last.counter,
          replaceRiderId: cmd.replaceRiderId,
        });
      }
      case 'WithdrawNegotiation':
        return this.openNegotiation(cmd.riderId)
          ? ok(true)
          : err('Nessuna trattativa aperta con questo pilota');
      case 'RunQualifying': {
        const r = playerRoundToday(s);
        if (!r) return err("Oggi non c'è un Gran Premio");
        return r.status ? err('Qualifiche già disputate') : ok(true);
      }
      case 'RunRace': {
        const r = playerRoundToday(s);
        if (!r) return err("Oggi non c'è un Gran Premio");
        if (r.status === 'raced') return err('Gara già disputata');
        for (const st of Object.values(cmd.strategies)) {
          if (!['soft', 'medium', 'hard'].includes(st.compound)) return err('Mescola non valida');
          if (!['conservative', 'normal', 'attack'].includes(st.mode)) return err('Ritmo non valido');
        }
        return ok(true);
      }
      case 'StartNextSeason':
        return seasonFinished(s) ? ok(true) : err('La stagione non è ancora finita');
    }
  }

  private apply(cmd: Command): void {
    const s = this.stateValue;
    switch (cmd.type) {
      case 'SetPlayerTeam':
        s.meta.playerTeamId = cmd.teamId;
        this.events.emit('PlayerTeamSet', s.meta.currentDay, { teamId: cmd.teamId });
        return;
      case 'CreateTeam': {
        const teamId = createCustomTeam(s, cmd.team, this.ids, this.streams.get('custom-team'));
        s.meta.playerTeamId = teamId;
        this.events.emit('TeamCreated', s.meta.currentDay, { teamId, name: cmd.team.name.trim() });
        this.events.emit('PlayerTeamSet', s.meta.currentDay, { teamId });
        return;
      }
      case 'AdvanceDays':
        this.advanceTo(s.meta.currentDay + cmd.days);
        return;
      case 'ContinueToNextEvent':
        this.advanceTo(this.nextRound()!.startDay);
        return;
      case 'MakeOffer':
        this.handleOffer(cmd.riderId, clampOffer(cmd.offer));
        return;
      case 'AcceptCounter': {
        const last = this.openNegotiation(cmd.riderId)!.rounds.at(-1)!;
        this.handleOffer(cmd.riderId, {
          ...last.offer,
          ...last.counter!,
          replaceRiderId: cmd.replaceRiderId,
        });
        return;
      }
      case 'WithdrawNegotiation':
        this.openNegotiation(cmd.riderId)!.status = 'withdrawn';
        return;
      case 'RunQualifying':
        runQualifyingDay(s, this.ids);
        this.events.emit('QualifyingDone', s.meta.currentDay, { roundId: playerRoundToday(s)!.id });
        return;
      case 'RunRace': {
        const round = playerRoundToday(s)!;
        this.lastReplay = runRaceDay(s, this.ids, this.streams.get('race-ai'), cmd.strategies);
        this.events.emit('RaceDone', s.meta.currentDay, { roundId: round.id, summary: '' });
        return;
      }
      case 'StartNextSeason': {
        const year = startNextSeason(s, this.ids, this.streams.get('season'));
        this.events.emit('SeasonStarted', s.meta.currentDay, { year });
        return;
      }
    }
  }

  /**
   * Rete di sicurezza: se al via di un GP la squadra del giocatore ha un posto vuoto, il direttore sportivo
   * ingaggia il miglior pilota libero che il budget consente (contratto fino a fine anno).
   */
  private fillEmptySeats(): void {
    const s = this.stateValue;
    const teamId = s.meta.playerTeamId;
    const entry = teamId ? rows(s, 'teamEntries').find((e) => e.teamId === teamId) : undefined;
    if (!entry) return;
    for (const seat of entry.seats) {
      if (seat.riderId !== null) continue;
      const id = aiFillVacancy(s, entry.teamId, this.ids, this.streams.get('market-ai'));
      if (!id) continue;
      const r = s.tables.riders[id]!;
      addNews(s, this.ids, {
        day: s.meta.currentDay,
        tag: 'mercato',
        mine: true,
        title: `Posto vuoto: arriva ${r.firstName} ${r.lastName}`,
        body: 'La moto era senza pilota: il direttore sportivo ha ingaggiato il miglior pilota libero disponibile.',
      });
    }
  }

  private raceDue(): boolean {
    const r = playerRoundToday(this.stateValue);
    return !!r && r.status !== 'raced';
  }

  private handleOffer(riderId: string, offer: ContractOffer): void {
    const s = this.stateValue;
    const teamId = s.meta.playerTeamId!;
    const r = s.tables.riders[riderId as `rdr_${string}`]!;
    const c = activeRiderContract(s, r.id);
    let neg = this.openNegotiation(riderId);
    if (!neg) {
      const id = this.ids.next('neg') as NegotiationId;
      neg = {
        id,
        teamId,
        riderId: r.id,
        kind: c?.employerId === teamId ? 'renewal' : 'transfer',
        status: 'open',
        buyout: c?.employerId === teamId ? 0 : buyoutFor(s, c),
        patience: 3,
        startedDay: s.meta.currentDay,
        rounds: [],
      };
      s.tables.negotiations[id] = neg;
    }
    const rng = this.streams.get('market');
    const ev = evaluateOffer(s, r, teamId, offer, neg.patience, rng);
    neg.rounds.push({
      day: s.meta.currentDay,
      offer,
      response: ev.response,
      ...(ev.counter ? { counter: ev.counter } : {}),
      message: ev.message,
    });
    neg.patience -= offer.salary < ev.asking * 0.6 ? 2 : 1;
    this.events.emit('OfferAnswered', s.meta.currentDay, {
      riderId: r.id,
      response: ev.response,
      message: ev.message,
    });
    if (ev.response === 'rejected') {
      neg.status = 'rejected';
      return;
    }
    if (ev.response === 'countered') return;
    neg.status = 'signed';
    const res = executeSigning(s, neg, offer, this.ids, rng);
    this.events.emit('RiderSigned', s.meta.currentDay, {
      riderId: r.id,
      teamId,
      salary: offer.salary,
      years: offer.years,
      kind: neg.kind,
    });
    if (res.releasedRiderId)
      this.events.emit('RiderReleased', s.meta.currentDay, { riderId: res.releasedRiderId, teamId });
    if (res.aiSignedRiderId && res.vacatedTeamId) {
      this.events.emit('AiRiderSigned', s.meta.currentDay, {
        riderId: res.aiSignedRiderId,
        teamId: res.vacatedTeamId,
      });
    }
  }

  /** Avanza giorno per giorno: ogni giorno è il punto in cui i sistemi futuri (economia, mercato…) verranno eseguiti. */
  private advanceTo(target: number): void {
    const s = this.stateValue;
    const from = s.meta.currentDay;
    const rounds = this.playerRounds();
    let reached = target;
    for (let day = from + 1; day <= target; day++) {
      s.meta.currentDay = day;
      monthlyFinance(s, this.ids);
      if (rounds.some((r) => r.startDay === day)) reached = day;
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
      if (reached === day) {
        this.fillEmptySeats();
        break; // ci si ferma al Gran Premio: va corso prima di proseguire
      }
    }
    const to = s.meta.currentDay;
    // Le trattative ancora aperte all'inizio del campionato decadono.
    if (!marketOpen(s))
      for (const n of rows(s, 'negotiations')) if (n.status === 'open') n.status = 'withdrawn';
    this.events.emit('TimeAdvanced', to, { from, to });
  }

  /** Round della categoria in cui corre la squadra del giocatore, in ordine di data. */
  playerRounds(): Round[] {
    const s = this.stateValue;
    const teamId = s.meta.playerTeamId;
    if (!teamId) return [];
    const entry = entryOf(s, teamId);
    if (!entry) return [];
    const season = s.tables.seasons[entry.seasonId]!;
    return season.roundIds.map((id) => s.tables.rounds[id]!).sort((a, b) => a.startDay - b.startDay);
  }

  nextRound(): Round | undefined {
    return this.playerRounds().find((r) => r.startDay > this.stateValue.meta.currentDay);
  }
}
