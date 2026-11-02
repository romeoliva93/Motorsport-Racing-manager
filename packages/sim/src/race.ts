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
export type PaceMode = 'conservative' | 'normal' | 'attack';

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
    | 'restart';
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
  reason?: 'crash' | 'mechanical';
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
const MODE: Record<PaceMode, { pace: number; crash: number; deg: number }> = {
  conservative: { pace: 0.005, crash: 0.5, deg: 0.85 },
  normal: { pace: 0, crash: 1, deg: 1 },
  attack: { pace: -0.004, crash: 2, deg: 1.3 },
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
  reason?: 'crash' | 'mechanical';
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
 *    categorie; probabilità per giro = 4,2% × ritmo (attacco 2, normale 1, prudente 0,4) × (1,35 − concentrazione)
 *    × (1 + aggressività/2) × 1,4 sul bagnato;
 *  - partenza anticipata: doppia Long Lap; contatto in sorpasso: una Long Lap;
 *  - va scontata entro 3 giri passando nell'anello all'esterno della curva indicata: si perde
 *    LONG_LAP_LOSS × giro di riferimento (≈ 2,6 s su 2 minuti); una per giro se doppia;
 *  - se non c'è più tempo, ogni Long Lap rimasta diventa una penalità in secondi di pari durata;
 *  - oltre i limiti all'ultimo giro guadagnandoci (≈ 1 infrazione su 3): una posizione in meno.
 */
export const LONG_LAP_LOSS = 0.022;

export function runRace(setup: RaceSetup): RaceOutcome {
  const rng = Rng.fromSeed(`${setup.seed}::race`);
  const { track, lengthM: L, laps } = setup;
  const cond = setup.conditions ?? DRY;
  const N = track.points.length;
  const dt = 0.25;
  const frameEvery = setup.frameEvery ?? 0.5;
  const events: RaceEvent[] = [];
  const st: State[] = setup.grid.map((r, i) => ({
    r,
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
  }));
  const yellow: { at: number; until: number }[] = [];
  let lastCrash = -Infinity;
  let redFlagged = false;
  const inYellow = (dist: number, now: number) => {
    const f = (((dist % L) + L) % L) / L;
    return yellow.some(
      (y) => y.until > now && Math.min(Math.abs(f - y.at), 1 - Math.abs(f - y.at)) < YELLOW_SPAN,
    );
  };
  const raiseYellow = (s: State, now: number) => {
    const at = (((s.dist % L) + L) % L) / L;
    yellow.push({ at, until: now + YELLOW_TIME });
    events.push({ t: now, lap: s.lap + 1, kind: 'yellowFlag', riderId: s.r.id, at, duration: YELLOW_TIME });
  };
  const llLoss = setup.refLap * LONG_LAP_LOSS;
  const llEntry = ((track.longLap - LONG_LAP_SPAN + N) % N) / N; // frazione di giro dell'ingresso nell'anello
  const llSeg = ((2 * LONG_LAP_SPAN) / N) * L;
  const tlLimit = setup.sprint ? 3 : 5;
  const givePenalty = (s: State, n: number, reason: 'trackLimits' | 'jumpStart' | 'contact', at: number) => {
    s.llp += n;
    s.llpTotal += n;
    s.llpFrom = Math.max(1, s.lap + 1);
    events.push({ t: at, lap: s.lap + 1, kind: 'longLapPenalty', riderId: s.r.id, count: n, reason });
  };
  // Partenza anticipata.
  for (const s of st)
    if (rng.chance(0.0015 * (1.3 - s.r.concentration) * (1 + s.r.aggression))) {
      events.push({ t: 0, lap: 1, kind: 'jumpStart', riderId: s.r.id });
      givePenalty(s, 2, 'jumpStart', 0);
    }
  const lapTimeFor = (s: State) => {
    const r = s.r;
    const tyreAge = s.lap - s.tyreFrom;
    const t = tyreModel(r.compound, cond);
    const m = MODE[r.mode];
    const tyre = t.base + t.deg * degScale(laps) * tyreAge * m.deg * (1.3 - 0.6 * r.tyreManagement);
    const fuel = 0.004 * (1 - s.lap / laps);
    const noise = rng.normal(0, 0.0025 * (1.2 - r.consistency));
    return baseLap(setup.refLap, r) * (1 + tyre + fuel + m.pace + noise + s.form);
  };
  for (const s of st) s.lapTime = lapTimeFor(s) * 1.06; // primo giro con partenza da fermo

  function redFlag(now: number) {
    const running = st.filter((s) => !s.out && !s.finished).sort((a, b) => b.dist - a.dist);
    if (running.length === 0) return;
    const leadLaps = Math.floor(running[0]!.dist / L);
    if (leadLaps >= Math.ceil((laps * 2) / 3)) {
      // Gara conclusa: vale l'ordine al momento dell'interruzione.
      const v = L / setup.refLap;
      running.forEach((s) => {
        s.finished = true;
        s.lap = laps; // gara dichiarata conclusa: classifica valida
        s.finishTime = now + (running[0]!.dist - s.dist) / v;
      });
      leaderDone = true;
      events.push({ t: now, lap: leadLaps, kind: 'redFlag', riderId: running[0]!.r.id, final: true });
      return;
    }
    // Nuova partenza per i giri rimanenti: griglia nell'ordine di gara, gomme nuove.
    events.push({ t: now, lap: leadLaps + 1, kind: 'redFlag', riderId: running[0]!.r.id, final: false });
    const restartAt = now + 40;
    running.forEach((s, i) => {
      s.dist = leadLaps * L - i * 9 - 2;
      s.lap = leadLaps;
      s.tyreFrom = leadLaps;
      s.lapStart = restartAt;
      s.holdUntil = restartAt;
      s.serving = 0;
      s.lapTime = lapTimeFor(s) * 1.06;
    });
    yellow.length = 0;
    events.push({ t: restartAt, lap: leadLaps + 1, kind: 'restart', riderId: running[0]!.r.id });
  }
  let fastest = { riderId: '', time: Infinity };
  const frames: number[][] = [];
  let t = 0;
  let nextFrame = 0;
  let leaderDone = false;

  while (t < laps * setup.refLap * 2) {
    // Velocità di ciascuno nel punto in cui si trova.
    const order = st.filter((s) => !s.out && !s.finished).sort((a, b) => b.dist - a.dist);
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
          const zone = inYellow(s.dist, t) ? 0 : track.overtake[idx]!; // bandiera gialla: niente sorpassi
          const edge =
            1.6 * (s.r.overtaking - ahead.r.defending) + (30 * (ahead.lapTime - s.lapTime)) / s.lapTime;
          const p =
            dt * 0.35 * zone * (1 / (1 + Math.exp(-(edge + 0.3)))) * (s.r.mode === 'attack' ? 1.4 : 1);
          if (rng.chance(p)) {
            s.dist = ahead.dist + 3;
            events.push({ t, lap: s.lap + 1, kind: 'overtake', riderId: s.r.id, otherId: ahead.r.id });
            s.blockedFor = 0;
            // Sorpasso troppo deciso: contatto e Long Lap.
            if (rng.chance(0.003 * s.r.aggression * (s.r.mode === 'attack' ? 2 : 1))) {
              events.push({ t, lap: s.lap + 1, kind: 'contact', riderId: s.r.id, otherId: ahead.r.id });
              ahead.dist -= vAhead * 1.2;
              givePenalty(s, 1, 'contact', t);
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
        if (a < llEntry && b >= llEntry) {
          const duration = llSeg / v + llLoss;
          s.serving = duration;
          s.servingRate = llSeg / duration;
          s.llp--;
          s.llpServed++;
          events.push({ t, lap: s.lap + 1, kind: 'longLap', riderId: s.r.id, duration });
        }
      }
      // Traguardo e nuovo giro (istante esatto del passaggio, interpolato nel passo).
      const lapNow = Math.floor(s.dist / L);
      if (lapNow > s.lap) {
        const tc = t + dt * Math.min(1, Math.max(0, (lapNow * L - prev) / (s.dist - prev || 1)));
        const lt = tc - s.lapStart;
        if (s.lap > 0) {
          s.best = Math.min(s.best, lt);
          if (lt < fastest.time) fastest = { riderId: s.r.id, time: lt };
        }
        {
          // Usura gomma a fine giro (stesso modello del tempo sul giro).
          const tm = tyreModel(s.r.compound, cond);
          const age = lapNow - s.tyreFrom;
          const loss = tm.deg * degScale(laps) * age * MODE[s.r.mode].deg * (1.3 - 0.6 * s.r.tyreManagement);
          s.lapTimes.push(Math.round(lt * 1000) / 1000);
          s.wear.push(Math.round(Math.min(100, (loss / 0.02) * 100)));
        }
        s.lap = lapNow;
        s.lapStart = tc;
        // Limiti della pista nel giro appena concluso.
        const tlP =
          0.042 *
          (s.r.mode === 'attack' ? 2 : s.r.mode === 'conservative' ? 0.4 : 1) *
          (1.35 - s.r.concentration) *
          (1 + s.r.aggression / 2) *
          (cond.grip === 'wet' ? 1.4 : 1);
        const lastLap = s.lap >= laps || leaderDone;
        // All'ultimo giro conta solo se il pilota ci guadagna: circa un'infrazione su tre.
        if (rng.chance(lastLap ? tlP * 0.3 : tlP)) {
          if (lastLap) {
            s.lastLapTL = true;
            events.push({ t, lap: s.lap, kind: 'positionDrop', riderId: s.r.id });
          } else {
            s.tl++;
            events.push({ t, lap: s.lap, kind: 'trackLimits', riderId: s.r.id, count: s.tl });
            if (s.tl === tlLimit) givePenalty(s, 1, 'trackLimits', t);
          }
        }
        if (s.lap >= laps || leaderDone) {
          s.finished = true;
          s.finishTime = tc;
          if (!leaderDone) events.push({ t, lap: s.lap, kind: 'finish', riderId: s.r.id });
          leaderDone = true;
          continue;
        }
        s.lapTime = lapTimeFor(s);
        // Guasto meccanico programmato o caduta.
        if (s.mechLap !== null && s.lap === s.mechLap) {
          s.out = true;
          s.reason = 'mechanical';
          events.push({ t, lap: s.lap, kind: 'mechanical', riderId: s.r.id });
          continue;
        }
        const crashP =
          0.0025 *
          MODE[s.r.mode].crash *
          crashFactor(s.r.compound, cond) *
          (1.3 - s.r.concentration) *
          (1 + s.r.aggression / 2);
        if (rng.chance(crashP)) {
          if (rng.chance(0.7)) {
            s.out = true;
            s.reason = 'crash';
            events.push({ t, lap: s.lap, kind: 'crash', riderId: s.r.id });
            raiseYellow(s, t);
            // Due cadute ravvicinate: bandiera rossa.
            // Due cadute ravvicinate, oppure barriere danneggiate / moto in pista dopo una caduta singola.
            if (!redFlagged && rng.chance(t - lastCrash < 15 ? 0.8 : 0.09)) {
              redFlagged = true;
              redFlag(t);
            }
            lastCrash = t;
          } else {
            raiseYellow(s, t);
            s.dist -= (L / s.lapTime) * 14; // ripartenza dopo la scivolata: ~14 s persi
            events.push({ t, lap: s.lap, kind: 'remount', riderId: s.r.id });
          }
        }
      }
    }
    t += dt;
    if (t >= nextFrame) {
      frames.push(st.map((s) => (s.out ? -1 : Math.round(Math.min(s.dist, laps * L) * 10) / 10)));
      nextFrame += frameEvery;
    }
    if (st.every((s) => s.out || s.finished)) break;
  }
  if (fastest.riderId) events.push({ t: 0, lap: 0, kind: 'fastestLap', riderId: fastest.riderId });

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
        bestLap: Number.isFinite(s.best) ? Math.round(s.best * 1000) / 1000 : 0,
        ...(s.reason ? { reason: s.reason } : {}),
        ...penaltyOf(s),
      })),
  ];
  return {
    results,
    events,
    fastestLap: fastest,
    frames,
    frameEvery,
    duration: Math.round(t),
    laps: st.map((s) => ({ times: s.lapTimes, wear: s.wear })),
  };
}

/** Converte un attributo 1–100 in 0–1. */
export const unit = (x: number) => clamp((x - 1) / 99, 0, 1);
