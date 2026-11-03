/**
 * Motore di gioco puro (nessuna dipendenza da browser o UI). Esegue i comandi sullo stato e
 * registra gli eventi di dominio. Il pacchetto engine-host lo fa girare in un Web Worker.
 */
import {
  EventLog,
  GameCalendar,
  IdFactory,
  RngStreams,
  err,
  ok,
  type DomainEvent,
  type Result,
} from '@lean-angle/core';
import {
  createCustomTeam,
  generateWorld,
  rows,
  teamBalance,
  PART_KEYS,
  GARAGE_KEYS,
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
import {
  type RacePrep,
  type ReplayData,
  completeLiveRace,
  finishOtherRounds,
  nextSession,
  playerRoundToday,
  runNextSession,
  runRestOfWeekend,
  sessionsOf,
  startLiveRace,
  tierOf as tierOfRound,
  tyresLeft,
} from './weekend.ts';
import { SESSION_SHORT, changeMinutes, practiceRider, workMinutesLeft } from './practice.ts';
import { addNews } from './news.ts';
import { aiUpgrades, buyUpgrade, deliverUpgrades, pendingOrder, upgradeCost } from './upgrades.ts';
import { dealWindowOpen, signDeal } from './sponsors.ts';
import {
  buySpare,
  canService,
  groupsFor,
  replaceGroup,
  serviceCost,
  servicePart,
  spareCost,
  sparesOf,
} from './garage.ts';
import { SETUP_KEYS, setupOf } from './setup.ts';

const fmtSigned = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
import { seasonFinished, startNextSeason } from './season.ts';
import { RaceSim, type LiveRider, type RaceEvent, type RaceSnapshot } from '@lean-angle/sim';

export interface NewCareerOptions {
  /** Seme della carriera: gare, meteo, mercato ed eventi. */
  seed: string;
  saveName: string;
  teamId?: TeamId;
  startYear?: number;
  /**
   * Seme dell'universo di partenza (piloti, staff, squadre). Di default è fisso, così ogni nuova carriera parte
   * dagli stessi personaggi, ognuno con il proprio ritratto; i test possono passarne uno diverso.
   */
  worldSeed?: string;
}

/** Universo di partenza condiviso da tutte le carriere. */
export const UNIVERSE_SEED = 'lean-angle-universo-1';

const MAX_ADVANCE_DAYS = 60;
const MAX_SALARY = 30_000_000;

/** Avanzamento della gara in diretta restituito all'interfaccia. */
export interface LiveChunk {
  t: number;
  frames: number[][];
  events: RaceEvent[];
  live: LiveRider[];
  done: boolean;
  /** A gara conclusa: dati completi per rivederla. */
  replay: ReplayData | null;
}

export class GameEngine {
  readonly events = new EventLog<GameEvents>();
  private stateValue: GameState;
  private ids: IdFactory;
  private streams: RngStreams;
  /** Incrementato a ogni modifica: l'interfaccia lo usa per sapere quando rileggere i dati. */
  version = 0;
  /** Dati per rivedere l'ultima gara del giocatore (solo in memoria, non salvati). */
  lastReplay: ReplayData | null = null;
  /** Gara in diretta (simulazione incrementale). Fotografata in `state.liveSession` prima di salvare. */
  private live: { sim: RaceSim; prep: RacePrep } | null = null;

  private constructor(state: GameState) {
    this.stateValue = state;
    this.ids = new IdFactory(state.idCounters);
    this.streams = new RngStreams(state.meta.seed, state.rng);
    // Salvataggio fatto a gara in corso: si riprende esattamente da lì.
    const ls = state.liveSession;
    if (ls) {
      const prep = ls.prep as RacePrep;
      const sim = ls.snapshot
        ? RaceSim.restore(prep.setup, ls.snapshot as RaceSnapshot)
        : new RaceSim(prep.setup);
      this.live = { sim, prep };
      this.lastReplay = this.liveReplay();
    }
  }

  /** La gara in diretta in corso (null se nessuna). */
  get liveRace(): { kind: string; roundId: string; t: number; viewerT: number } | null {
    return this.live
      ? {
          kind: this.live.prep.kind,
          roundId: this.live.prep.roundId,
          t: this.live.sim.t,
          viewerT: this.stateValue.liveSession?.viewerT ?? -45,
        }
      : null;
  }

  private liveReplay(): ReplayData {
    const { sim, prep } = this.live!;
    return { ...prep.meta!, frames: [...sim.frames], events: [...sim.events], results: [] };
  }

  /** Fotografa la gara in corso nello stato (da chiamare prima di salvare). */
  syncLive() {
    if (this.live && this.stateValue.liveSession)
      this.stateValue.liveSession.snapshot = this.live.sim.snapshot();
  }

  /**
   * Avanza la gara in diretta fino all'istante `to` (secondi di gara) e restituisce i nuovi fotogrammi ed
   * eventi dall'indice indicato, con i dati live dei piloti. A bandiera a scacchi la gara si chiude (risultati,
   * punti, notizie) e `done` diventa true con i dati completi per rivederla.
   */
  liveAdvance(to: number, fromFrame: number, fromEvent: number, viewerT?: number): LiveChunk | null {
    if (!this.live) return null;
    const { sim } = this.live;
    sim.advanceTo(to);
    if (viewerT !== undefined && this.stateValue.liveSession) this.stateValue.liveSession.viewerT = viewerT;
    const chunk: LiveChunk = {
      t: sim.t,
      frames: sim.frames.slice(fromFrame),
      events: sim.events.slice(fromEvent),
      live: sim.live(),
      done: sim.done,
      replay: null,
    };
    if (sim.done) {
      chunk.replay = this.completeLive();
      this.version++;
    }
    return chunk;
  }

  private completeLive(): ReplayData | null {
    const { sim, prep } = this.live!;
    const s = this.stateValue;
    const round = s.tables.rounds[prep.roundId as never]!;
    const rep = completeLiveRace(s, this.ids, round, prep, sim.result());
    this.live = null;
    delete s.liveSession;
    if (rep) this.lastReplay = rep;
    if (!nextSession(s, round)) finishOtherRounds(s, this.ids, this.streams.get('race-ai'));
    this.stateValue.idCounters = this.ids.snapshot();
    this.stateValue.rng = this.streams.snapshot();
    this.events.emit('SessionDone', s.meta.currentDay, { roundId: round.id, session: prep.kind });
    return rep;
  }

  static newCareer(opts: NewCareerOptions): GameEngine {
    const state = generateWorld({
      seed: opts.worldSeed ?? UNIVERSE_SEED,
      saveName: opts.saveName,
      ...(opts.startYear ? { startYear: opts.startYear } : {}),
    });
    // Il mondo è quello dell'universo fisso; da qui in poi tutto il caso dipende dal seme della carriera.
    state.meta.seed = opts.seed;
    state.rng = {};
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
    if (this.live) {
      out.push('SetRaceStrategy', 'FinishLiveRace');
    } else if (today && today.status !== 'raced') {
      out.push('RunSession', 'RunRace');
    } else if (seasonFinished(s)) {
      out.push('StartNextSeason');
    } else {
      out.push('AdvanceDays');
      if (this.nextRound()) out.push('ContinueToNextEvent');
    }
    if (marketOpen(s)) out.push('MakeOffer', 'AcceptCounter', 'WithdrawNegotiation');
    out.push('BuyUpgrade', 'ServiceParts', 'SetGarageMode', 'BuySpare', 'ReplaceGroup', 'SetSetup');
    if (dealWindowOpen(s)) out.push('SignSponsorDeal');
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
      case 'SetRaceStrategy': {
        if (!this.live) return err('Nessuna gara in corso');
        const mine = this.live.prep.meta?.riders.find((x) => x.id === cmd.riderId)?.mine;
        if (!mine) return err('Puoi cambiare la strategia solo dei tuoi piloti');
        if (
          cmd.mode &&
          !['veryConservative', 'conservative', 'normal', 'attack', 'maxAttack'].includes(cmd.mode)
        )
          return err('Ritmo non valido');
        if (cmd.fuelMap && !['save', 'standard', 'performance'].includes(cmd.fuelMap))
          return err('Mappa carburante non valida');
        if (cmd.tyreMode && !['conservative', 'balanced', 'performance'].includes(cmd.tyreMode))
          return err('Gestione gomme non valida');
        return ok(true);
      }
      case 'FinishLiveRace':
        return this.live ? ok(true) : err('Nessuna gara in corso');
      case 'RunSession':
      case 'RunRace': {
        if (this.live) return err('Gara in corso: guardala fino alla fine o saltala');
        const r = playerRoundToday(s);
        if (!r) return err("Oggi non c'è un Gran Premio");
        if (!nextSession(s, r)) return err('Weekend già concluso');
        for (const [riderId, st] of Object.entries(cmd.strategies ?? {})) {
          if (!['soft', 'medium', 'hard', 'wet'].includes(st.compound)) return err('Mescola non valida');
          if (!['veryConservative', 'conservative', 'normal', 'attack', 'maxAttack'].includes(st.mode))
            return err('Ritmo non valido');
          if (cmd.type === 'RunSession' && tyresLeft(s, r, riderId)[st.compound] <= 0)
            return err('Non restano gomme nuove di questa mescola');
        }
        return ok(true);
      }
      case 'StartNextSeason':
        return seasonFinished(s) ? ok(true) : err('La stagione non è ancora finita');
      case 'BuyUpgrade': {
        const teamId = s.meta.playerTeamId;
        if (!teamId) return err('Scegli prima una squadra');
        if (!PART_KEYS.includes(cmd.part)) return err('Componente sconosciuto');
        if (pendingOrder(s, teamId, cmd.part)) return err('Questo componente è già in produzione');
        const cost = upgradeCost(s, teamId, cmd.part);
        if (cost === null) return err('Componente già al livello massimo');
        if (cost > teamBalance(s, teamId)) return err('Soldi insufficienti per questo upgrade');
        return ok(true);
      }
      case 'ServiceParts': {
        const b = s.tables.bikes[cmd.bikeId as keyof typeof s.tables.bikes];
        if (!b || b.teamId !== s.meta.playerTeamId) return err('Moto non trovata');
        if (cmd.parts.length === 0) return err('Nessun componente scelto');
        for (const k of cmd.parts) {
          if (!GARAGE_KEYS.includes(k)) return err('Componente sconosciuto');
          if (!canService(s, b, k))
            return err('Il motore MotoGP si cambia solo dalla dotazione del regolamento');
        }
        const total = cmd.parts.reduce((t, k) => t + serviceCost(s, b, k), 0);
        if (total > teamBalance(s, b.teamId)) return err('Soldi insufficienti per la revisione');
        return ok(true);
      }
      case 'SetGarageMode':
        if (!s.meta.playerTeamId) return err('Scegli prima una squadra');
        return ['auto', 'assisted', 'manual'].includes(cmd.mode) ? ok(true) : err('Modalità sconosciuta');
      case 'BuySpare': {
        const teamId = s.meta.playerTeamId;
        if (!teamId) return err('Scegli prima una squadra');
        const cost = spareCost(s, teamId, cmd.group);
        if (cost === null) return err('Gruppo tecnico sconosciuto per questa categoria');
        if (cost > teamBalance(s, teamId)) return err('Soldi insufficienti per il ricambio');
        return ok(true);
      }
      case 'ReplaceGroup': {
        const b = s.tables.bikes[cmd.bikeId as keyof typeof s.tables.bikes];
        if (!b || b.teamId !== s.meta.playerTeamId) return err('Moto non trovata');
        if (!groupsFor(s, b).some((g) => g.key === cmd.group)) return err('Gruppo tecnico sconosciuto');
        if (sparesOf(s, b.teamId, cmd.group) < 1) return err('Nessun ricambio in magazzino: ordinalo prima');
        return ok(true);
      }
      case 'SetSetup': {
        const r = s.tables.riders[cmd.riderId as keyof typeof s.tables.riders];
        const entry = rows(s, 'teamEntries').find(
          (e) => e.teamId === s.meta.playerTeamId && e.seats.some((x) => x.riderId === cmd.riderId),
        );
        if (!r || !entry) return err('Pilota non della tua squadra');
        const allowed = SETUP_KEYS[s.tables.categories[entry.categoryId]!.tier].map((k) => k.key);
        for (const [k, v] of Object.entries(cmd.values)) {
          if (!allowed.includes(k)) return err('Regolazione non consentita in questa categoria');
          if (!Number.isInteger(v) || v < -5 || v > 5) return err('Valore fuori scala (da −5 a +5)');
        }
        // Durante il weekend il tempo per le modifiche fra una sessione e l'altra è limitato.
        const round = playerRoundToday(s);
        const left = workMinutesLeft(s, round, cmd.riderId);
        if (left !== null) {
          const need = changeMinutes(
            s,
            cmd.riderId,
            setupOf(s, cmd.riderId, cmd.condition === 'wet'),
            cmd.values,
          );
          if (need > left)
            return err(
              `Tempo insufficiente: servono ${need} minuti di lavoro, ne restano ${Math.max(0, left)} prima della prossima sessione`,
            );
        }
        return ok(true);
      }
      case 'SignSponsorDeal':
        if (!['safe', 'balanced', 'ambitious'].includes(cmd.risk)) return err('Offerta non valida');
        return dealWindowOpen(s)
          ? ok(true)
          : err('Lo sponsor si sceglie prima del primo Gran Premio, una volta a stagione');
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
      case 'SetRaceStrategy': {
        const change = {
          ...(cmd.mode ? { mode: cmd.mode } : {}),
          ...(cmd.fuelMap ? { fuelMap: cmd.fuelMap } : {}),
          ...(cmd.tyreMode ? { tyreMode: cmd.tyreMode } : {}),
        };
        this.live!.sim.setStrategy(cmd.riderId, change);
        this.events.emit('RaceStrategyChanged', s.meta.currentDay, { riderId: cmd.riderId });
        return;
      }
      case 'FinishLiveRace':
        this.live!.sim.runToEnd();
        this.completeLive();
        return;
      case 'RunSession': {
        const round = playerRoundToday(s)!;
        const session = nextSession(s, round)!;
        const rng = this.streams.get('race-ai');
        if (cmd.live && (session === 'sprint' || session === 'race')) {
          const prep = startLiveRace(s, this.ids, rng, round, cmd.strategies ?? {});
          if (prep?.meta) {
            this.live = { sim: new RaceSim(prep.setup), prep };
            s.liveSession = { prep, snapshot: null, viewerT: -45 };
            this.lastReplay = this.liveReplay();
            this.events.emit('LiveRaceStarted', s.meta.currentDay, { roundId: round.id, kind: session });
            return;
          }
        }
        const rep = runNextSession(s, this.ids, rng, round, cmd.strategies ?? {});
        if (rep) this.lastReplay = rep;
        if (!nextSession(s, round)) finishOtherRounds(s, this.ids, rng);
        this.events.emit('SessionDone', s.meta.currentDay, { roundId: round.id, session });
        return;
      }
      case 'RunRace': {
        const round = playerRoundToday(s)!;
        const rng = this.streams.get('race-ai');
        const rep = runRestOfWeekend(s, this.ids, rng, round, cmd.strategies);
        if (rep) this.lastReplay = rep;
        finishOtherRounds(s, this.ids, rng);
        this.events.emit('RaceDone', s.meta.currentDay, { roundId: round.id, summary: '' });
        return;
      }
      case 'StartNextSeason': {
        const year = startNextSeason(s, this.ids, this.streams.get('season'));
        this.events.emit('SeasonStarted', s.meta.currentDay, { year });
        return;
      }
      case 'BuyUpgrade':
        buyUpgrade(s, this.ids, s.meta.playerTeamId!, cmd.part);
        this.events.emit('UpgradeBought', s.meta.currentDay, {
          part: cmd.part,
          level: pendingOrder(s, s.meta.playerTeamId!, cmd.part)!.level,
        });
        return;
      case 'ServiceParts': {
        const b = s.tables.bikes[cmd.bikeId as keyof typeof s.tables.bikes]!;
        const cost = [...new Set(cmd.parts)].reduce((t, k) => t + servicePart(s, this.ids, b, k), 0);
        this.events.emit('PartsServiced', s.meta.currentDay, { bikeId: b.id, parts: cmd.parts, cost });
        return;
      }
      case 'SetGarageMode':
        s.garageMode = { ...(s.garageMode ?? {}), [s.meta.playerTeamId!]: cmd.mode };
        this.events.emit('GarageModeSet', s.meta.currentDay, { mode: cmd.mode });
        return;
      case 'BuySpare': {
        const cost = buySpare(s, this.ids, s.meta.playerTeamId!, cmd.group);
        this.events.emit('SpareBought', s.meta.currentDay, { group: cmd.group, cost });
        return;
      }
      case 'ReplaceGroup':
        replaceGroup(s, s.tables.bikes[cmd.bikeId as keyof typeof s.tables.bikes]!, cmd.group);
        this.events.emit('GroupReplaced', s.meta.currentDay, { bikeId: cmd.bikeId, group: cmd.group });
        return;
      case 'SetSetup': {
        s.setups = s.setups ?? {};
        const cur = s.setups[cmd.riderId] ?? { dry: {}, wet: {} };
        const round = playerRoundToday(s);
        const rider = s.tables.riders[cmd.riderId as keyof typeof s.tables.riders]!;
        if (round && workMinutesLeft(s, round, cmd.riderId) !== null) {
          const before = { ...cur[cmd.condition] };
          const minutes = changeMinutes(s, cmd.riderId, before, cmd.values);
          const pr = practiceRider(s, round, rider);
          pr.minutesUsed += minutes;
          const tier = tierOfRound(s, round);
          const names = Object.fromEntries(SETUP_KEYS[tier].map((k) => [k.key, k.name]));
          const changes = Object.entries(cmd.values)
            .filter(([k, v]) => (before[k] ?? 0) !== v)
            .map(([k, v]) => `${names[k] ?? k} ${fmtSigned(before[k] ?? 0)} → ${fmtSigned(v)}`);
          if (changes.length > 0)
            pr.log.push({
              session: SESSION_SHORT[sessionsOf(s, round)[(round.stage ?? 1) - 1]!] ?? '',
              kind: 'change',
              text: `${cmd.condition === 'wet' ? 'Bagnato: ' : ''}${changes.join(', ')}`,
              minutes,
            });
        }
        s.setups[cmd.riderId] = { ...cur, [cmd.condition]: { ...cur[cmd.condition], ...cmd.values } };
        this.events.emit('SetupChanged', s.meta.currentDay, {
          riderId: cmd.riderId,
          condition: cmd.condition,
        });
        return;
      }
      case 'SignSponsorDeal':
        signDeal(s, this.ids, cmd.risk);
        this.events.emit('SponsorSigned', s.meta.currentDay, { risk: cmd.risk });
        return;
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
      deliverUpgrades(s, this.ids);
      if (new GameCalendar(s.meta.startYear).toDate(day).day === 1)
        aiUpgrades(s, this.ids, this.streams.get('ai-upgrades'));
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
