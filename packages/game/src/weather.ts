/**
 * Meteo del weekend.
 *
 * Clima per paese: temperatura media annua, escursione stagionale (emisfero sud sfasato di 6 mesi) e probabilità
 * base di pioggia. Per ogni weekend si genera in modo deterministico (dal seme della partita e dal round) una
 * sequenza di condizioni per sessione, con persistenza (se piove è probabile che continui):
 *   temperatura aria = media del mese + variazione del weekend N(0; 2) entro ±4 + ora del giorno − nuvole/pioggia
 *   temperatura asfalto = aria + sole 18 °C / poco nuvoloso 12 / coperto 5 / pioggia 1
 *   asfalto: pioggia → bagnato; pioggerella o primi minuti dopo la pioggia → umido; altrimenti asciutto.
 * Le previsioni mostrate prima di una sessione danno una probabilità di pioggia, non la certezza.
 */
import { GameCalendar, Rng } from '@lean-angle/core';
import type { GameState, Round, SessionKind } from '@lean-angle/data';
import type { Conditions, Grip } from '@lean-angle/sim';

export type Sky = 'sun' | 'partly' | 'overcast' | 'drizzle' | 'rain';

export interface SessionWeather {
  kind: SessionKind;
  sky: Sky;
  airTemp: number;
  trackTemp: number;
  grip: Grip;
  /** Probabilità di pioggia annunciata dalle previsioni (0–100). */
  rainChance: number;
}

/** [media annua °C, escursione stagionale, emisfero sud, probabilità base di pioggia]. */
const CLIMATE: Record<string, [number, number, boolean, number]> = {
  UAE: [28, 8, false, 0.02],
  ARG: [17, 6, true, 0.18],
  ESP: [17, 8, false, 0.12],
  FRA: [13, 8, false, 0.25],
  JPN: [16, 10, false, 0.3],
  ITA: [15, 9, false, 0.16],
  SMR: [14, 9, false, 0.16],
  GER: [10, 9, false, 0.3],
  CZE: [9, 10, false, 0.28],
  NED: [11, 7, false, 0.35],
  GBR: [10, 6, false, 0.38],
  HUN: [12, 11, false, 0.2],
  POR: [17, 6, false, 0.14],
  TUR: [15, 9, false, 0.1],
  THA: [28, 2, false, 0.35],
  MAS: [28, 1, false, 0.5],
  AUS: [16, 5, true, 0.25],
  INA: [27, 1, false, 0.45],
  MEX: [18, 4, false, 0.15],
  USA: [20, 7, false, 0.1],
};

/** Ora del giorno della sessione: correzione della temperatura. */
const HOUR: Record<SessionKind, number> = {
  fp1: -2,
  practice: 1,
  fp2: -1,
  q1: 1,
  q2: 1,
  qualifying: 1,
  sprint: 2,
  warmup: -2,
  race: 2,
};

export function weekendWeather(s: GameState, round: Round, sessions: SessionKind[]): SessionWeather[] {
  const circuit = s.tables.circuits[round.circuitId]!;
  const [mean, amp, south, rainBase] = CLIMATE[circuit.country] ?? [16, 8, false, 0.2];
  const month = new GameCalendar(s.meta.startYear).toDate(round.startDay).month;
  const phase = ((month - 7 + (south ? 6 : 0)) / 12) * Math.PI * 2;
  const monthTemp = mean + amp * Math.cos(phase);
  const rng = Rng.fromSeed(`${s.meta.seed}::weather::${round.id}`);
  for (let i = 0; i < 8; i++) rng.next(); // scarta le prime estrazioni di un generatore appena creato
  const weekendShift = Math.max(-4, Math.min(4, rng.normal(0, 2)));
  // Un fronte di maltempo nel weekend rende la pioggia molto più probabile.
  const front = rng.chance(rainBase);
  const pRain = front ? 0.45 : rainBase * 0.2;
  let raining = rng.chance(pRain);
  let prevRain = false;
  return sessions.map((kind) => {
    raining = rng.chance(raining ? 0.6 : pRain * 0.7);
    const cloud = raining ? 1 : rng.next();
    const sky: Sky = raining
      ? rng.chance(0.35)
        ? 'drizzle'
        : 'rain'
      : cloud < (front ? 0.2 : 0.55)
        ? 'sun'
        : cloud < (front ? 0.55 : 0.85)
          ? 'partly'
          : 'overcast';
    const air =
      monthTemp +
      weekendShift +
      HOUR[kind] -
      (sky === 'rain' ? 4 : sky === 'drizzle' ? 3 : sky === 'overcast' ? 2 : 0) +
      rng.normal(0, 0.8);
    const track =
      air + (sky === 'sun' ? 18 : sky === 'partly' ? 12 : sky === 'overcast' ? 5 : 1) + rng.normal(0, 1.5);
    const grip: Grip = sky === 'rain' ? 'wet' : sky === 'drizzle' || prevRain ? 'damp' : 'dry';
    prevRain = sky === 'rain';
    // Previsione: affidabile ma non perfetta.
    const rainChance = Math.round(
      Math.min(95, Math.max(0, (raining ? 70 : front ? 35 : rainBase * 60) + rng.normal(0, 10))),
    );
    return {
      kind,
      sky,
      airTemp: Math.round(air),
      trackTemp: Math.round(track),
      grip,
      rainChance,
    };
  });
}

export function conditionsFor(w: SessionWeather | undefined): Conditions {
  return w ? { grip: w.grip, trackTemp: w.trackTemp } : { grip: 'dry', trackTemp: 35 };
}
