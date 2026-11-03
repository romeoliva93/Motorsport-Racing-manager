/**
 * Qualifiche e gara (SIMULATION.md, versione giocabile di Fase 2).
 *
 * Ogni pilota ha un tempo sul giro di base che dipende da abilità e moto; a ogni giro si aggiungono
 * gomme (mescola e usura), carburante, ritmo scelto e un errore casuale legato alla costanza.
 * La posizione in pista avanza con il profilo di velocità del tracciato. Chi raggiunge un avversario più
 * lento resta in scia finché non riesce un sorpasso (più facile sui rettilinei e in staccata, in base a
 * Sorpassi contro Difesa). Errori, cadute e guasti seguono probabilità per giro e per gara.
 *
 * Formule:
 *   prestazione  = 0,6 × abilità pilota + 0,4 × moto
 *   giro base    = giro di riferimento × (1 + 0,0006 × (92 − prestazione)) × (1 + forma del giorno),
 *                  forma del giorno ~ N(0; 0,35%) diversa per ogni pilota e ogni sessione
 *   giro         = giro base × (1 + gomma(età, mescola) + carburante + ritmo + N(0, σ)),  σ = 0,25% × (1,2 − costanza)
 *   gomma        = base(mescola) + deg(mescola) × 14/(giri−1) × età × ritmo.deg × (1,3 − 0,6 × gestione gomme)
 *   caduta/giro  = 0,0025 × ritmo × (1,3 − concentrazione) × (1 + aggressività/2)
 */
import { Rng, clamp } from '@lean-angle/core';
import { LONG_LAP_SPAN, type TrackShape } from './track.ts';

export type Compound = 'soft' | 'medium' | 'hard' | 'wet';
/** Condizione dell'asfalto: asciutto, umido (pioggerella o pista che si asciuga), bagnato. */
export type Grip = 'dry' | 'damp' | 'wet';
export interface Conditions {
  grip: Grip;
  /** Temperatura dell'asfalto in °C. */
  trackTemp: number;
}
export const DRY: Conditions = { grip: 'dry', trackTemp: 35 };
/** Ritmo del pilota: molto conservativo, conservativo, normale, aggressivo, attacco massimo. */
export type PaceMode = 'veryConservative' | 'conservative' | 'normal' | 'attack' | 'maxAttack';
/** Mappa del carburante: risparmio, standard, prestazione. */
export type FuelMap = 'save' | 'standard' | 'performance';
/** Gestione delle gomme: conservativa, bilanciata, prestazionale. */
export type TyreMode = 'conservative' | 'balanced' | 'performance';
export interface RaceStrategy {
  mode: PaceMode;
  fuelMap: FuelMap;
  tyreMode: TyreMode;
}

export interface RaceRider {
  id: string;
  /** Valori 0–1. */
  skill: number;
  overtaking: number;
  defending: number;
  consistency: number;
  concentration: number;
  aggression: number;
  tyreManagement: number;
  /** 0–1: qualità complessiva della moto. */
  bike: number;
  /** 0–1: affidabilità della moto. */
  reliability: number;
  compound: Compound;
  mode: PaceMode;
  /** Mappa carburante e gestione gomme (default: standard, bilanciata). */
  fuelMap?: FuelMap;
  tyreMode?: TyreMode;
  /** 0–1: preparazione fisica (fatica) e gestione del carburante (consumi). Default 0,7 e 0,5. */
  fitness?: number;
  fuelManagement?: number;
  /** Strategia decisa dal giocatore: l'IA non la cambia. */
  manual?: boolean;
  /** Parte dalla corsia box (es. troppi motori usati): dietro a tutti, quando il gruppo è passato. */
  pitLaneStart?: boolean;
}

export interface RaceSetup {
  seed: string;
  track: TrackShape;
  lengthM: number;
  laps: number;
  /** Tempo sul giro di riferimento (s) per un pilota con prestazione 92. */
  refLap: number;
  grid: RaceRider[];
  /** Intervallo dei fotogrammi registrati per la vista 2D (s). */
  frameEvery?: number;
  /** Meteo e asfalto (default: asciutto, 35 °C). */
  conditions?: Conditions;
  /** Gara Sprint: soglia dei limiti della pista più bassa. */
  sprint?: boolean;
  /** Carburante: capienza (litri) e consumo per giro a ritmo normale e mappa standard. */
  fuel?: { capacity: number; perLap: number; start: number };
}

export interface RaceEvent {
  t: number;
  lap: number;
  kind:
    | 'overtake'
    | 'crash'
    | 'remount'
    | 'mechanical'
    | 'fastestLap'
    | 'finish'
    | 'trackLimits'
    | 'longLapPenalty'
    | 'longLap'
    | 'jumpStart'
    | 'contact'
    | 'positionDrop'
    | 'yellowFlag'
    | 'redFlag'
    | 'restart'
    | 'strategy'
    | 'fuelOut';
  riderId: string;
  otherId?: string;
  /** trackLimits: numero di infrazioni; longLapPenalty: quante Long Lap (1 o 2). */
  count?: number;
  /** longLapPenalty: motivo. */
  reason?: 'trackLimits' | 'jumpStart' | 'contact';
  /** longLap: durata del passaggio nell'anello (s); yellowFlag: durata della zona gialla. */
  duration?: number;
  /** yellowFlag: punto del giro (0–1) dove sventola la bandiera. */
  at?: number;
  /** redFlag: true = gara conclusa (≥ 2/3 della distanza), false = nuova partenza. */
  final?: boolean;
  /** strategy: nuova strategia del pilota (comando del giocatore). */
  strategy?: RaceStrategy;
}

export interface RacePenalty {
  /** Long Lap ricevute e scontate in pista. */
  longLaps: number;
  served: number;
  /** Secondi aggiunti per Long Lap non scontate in tempo. */
  timeAdded: number;
  /** Posizione persa per i limiti della pista all'ultimo giro. */
  positionDrop: boolean;
}

export interface RaceResultRow {
  riderId: string;
  position: number | null;
  status: 'finished' | 'dnf';
  laps: number;
  time: number | null;
  gap: number | null;
  bestLap: number;
  reason?: 'crash' | 'mechanical' | 'fuel';
  penalty?: RacePenalty;
}

export interface RaceOutcome {
  results: RaceResultRow[];
  events: RaceEvent[];
  fastestLap: { riderId: string; time: number };
  /** Fotogrammi: distanza percorsa (m) da ogni pilota, nell'ordine della griglia; -1 = ritirato. */
  frames: number[][];
  frameEvery: number;
  duration: number;
  /**
   * Per ogni pilota (ordine di griglia): tempo di ogni giro concluso e usura della gomma a fine giro (0–100).
   * Usura = perdita di tempo per degrado gomma / 2% del giro (100 = gomma finita).
   */
  laps: { times: number[]; wear: number[] }[];
}

/**
 * Gomme. `base` = differenza di passo a gomma nuova; `deg` = perdita per ogni giro di età (gara da 15 giri).
 * Bilanciamento (gara da 15 giri, consumo medio f = 0,88): le tre mescole finiscono entro ~1 s l'una
 * dall'altra; la media è la migliore per un pilota medio, la morbida per chi gestisce bene le gomme (f < 0,8),
 * la dura per chi le consuma molto o attacca (f > 1,0). Vedi `compoundForecast`.
 */
const TYRE: Record<Compound, { base: number; deg: number }> = {
  soft: { base: -0.006, deg: 0.0017 },
  medium: { base: 0, deg: 0.00063 },
  hard: { base: 0.003, deg: 0.0002 },
  wet: { base: 0, deg: 0.0006 },
};

/**
 * Effetto della pioggia: secondi in più (frazione del giro) per gomme slick e da bagnato, moltiplicatore del
 * consumo delle gomme da bagnato (sull'asciutto si distruggono) e del rischio di caduta.
 *   asciutto: slick +0%,  rain +7% (consumo ×3)
 *   umido:    slick +4%,  rain +3,5% (consumo ×1,6)   rischio caduta ×1,7
 *   bagnato:  slick +16%, rain +7%                    rischio caduta ×2,2 (×2,5 in più con le slick)
 */
const GRIP: Record<Grip, { slick: number; wet: number; wetDeg: number; crash: number; slickCrash: number }> =
  {
    dry: { slick: 0, wet: 0.07, wetDeg: 3, crash: 1, slickCrash: 1 },
    damp: { slick: 0.04, wet: 0.035, wetDeg: 1.6, crash: 1.7, slickCrash: 1.3 },
    wet: { slick: 0.16, wet: 0.07, wetDeg: 1, crash: 2.2, slickCrash: 2.5 },
  };

/**
 * Temperatura dell'asfalto: le slick si consumano di più sull'asfalto caldo (+1,2% per grado sopra 35 °C) e
 * meno sul freddo, entro 0,75–1,4.
 */
export const heatFactor = (trackTemp: number) => Math.min(1.4, Math.max(0.75, 1 + (trackTemp - 35) * 0.012));

/** Passo (frazione del giro) e consumo per giro di una mescola nelle condizioni date. */
function tyreModel(c: Compound, cond: Conditions): { base: number; deg: number } {
  const g = GRIP[cond.grip];
  if (c === 'wet') return { base: g.wet, deg: TYRE.wet.deg * g.wetDeg };
  return { base: TYRE[c].base + g.slick, deg: TYRE[c].deg * heatFactor(cond.trackTemp) };
}
export const crashFactor = (c: Compound, cond: Conditions) =>
  GRIP[cond.grip].crash * (c !== 'wet' ? GRIP[cond.grip].slickCrash : 1);
/**
 * Ritmo: passo (frazione del giro, − = più veloce), rischio di caduta, consumo gomme, limiti della pista, fatica,
 * consumo di carburante, aggressività nei sorpassi, calore in gomma (°C).
 */
export const MODE: Record<
  PaceMode,
  {
    pace: number;
    crash: number;
    deg: number;
    tl: number;
    fatigue: number;
    fuel: number;
    overtake: number;
    heat: number;
  }
> = {
  veryConservative: {
    pace: 0.009,
    crash: 0.3,
    deg: 0.75,
    tl: 0.25,
    fatigue: 0.7,
    fuel: 0.93,
    overtake: 0.7,
    heat: -9,
  },
  conservative: {
    pace: 0.005,
    crash: 0.5,
    deg: 0.85,
    tl: 0.4,
    fatigue: 0.85,
    fuel: 0.96,
    overtake: 0.85,
    heat: -5,
  },
  normal: { pace: 0, crash: 1, deg: 1, tl: 1, fatigue: 1, fuel: 1, overtake: 1, heat: 0 },
  attack: { pace: -0.004, crash: 2, deg: 1.3, tl: 2, fatigue: 1.2, fuel: 1.04, overtake: 1.4, heat: 6 },
  maxAttack: {
    pace: -0.0065,
    crash: 3.2,
    deg: 1.6,
    tl: 3,
    fatigue: 1.45,
    fuel: 1.08,
    overtake: 1.7,
    heat: 10,
  },
};
/** Mappa carburante: passo e consumo. */
export const FUEL_MAP: Record<FuelMap, { pace: number; use: number }> = {
  save: { pace: 0.004, use: 0.86 },
  standard: { pace: 0, use: 1 },
  performance: { pace: -0.003, use: 1.12 },
};
/** Gestione gomme: passo, consumo, temperatura (°C). */
export const TYRE_MODE: Record<TyreMode, { pace: number; deg: number; heat: number }> = {
  conservative: { pace: 0.003, deg: 0.8, heat: -8 },
  balanced: { pace: 0, deg: 1, heat: 0 },
  performance: { pace: -0.0025, deg: 1.25, heat: 8 },
};

/**
 * Il consumo per giro si scala con la lunghezza della gara (14 / (giri − 1)): su ogni distanza le gomme arrivano
 * a fine gara con lo stesso grado di usura, così l'equilibrio fra mescole non dipende dal numero di giri.
 */
export const degScale = (laps: number) => 14 / Math.max(1, laps - 1);

/** Fattore di consumo del pilota: (1,3 − 0,6 × gestione gomme) × ritmo (prudente 0,85, normale 1, attacco 1,3). */
export const wearFactor = (tyreManagement: number, mode: PaceMode) =>
  MODE[mode].deg * (1.3 - 0.6 * tyreManagement);

/**
 * Previsione: tempo perso (in giri equivalenti × 100) da ciascuna mescola su tutta la gara, a parità di tutto il
 * resto. Più basso = meglio. Usata dall'ingegnere per il consiglio e dall'IA per scegliere.
 */
export function compoundForecast(
  tyreManagement: number,
  mode: PaceMode,
  laps: number,
  cond: Conditions = DRY,
): Record<Compound, number> {
  const f = wearFactor(tyreManagement, mode) * degScale(laps);
  const sumAge = (laps * (laps - 1)) / 2;
  const out = {} as Record<Compound, number>;
  for (const c of ['soft', 'medium', 'hard', 'wet'] as Compound[]) {
    const t = tyreModel(c, cond);
    out[c] = 100 * (t.base * laps + t.deg * f * sumAge);
  }
  return out;
}

export const performance = (r: Pick<RaceRider, 'skill' | 'bike'>) => 100 * (0.6 * r.skill + 0.4 * r.bike);
export const baseLap = (refLap: number, r: Pick<RaceRider, 'skill' | 'bike'>) =>
  refLap * (1 + 0.0006 * (92 - performance(r)));

// ---------------------------------------------------------------------------------------------
export interface QualifyingRow {
  riderId: string;
  best: number;
  position: number;
}

/** Sessione a tempo: tre giri lanciati per pilota con la gomma scelta (`compound`), vale il migliore. */
export function runQualifying(
  seed: string,
  refLap: number,
  riders: RaceRider[],
  cond: Conditions = DRY,
): QualifyingRow[] {
  const rng = Rng.fromSeed(`${seed}::quali`);
  const times = riders.map((r) => {
    const base = baseLap(refLap, r) * (1 + tyreModel(r.compound, cond).base + rng.normal(0, 0.0035));
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const err = rng.chance(0.08 * (1.3 - r.consistency)) ? rng.range(0.004, 0.02) : 0;
      best = Math.min(best, base * (1 + rng.normal(0, 0.0028 * (1.2 - r.consistency)) + err));
    }
    return { riderId: r.id, best: Math.round(best * 1000) / 1000 };
  });
  return times.sort((a, b) => a.best - b.best).map((x, i) => ({ ...x, position: i + 1 }));
}

// ---------------------------------------------------------------------------------------------
interface State {
  r: RaceRider;
  dist: number;
  lap: number;
  lapStart: number;
  lapTime: number;
  best: number;
  out: boolean;
  reason?: 'crash' | 'mechanical' | 'fuel';
  finished: boolean;
  finishTime: number;
  blockedFor: number;
  mechLap: number | null;
  form: number;
  /** Limiti della pista e Long Lap Penalty. */
  tl: number;
  llp: number;
  llpTotal: number;
  llpServed: number;
  llpFrom: number;
  serving: number;
  servingRate: number;
  lastLapTL: boolean;
  /** Fermo fino a questo istante (partenza dai box, bandiera rossa). */
  holdUntil: number;
  lapTimes: number[];
  wear: number[];
  /** Giri della gomma montata (si azzera alla ripartenza dopo la bandiera rossa). */
  tyreFrom: number;
  /** Carburante residuo (litri), fatica (0–100), temperatura gomma (°C), usura gomma accumulata (frazione). */
  fuel: number;
  fatigue: number;
  tyreTemp: number;
  tyreLoss: number;
}

/** Dati live di un pilota per l'interfaccia (strategia attuale e valori della simulazione). */
export interface LiveRider {
  id: string;
  mode: PaceMode;
  fuelMap: FuelMap;
  tyreMode: TyreMode;
  fuel: number;
  fuelLapsLeft: number;
  tyreWear: number;
  tyreTemp: number;
  fatigue: number;
  lap: number;
  lastLap: number | null;
  bestLap: number | null;
  out: boolean;
  finished: boolean;
}

/**
 * Bandiere (regolamento MotoGP, versione di gioco):
 *  - gialla: dopo una caduta, divieto di sorpasso per 25 s nel tratto (±3% del giro) dove sono i commissari;
 *  - rossa: due cadute entro 15 s fermano la gara nell'80% dei casi, una caduta singola nel 9% (barriere
 *    danneggiate, moto in pista). Con almeno 2/3 dei giri completati dal leader la
 *    gara finisce e vale l'ordine al momento dell'interruzione; altrimenti nuova partenza da fermo per i giri
 *    rimanenti, griglia nell'ordine di gara, gomme nuove, dopo 40 s di sosta.
 */
const YELLOW_TIME = 25;
const YELLOW_SPAN = 0.03;

/**
 * Long Lap Penalty (regolamento MotoGP, versione di gioco):
 *  - limiti della pista: Long Lap alla 3ª infrazione nella Sprint, alla 5ª in gara (avviso alla 3ª), tutte le
 *    categorie; probabilità per giro = 4,2% × ritmo.tl × (1,35 − concentrazione) × (1 + aggressività/2) × 1,4
 *    sul bagnato;
 *  - partenza anticipata: doppia Long Lap; contatto in sorpasso: una Long Lap;
 *  - va scontata entro 3 giri passando nell'anello all'esterno della curva indicata: si perde
 *    LONG_LAP_LOSS × giro di riferimento (≈ 2,6 s su 2 minuti); una per giro se doppia;
 *  - se non c'è più tempo, ogni Long Lap rimasta diventa una penalità in secondi di pari durata;
 *  - oltre i limiti all'ultimo giro guadagnandoci (≈ 1 infrazione su 3): una posizione in meno.
 */
export const LONG_LAP_LOSS = 0.022;

/** Passo della simulazione (s). I comandi del giocatore si applicano al confine di un passo. */
export const RACE_DT = 0.25;

const INF = 1e12;
const finite = (x: number) => (Number.isFinite(x) ? x : x > 0 ? INF : -INF);

/** Fotografia serializzabile della gara in corso (salvataggio a metà gara). */
export interface RaceSnapshot {
  version: 1;
  rng: { state: readonly [number, number, number, number]; spare: number | null };
  st: State[];
  yellow: { at: number; until: number }[];
  lastCrash: number;
  redFlagged: boolean;
  fastest: { riderId: string; time: number };
  frames: number[][];
  events: RaceEvent[];
  t: number;
  nextFrame: number;
  leaderDone: boolean;
  done: boolean;
}

/**
 * Gara simulata a passi (RACE_DT). Determinismo: stesso setup + stessi comandi agli stessi istanti = stessa gara;
 * `snapshot()` / `RaceSim.restore()` riprendono esattamente dallo stesso punto (anche il generatore casuale).
 * Strategie modificabili in corsa (`setStrategy`): ritmo, mappa carburante, gestione gomme. I piloti non
 * `manual` le cambiano da soli giro per giro (IA, stesse leve del giocatore).
 */
export class RaceSim {
  readonly setup: RaceSetup;
  private rng: Rng;
  private st: State[];
  private yellow: { at: number; until: number }[] = [];
  private lastCrash = -INF;
  private redFlagged = false;
  private fastest = { riderId: '', time: INF };
  readonly frames: number[][] = [];
  readonly events: RaceEvent[] = [];
  t = 0;
  private nextFrame = 0;
  private leaderDone = false;
  done = false;
  private readonly L: number;
  private readonly laps: number;
  private readonly cond: Conditions;
  private readonly N: number;
  private readonly frameEvery: number;
  private readonly llLoss: number;
  private readonly llEntry: number;
  private readonly llSeg: number;
  private readonly tlLimit: number;
  private readonly fuelCfg: { capacity: number; perLap: number; start: number };

  constructor(setup: RaceSetup, snap?: RaceSnapshot) {
    this.setup = setup;
    this.L = setup.lengthM;
    this.laps = setup.laps;
    this.cond = setup.conditions ?? DRY;
    this.N = setup.track.points.length;
    this.frameEvery = setup.frameEvery ?? 0.5;
    this.llLoss = setup.refLap * LONG_LAP_LOSS;
    this.llEntry = ((setup.track.longLap - LONG_LAP_SPAN + this.N) % this.N) / this.N;
    this.llSeg = ((2 * LONG_LAP_SPAN) / this.N) * this.L;
    this.tlLimit = setup.sprint ? 3 : 5;
    this.fuelCfg = setup.fuel ?? { capacity: 22, perLap: (22 * 0.94) / setup.laps, start: 22 };
    if (snap) {
      this.rng = Rng.restore(snap.rng);
      this.st = snap.st.map((x) => ({ ...x, best: x.best >= INF ? Infinity : x.best }));
      this.yellow = snap.yellow;
      this.lastCrash = snap.lastCrash;
      this.redFlagged = snap.redFlagged;
      this.fastest = snap.fastest;
      this.frames.push(...snap.frames);
      this.events.push(...snap.events);
      this.t = snap.t;
      this.nextFrame = snap.nextFrame;
      this.leaderDone = snap.leaderDone;
      this.done = snap.done;
      return;
    }
    const rng = (this.rng = Rng.fromSeed(`${setup.seed}::race`));
    const laps = this.laps;
    this.st = setup.grid.map((r, i) => ({
      r: { fuelMap: 'standard', tyreMode: 'balanced', ...r },
      form: rng.normal(0, 0.0035),
      dist: r.pitLaneStart ? -setup.grid.length * 9 - 30 : -i * 9 - 2, // griglia sfalsata o corsia box
      lap: 0,
      lapStart: 0,
      lapTime: 0,
      best: Infinity,
      out: false,
      finished: false,
      finishTime: 0,
      blockedFor: 0,
      mechLap: rng.chance(0.03 * (1.4 - r.reliability)) ? rng.int(1, laps) : null,
      tl: 0,
      llp: 0,
      llpTotal: 0,
      llpServed: 0,
      llpFrom: 1,
      serving: 0,
      servingRate: 0,
      lastLapTL: false,
      holdUntil: r.pitLaneStart ? 6 : 0,
      tyreFrom: 0,
      lapTimes: [],
      wear: [],
      fuel: this.fuelCfg.start,
      fatigue: 0,
      tyreTemp: 0,
      tyreLoss: 0,
    }));
    // Partenza anticipata.
    for (const s of this.st)
      if (rng.chance(0.0015 * (1.3 - s.r.concentration) * (1 + s.r.aggression))) {
        this.events.push({ t: 0, lap: 1, kind: 'jumpStart', riderId: s.r.id });
        this.givePenalty(s, 2, 'jumpStart', 0);
      }
    for (const s of this.st) {
      s.tyreTemp = this.tyreTempOf(s);
      s.lapTime = this.lapTimeFor(s) * 1.06; // primo giro con partenza da fermo
    }
    this.recordFrame();
  }

  static restore(setup: RaceSetup, snap: RaceSnapshot): RaceSim {
    return new RaceSim(setup, snap);
  }

  snapshot(): RaceSnapshot {
    return JSON.parse(
      JSON.stringify({
        version: 1,
        rng: this.rng.snapshot(),
        st: this.st.map((x) => ({ ...x, best: finite(x.best) })),
        yellow: this.yellow,
        lastCrash: finite(this.lastCrash),
        redFlagged: this.redFlagged,
        fastest: { ...this.fastest, time: finite(this.fastest.time) },
        frames: this.frames,
        events: this.events,
        t: this.t,
        nextFrame: this.nextFrame,
        leaderDone: this.leaderDone,
        done: this.done,
      }),
    ) as RaceSnapshot;
  }

  /** Cambia la strategia di un pilota da questo istante: vale per i prossimi passi della simulazione. */
  setStrategy(riderId: string, change: Partial<RaceStrategy>, manual = true) {
    const s = this.st.find((x) => x.r.id === riderId);
    if (!s || s.out || s.finished) return false;
    Object.assign(s.r, change);
    if (manual) s.r.manual = true;
    s.tyreTemp = this.tyreTempOf(s);
    // Il giro in corso si adegua subito per la parte che resta.
    s.lapTime = this.lapTimeFor(s);
    if (manual)
      this.events.push({
        t: this.t,
        lap: s.lap + 1,
        kind: 'strategy',
        riderId,
        strategy: { mode: s.r.mode, fuelMap: s.r.fuelMap!, tyreMode: s.r.tyreMode! },
      });
    return true;
  }

  strategyOf(riderId: string): RaceStrategy | null {
    const s = this.st.find((x) => x.r.id === riderId);
    return s ? { mode: s.r.mode, fuelMap: s.r.fuelMap!, tyreMode: s.r.tyreMode! } : null;
  }

  live(): LiveRider[] {
    return this.st.map((s) => {
      const use = this.fuelUse(s);
      return {
        id: s.r.id,
        mode: s.r.mode,
        fuelMap: s.r.fuelMap!,
        tyreMode: s.r.tyreMode!,
        fuel: Math.round(s.fuel * 10) / 10,
        fuelLapsLeft: Math.round((s.fuel / use) * 10) / 10,
        tyreWear: Math.round(Math.min(100, (s.tyreLoss / 0.02) * 100)),
        tyreTemp: Math.round(s.tyreTemp),
        fatigue: Math.round(s.fatigue),
        lap: s.lap,
        lastLap: s.lapTimes.length > 1 ? s.lapTimes.at(-1)! : null,
        bestLap: Number.isFinite(s.best) && s.best < INF && s.lap > 1 ? Math.round(s.best * 1000) / 1000 : null,
        out: s.out,
        finished: s.finished,
      };
    });
  }

  /** Avanza fino all'istante `time` (o alla fine). */
  advanceTo(time: number) {
    while (!this.done && this.t < time) this.step();
  }

  runToEnd() {
    while (!this.done) this.step();
  }

  // ---- modello ----------------------------------------------------------------------------------
  private fuelUse(s: State) {
    const fm = s.r.fuelManagement ?? 0.5;
    return this.fuelCfg.perLap * MODE[s.r.mode].fuel * FUEL_MAP[s.r.fuelMap!].use * (1.1 - 0.2 * fm);
  }
  private tyreTempOf(s: State) {
    if (s.r.compound === 'wet') return 60 + MODE[s.r.mode].heat / 2;
    return 90 + (this.cond.trackTemp - 35) * 0.6 + MODE[s.r.mode].heat + TYRE_MODE[s.r.tyreMode!].heat;
  }
  /** Consumo della gomma per giro (frazione del giro). */
  private degPerLap(s: State) {
    const t = tyreModel(s.r.compound, this.cond);
    const hot = Math.max(0, s.tyreTemp - 105) * 0.02;
    return (
      t.deg *
      degScale(this.laps) *
      MODE[s.r.mode].deg *
      TYRE_MODE[s.r.tyreMode!].deg *
      (1 + hot) *
      (1.3 - 0.6 * s.r.tyreManagement)
    );
  }
  private lapTimeFor(s: State) {
    const r = s.r;
    const t = tyreModel(r.compound, this.cond);
    const cold = s.tyreTemp < 85 && r.compound !== 'wet' ? (85 - s.tyreTemp) * 0.0004 : 0;
    const tyre = t.base + s.tyreLoss + cold;
    const fuel = 0.004 * (s.fuel / this.fuelCfg.capacity);
    const strategy = MODE[r.mode].pace + FUEL_MAP[r.fuelMap!].pace + TYRE_MODE[r.tyreMode!].pace;
    const tired = s.fatigue * 0.00004;
    const noise = this.rng.normal(0, 0.0025 * (1.2 - r.consistency) * (1 + s.fatigue / 150));
    const dry = s.fuel <= 0 ? 0.06 : 0;
    return baseLap(this.setup.refLap, r) * (1 + tyre + fuel + strategy + tired + noise + s.form + dry);
  }

  private givePenalty(s: State, n: number, reason: 'trackLimits' | 'jumpStart' | 'contact', at: number) {
    s.llp += n;
    s.llpTotal += n;
    s.llpFrom = Math.max(1, s.lap + 1);
    this.events.push({ t: at, lap: s.lap + 1, kind: 'longLapPenalty', riderId: s.r.id, count: n, reason });
  }
  private inYellow(dist: number, now: number) {
    const L = this.L;
    const f = (((dist % L) + L) % L) / L;
    return this.yellow.some(
      (y) => y.until > now && Math.min(Math.abs(f - y.at), 1 - Math.abs(f - y.at)) < YELLOW_SPAN,
    );
  }
  private raiseYellow(s: State, now: number) {
    const L = this.L;
    const at = (((s.dist % L) + L) % L) / L;
    this.yellow.push({ at, until: now + YELLOW_TIME });
    this.events.push({
      t: now,
      lap: s.lap + 1,
      kind: 'yellowFlag',
      riderId: s.r.id,
      at,
      duration: YELLOW_TIME,
    });
  }
  private redFlag(now: number) {
    const L = this.L,
      laps = this.laps;
    const running = this.st.filter((s) => !s.out && !s.finished).sort((a, b) => b.dist - a.dist);
    if (running.length === 0) return;
    const leadLaps = Math.floor(running[0]!.dist / L);
    if (leadLaps >= Math.ceil((laps * 2) / 3)) {
      // Gara conclusa: vale l'ordine al momento dell'interruzione.
      const v = L / this.setup.refLap;
      running.forEach((s) => {
        s.finished = true;
        s.lap = laps; // gara dichiarata conclusa: classifica valida
        s.finishTime = now + (running[0]!.dist - s.dist) / v;
      });
      this.leaderDone = true;
      this.events.push({ t: now, lap: leadLaps, kind: 'redFlag', riderId: running[0]!.r.id, final: true });
      return;
    }
    // Nuova partenza per i giri rimanenti: griglia nell'ordine di gara, gomme nuove.
    this.events.push({ t: now, lap: leadLaps + 1, kind: 'redFlag', riderId: running[0]!.r.id, final: false });
    const restartAt = now + 40;
    running.forEach((s, i) => {
      s.dist = leadLaps * L - i * 9 - 2;
      s.lap = leadLaps;
      s.tyreFrom = leadLaps;
      s.tyreLoss = 0;
      s.lapStart = restartAt;
      s.holdUntil = restartAt;
      s.serving = 0;
      s.lapTime = this.lapTimeFor(s) * 1.06;
    });
    this.yellow.length = 0;
    this.events.push({ t: restartAt, lap: leadLaps + 1, kind: 'restart', riderId: running[0]!.r.id });
  }

  /**
   * IA (piloti non guidati dal giocatore), a ogni giro, con le stesse leve: risparmia carburante se non basta,
   * protegge le gomme se consumate con molti giri da fare, attacca negli ultimi giri se è vicino a chi precede,
   * rallenta se è stanco o isolato.
   */
  private aiDecide(s: State, order: State[]) {
    const lapsLeft = this.laps - s.lap;
    const k = order.indexOf(s);
    const v = this.L / this.setup.refLap;
    const gapAhead = k > 0 ? (order[k - 1]!.dist - s.dist) / v : 99;
    const gapBehind = k >= 0 && k < order.length - 1 ? (s.dist - order[k + 1]!.dist) / v : 99;
    const need = this.fuelUse({ ...s, r: { ...s.r, fuelMap: 'standard' } }) * lapsLeft;
    const fuelMap: FuelMap =
      s.fuel < need * 0.99 ? 'save' : lapsLeft <= 3 && s.fuel > need * 1.12 ? 'performance' : 'standard';
    const wear = (s.tyreLoss / 0.02) * 100;
    const tyreMode: TyreMode =
      wear > 65 && lapsLeft > 3 ? 'conservative' : lapsLeft <= 3 && wear < 80 ? 'performance' : 'balanced';
    let mode: PaceMode = s.r.mode;
    if (lapsLeft <= 3 && gapAhead < 1.2) mode = s.r.aggression > 0.7 ? 'maxAttack' : 'attack';
    else if (s.fatigue > 75) mode = 'conservative';
    else if (gapAhead > 5 && gapBehind > 5 && lapsLeft > 3 && (mode === 'attack' || mode === 'maxAttack'))
      mode = 'normal';
    if (mode !== s.r.mode || fuelMap !== s.r.fuelMap || tyreMode !== s.r.tyreMode)
      this.setStrategy(s.r.id, { mode, fuelMap, tyreMode }, false);
  }

  private recordFrame() {
    const L = this.L,
      laps = this.laps;
    this.frames.push(this.st.map((s) => (s.out ? -1 : Math.round(Math.min(s.dist, laps * L) * 10) / 10)));
    this.nextFrame += this.frameEvery;
  }

  /** Un passo della simulazione. */
  step() {
    if (this.done) return;
    const { L, laps, N, cond } = this;
    const track = this.setup.track;
    const rng = this.rng;
    const dt = RACE_DT;
    const t = this.t;
    const order = this.st.filter((s) => !s.out && !s.finished).sort((a, b) => b.dist - a.dist);
    for (let k = 0; k < order.length; k++) {
      const s = order[k]!;
      const pos = ((s.dist % L) + L) % L;
      const idx = Math.floor((pos / L) * N) % N;
      let v = (L / s.lapTime) * track.speed[idx]!;
      if (t < s.holdUntil) continue; // fermo in corsia box o dopo la bandiera rossa
      // Nell'anello della Long Lap: fuori traiettoria, avanza più lentamente e non blocca nessuno.
      if (s.serving > 0) {
        s.serving -= dt;
        s.dist += s.servingRate * dt;
        continue;
      }
      let ai = k - 1;
      while (ai >= 0 && order[ai]!.serving > 0) ai--;
      const ahead = ai >= 0 ? order[ai] : undefined;
      if (ahead && ahead.dist - s.dist < 12 && ahead.dist - s.dist > 0) {
        // In scia: non può passare finché il sorpasso non riesce.
        const vAhead = (L / ahead.lapTime) * track.speed[idx]!;
        if (v > vAhead) {
          s.blockedFor += dt;
          const zone = this.inYellow(s.dist, t) ? 0 : track.overtake[idx]!; // bandiera gialla: niente sorpassi
          const edge =
            1.6 * (s.r.overtaking - ahead.r.defending) + (30 * (ahead.lapTime - s.lapTime)) / s.lapTime;
          const p = dt * 0.35 * zone * (1 / (1 + Math.exp(-(edge + 0.3)))) * MODE[s.r.mode].overtake;
          if (rng.chance(p)) {
            s.dist = ahead.dist + 3;
            this.events.push({ t, lap: s.lap + 1, kind: 'overtake', riderId: s.r.id, otherId: ahead.r.id });
            s.blockedFor = 0;
            // Sorpasso troppo deciso: contatto e Long Lap.
            if (rng.chance(0.003 * s.r.aggression * Math.max(1, MODE[s.r.mode].crash))) {
              this.events.push({ t, lap: s.lap + 1, kind: 'contact', riderId: s.r.id, otherId: ahead.r.id });
              ahead.dist -= vAhead * 1.2;
              this.givePenalty(s, 1, 'contact', t);
            }
            continue;
          }
          v = vAhead * 0.995;
        }
      }
      const prev = s.dist;
      s.dist += v * dt;
      // Ingresso nell'anello della Long Lap.
      if (s.llp > 0 && s.lap + 1 >= s.llpFrom && s.lap < laps) {
        const a = (((prev % L) + L) % L) / L,
          b = (((s.dist % L) + L) % L) / L;
        if (a < this.llEntry && b >= this.llEntry) {
          const duration = this.llSeg / v + this.llLoss;
          s.serving = duration;
          s.servingRate = this.llSeg / duration;
          s.llp--;
          s.llpServed++;
          this.events.push({ t, lap: s.lap + 1, kind: 'longLap', riderId: s.r.id, duration });
        }
      }
      // Traguardo e nuovo giro (istante esatto del passaggio, interpolato nel passo).
      const lapNow = Math.floor(s.dist / L);
      if (lapNow > s.lap) {
        const tc = t + dt * Math.min(1, Math.max(0, (lapNow * L - prev) / (s.dist - prev || 1)));
        const lt = tc - s.lapStart;
        if (s.lap > 0) {
          s.best = Math.min(s.best, lt);
          if (lt < this.fastest.time) this.fastest = { riderId: s.r.id, time: lt };
        }
        // Consumi del giro appena concluso: gomma, carburante, fatica (con la strategia attuale).
        if (s.lap >= 0) {
          s.tyreLoss += this.degPerLap(s);
          s.fuel = Math.max(0, s.fuel - this.fuelUse(s));
          const fit = s.r.fitness ?? 0.7;
          s.fatigue = Math.min(
            100,
            s.fatigue + 2.2 * MODE[s.r.mode].fatigue * (1.35 - fit) * heatFactor(cond.trackTemp),
          );
          s.lapTimes.push(Math.round(lt * 1000) / 1000);
          s.wear.push(Math.round(Math.min(100, (s.tyreLoss / 0.02) * 100)));
        }
        s.lap = lapNow;
        s.lapStart = tc;
        // Limiti della pista nel giro appena concluso.
        const tlP =
          0.042 *
          MODE[s.r.mode].tl *
          (1.35 - s.r.concentration) *
          (1 + s.r.aggression / 2) *
          (cond.grip === 'wet' ? 1.4 : 1);
        const lastLap = s.lap >= laps || this.leaderDone;
        // All'ultimo giro conta solo se il pilota ci guadagna: circa un'infrazione su tre.
        if (rng.chance(lastLap ? tlP * 0.3 : tlP)) {
          if (lastLap) {
            s.lastLapTL = true;
            this.events.push({ t, lap: s.lap, kind: 'positionDrop', riderId: s.r.id });
          } else {
            s.tl++;
            this.events.push({ t, lap: s.lap, kind: 'trackLimits', riderId: s.r.id, count: s.tl });
            if (s.tl === this.tlLimit) this.givePenalty(s, 1, 'trackLimits', t);
          }
        }
        if (s.lap >= laps || this.leaderDone) {
          s.finished = true;
          s.finishTime = tc;
          if (!this.leaderDone) this.events.push({ t, lap: s.lap, kind: 'finish', riderId: s.r.id });
          this.leaderDone = true;
          continue;
        }
        // Senza carburante: ritiro.
        if (s.fuel <= 0) {
          s.out = true;
          s.reason = 'fuel';
          this.events.push({ t, lap: s.lap, kind: 'fuelOut', riderId: s.r.id });
          continue;
        }
        if (!s.r.manual) this.aiDecide(s, order);
        s.tyreTemp = this.tyreTempOf(s);
        s.lapTime = this.lapTimeFor(s);
        // Guasto meccanico programmato o caduta.
        if (s.mechLap !== null && s.lap === s.mechLap) {
          s.out = true;
          s.reason = 'mechanical';
          this.events.push({ t, lap: s.lap, kind: 'mechanical', riderId: s.r.id });
          continue;
        }
        const crashP =
          0.0025 *
          MODE[s.r.mode].crash *
          crashFactor(s.r.compound, cond) *
          (1.3 - s.r.concentration) *
          (1 + s.r.aggression / 2) *
          (1 + s.fatigue / 120);
        if (rng.chance(crashP)) {
          if (rng.chance(0.7)) {
            s.out = true;
            s.reason = 'crash';
            this.events.push({ t, lap: s.lap, kind: 'crash', riderId: s.r.id });
            this.raiseYellow(s, t);
            // Due cadute ravvicinate, oppure barriere danneggiate / moto in pista dopo una caduta singola.
            if (!this.redFlagged && rng.chance(t - this.lastCrash < 15 ? 0.8 : 0.09)) {
              this.redFlagged = true;
              this.redFlag(t);
            }
            this.lastCrash = t;
          } else {
            this.raiseYellow(s, t);
            s.dist -= (L / s.lapTime) * 14; // ripartenza dopo la scivolata: ~14 s persi
            this.events.push({ t, lap: s.lap, kind: 'remount', riderId: s.r.id });
          }
        }
      }
    }
    this.t = t + dt;
    if (this.t >= this.nextFrame) this.recordFrame();
    if (this.st.every((s) => s.out || s.finished) || this.t >= laps * this.setup.refLap * 2) {
      this.done = true;
      if (this.fastest.riderId)
        this.events.push({ t: 0, lap: 0, kind: 'fastestLap', riderId: this.fastest.riderId });
    }
  }

  /** Risultato finale (da chiamare a gara conclusa). */
  result(): RaceOutcome {
    const st = this.st,
      laps = this.laps,
      llLoss = this.llLoss;
    // Long Lap non scontate → secondi; poi una posizione in meno per i limiti all'ultimo giro.
    const total = (s: State) => s.finishTime + s.llp * llLoss;
    const finishers = st.filter((s) => s.finished).sort((a, b) => b.lap - a.lap || total(a) - total(b));
    for (let i = finishers.length - 2; i >= 0; i--) {
      const s = finishers[i]!;
      if (s.lastLapTL && finishers[i + 1]!.lap === s.lap) {
        finishers[i] = finishers[i + 1]!;
        finishers[i + 1] = s;
      }
    }
    const winnerTime = finishers[0] ? total(finishers[0]) : 0;
    const penaltyOf = (s: State): { penalty?: RacePenalty } =>
      s.llpTotal > 0 || s.lastLapTL
        ? {
            penalty: {
              longLaps: s.llpTotal,
              served: s.llpServed,
              timeAdded: Math.round(s.llp * llLoss * 10) / 10,
              positionDrop: s.lastLapTL,
            },
          }
        : {};
    const results: RaceResultRow[] = [
      ...finishers.map((s, i) => ({
        riderId: s.r.id,
        position: i + 1,
        status: 'finished' as const,
        laps: s.lap,
        time: Math.round(total(s) * 1000) / 1000,
        gap: s.lap < laps ? null : Math.max(0, Math.round((total(s) - winnerTime) * 1000) / 1000),
        bestLap: Math.round(s.best * 1000) / 1000,
        ...penaltyOf(s),
      })),
      ...st
        .filter((s) => s.out)
        .sort((a, b) => b.dist - a.dist)
        .map((s) => ({
          riderId: s.r.id,
          position: null,
          status: 'dnf' as const,
          laps: s.lap,
          time: null,
          gap: null,
          bestLap: Number.isFinite(s.best) && s.best < INF ? Math.round(s.best * 1000) / 1000 : 0,
          ...(s.reason ? { reason: s.reason } : {}),
          ...penaltyOf(s),
        })),
    ];
    return {
      results,
      events: this.events,
      fastestLap: { riderId: this.fastest.riderId, time: this.fastest.time },
      frames: this.frames,
      frameEvery: this.frameEvery,
      duration: Math.round(this.t),
      laps: st.map((s) => ({ times: s.lapTimes, wear: s.wear })),
    };
  }
}

/** Gara completa in un colpo (squadre IA, gare non seguite dal giocatore, test). */
export function runRace(setup: RaceSetup): RaceOutcome {
  const sim = new RaceSim(setup);
  sim.runToEnd();
  return sim.result();
}

/** Converte un attributo 1–100 in 0–1. */
export const unit = (x: number) => clamp((x - 1) / 99, 0, 1);
