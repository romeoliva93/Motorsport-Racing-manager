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
import type { TrackShape } from './track.ts';

export type Compound = 'soft' | 'medium' | 'hard';
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
}

export interface RaceEvent {
  t: number;
  lap: number;
  kind: 'overtake' | 'crash' | 'remount' | 'mechanical' | 'fastestLap' | 'finish';
  riderId: string;
  otherId?: string;
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
}

export interface RaceOutcome {
  results: RaceResultRow[];
  events: RaceEvent[];
  fastestLap: { riderId: string; time: number };
  /** Fotogrammi: distanza percorsa (m) da ogni pilota, nell'ordine della griglia; -1 = ritirato. */
  frames: number[][];
  frameEvery: number;
  duration: number;
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
};
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
): Record<Compound, number> {
  const f = wearFactor(tyreManagement, mode) * degScale(laps);
  const sumAge = (laps * (laps - 1)) / 2;
  const out = {} as Record<Compound, number>;
  for (const c of ['soft', 'medium', 'hard'] as Compound[])
    out[c] = 100 * (TYRE[c].base * laps + TYRE[c].deg * f * sumAge);
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

/** Qualifiche: tre giri lanciati per pilota con gomma morbida, vale il migliore. */
export function runQualifying(seed: string, refLap: number, riders: RaceRider[]): QualifyingRow[] {
  const rng = Rng.fromSeed(`${seed}::quali`);
  const times = riders.map((r) => {
    const base = baseLap(refLap, r) * (1 + TYRE.soft.base + rng.normal(0, 0.0035));
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
}

export function runRace(setup: RaceSetup): RaceOutcome {
  const rng = Rng.fromSeed(`${setup.seed}::race`);
  const { track, lengthM: L, laps } = setup;
  const N = track.points.length;
  const dt = 0.25;
  const frameEvery = setup.frameEvery ?? 0.5;
  const events: RaceEvent[] = [];
  const st: State[] = setup.grid.map((r, i) => ({
    r,
    form: rng.normal(0, 0.0035),
    dist: -i * 9 - 2, // partenza sfalsata in griglia
    lap: 0,
    lapStart: 0,
    lapTime: 0,
    best: Infinity,
    out: false,
    finished: false,
    finishTime: 0,
    blockedFor: 0,
    mechLap: rng.chance(0.03 * (1.4 - r.reliability)) ? rng.int(1, laps) : null,
  }));
  const lapTimeFor = (s: State) => {
    const r = s.r;
    const tyreAge = s.lap;
    const t = TYRE[r.compound];
    const m = MODE[r.mode];
    const tyre = t.base + t.deg * degScale(laps) * tyreAge * m.deg * (1.3 - 0.6 * r.tyreManagement);
    const fuel = 0.004 * (1 - s.lap / laps);
    const noise = rng.normal(0, 0.0025 * (1.2 - r.consistency));
    return baseLap(setup.refLap, r) * (1 + tyre + fuel + m.pace + noise + s.form);
  };
  for (const s of st) s.lapTime = lapTimeFor(s) * 1.06; // primo giro con partenza da fermo
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
      const ahead = order[k - 1];
      if (ahead && ahead.dist - s.dist < 12 && ahead.dist - s.dist > 0) {
        // In scia: non può passare finché il sorpasso non riesce.
        const vAhead = (L / ahead.lapTime) * track.speed[idx]!;
        if (v > vAhead) {
          s.blockedFor += dt;
          const zone = track.overtake[idx]!;
          const edge =
            1.6 * (s.r.overtaking - ahead.r.defending) + (30 * (ahead.lapTime - s.lapTime)) / s.lapTime;
          const p =
            dt * 0.35 * zone * (1 / (1 + Math.exp(-(edge + 0.3)))) * (s.r.mode === 'attack' ? 1.4 : 1);
          if (rng.chance(p)) {
            s.dist = ahead.dist + 3;
            events.push({ t, lap: s.lap + 1, kind: 'overtake', riderId: s.r.id, otherId: ahead.r.id });
            s.blockedFor = 0;
            continue;
          }
          v = vAhead * 0.995;
        }
      }
      const prev = s.dist;
      s.dist += v * dt;
      // Traguardo e nuovo giro (istante esatto del passaggio, interpolato nel passo).
      const lapNow = Math.floor(s.dist / L);
      if (lapNow > s.lap) {
        const tc = t + dt * Math.min(1, Math.max(0, (lapNow * L - prev) / (s.dist - prev || 1)));
        const lt = tc - s.lapStart;
        if (s.lap > 0) {
          s.best = Math.min(s.best, lt);
          if (lt < fastest.time) fastest = { riderId: s.r.id, time: lt };
        }
        s.lap = lapNow;
        s.lapStart = tc;
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
        const crashP = 0.0025 * MODE[s.r.mode].crash * (1.3 - s.r.concentration) * (1 + s.r.aggression / 2);
        if (rng.chance(crashP)) {
          if (rng.chance(0.7)) {
            s.out = true;
            s.reason = 'crash';
            events.push({ t, lap: s.lap, kind: 'crash', riderId: s.r.id });
          } else {
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

  const finishers = st.filter((s) => s.finished).sort((a, b) => b.lap - a.lap || a.finishTime - b.finishTime);
  const winnerTime = finishers[0]?.finishTime ?? 0;
  const results: RaceResultRow[] = [
    ...finishers.map((s, i) => ({
      riderId: s.r.id,
      position: i + 1,
      status: 'finished' as const,
      laps: s.lap,
      time: Math.round(s.finishTime * 1000) / 1000,
      gap: s.lap < laps ? null : Math.round((s.finishTime - winnerTime) * 1000) / 1000,
      bestLap: Math.round(s.best * 1000) / 1000,
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
      })),
  ];
  return { results, events, fastestLap: fastest, frames, frameEvery, duration: Math.round(t) };
}

/** Converte un attributo 1–100 in 0–1. */
export const unit = (x: number) => clamp((x - 1) / 99, 0, 1);
