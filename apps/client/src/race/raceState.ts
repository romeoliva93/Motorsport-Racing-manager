/**
 * Stato della gara in un istante: UNICA fonte per la vista 2D, la vista 3D e i pannelli.
 *
 * La gara è calcolata una volta sola dal motore di simulazione (packages/sim) e arriva qui come ReplayData
 * (fotogrammi delle distanze + eventi). `raceFrame(t)` è una funzione pura: dato lo stesso istante restituisce
 * sempre le stesse posizioni, gli stessi distacchi e gli stessi eventi. Cambiare vista (2D ↔ 3D) cambia solo chi
 * disegna questo risultato: il tempo `t`, la velocità e la pausa vivono nel visore e non vengono toccati.
 */
import type { ReplayData } from '@lean-angle/game';
import { onLongLap, onPitLane, onTrack, type BikeDraw, type Scene, type V } from './circuitScene.ts';

/** Secondi (tempo di gara) della fase box: uscita dai garage, corsia box, giro di ricognizione, griglia. */
export const INTRO = 45;

export interface Team {
  team: string;
  color: string;
  color2: string;
}

export function teamsOf(data: ReplayData): Team[] {
  const seen = new Map<string, Team>();
  for (const r of data.riders)
    if (!seen.has(r.team)) seen.set(r.team, { team: r.team, color: r.color, color2: r.color2 });
  return [...seen.values()];
}

/** Ultima distanza nota di ogni pilota prima del ritiro (per la moto caduta nella ghiaia). */
export function lastDistances(data: ReplayData): number[] {
  return data.riders.map((_, n) => {
    let last = 0;
    for (const fr of data.frames) {
      if (fr[n]! < 0) break;
      last = fr[n]!;
    }
    return last;
  });
}

export function duration(data: ReplayData): number {
  return (data.frames.length - 1) * data.frameEvery;
}

/** Distanza percorsa da ogni pilota all'istante t (interpolata fra due fotogrammi); −1 = ritirato. */
export function distAt(data: ReplayData, time: number): number[] {
  const f = Math.max(0, time) / data.frameEvery;
  const i = Math.max(0, Math.min(data.frames.length - 1, Math.floor(f)));
  const j = Math.min(data.frames.length - 1, i + 1);
  const a = data.frames[i]!,
    b = data.frames[j]!;
  const k = f - i;
  return a.map((d, n) => (d < 0 || b[n]! < 0 ? (d < 0 ? -1 : d) : d + (b[n]! - d) * k));
}

export interface RaceFrame {
  t: number;
  racing: boolean;
  finished: boolean;
  dists: number[];
  /** Classifica attuale: pilota, distanza, indice nei dati. */
  order: { r: ReplayData['riders'][number]; d: number; i: number }[];
  lap: number;
  /** Il leader è nell'ultimo giro. */
  lastLap: boolean;
  avgSpeed: number;
  phase: string;
  redActive: boolean;
  chequered: boolean;
  bikes: BikeDraw[];
  crashes: V[];
  /** Posizioni (frazione di giro) delle bandiere gialle esposte. */
  yellow: number[];
  /** Coppie di piloti in lotta (meno di 0,6 s fra loro), per evidenziarle. */
  battles: [string, string][];
  rain: number;
}

export function raceFrame(
  data: ReplayData,
  scene: Scene,
  teams: Team[],
  lastDist: number[],
  t: number,
  selectedId: string | null,
): RaceFrame {
  const L = data.lengthM;
  const dur = duration(data);
  const racing = t >= 0;
  const dists = distAt(data, t);
  // Chi ha già tagliato il traguardo è in classifica secondo il risultato ufficiale della simulazione
  // (penalità comprese); gli altri secondo la distanza percorsa.
  const res = new Map(data.results.map((x) => [x.riderId, x]));
  const done = (id: string) => {
    const x = res.get(id);
    if (!x || x.status !== 'finished') return false;
    return t >= dur || (x.time !== null && t >= x.time);
  };
  const order = data.riders
    .map((r, i) => ({ r, d: racing ? dists[i]! : data.frames[0]![i]!, i, fin: racing && done(r.id) }))
    .sort((a, b) =>
      a.fin && b.fin
        ? (res.get(a.r.id)!.position ?? 99) - (res.get(b.r.id)!.position ?? 99)
        : a.fin !== b.fin
          ? Number(b.fin) - Number(a.fin)
          : racing && a.d < 0
            ? 1
            : racing && b.d < 0
              ? -1
              : b.d - a.d,
    )
    .map(({ r, d, i }) => ({ r, d, i }));
  const leader = order[0]!;
  const lap = Math.min(data.laps, Math.floor(Math.max(0, leader.d) / L) + 1);
  const avgSpeed = L / ((data.results[0]?.time ?? dur) / data.laps);
  // Gara in diretta: finita solo quando la simulazione ha prodotto i risultati.
  const finished = t >= dur && data.results.length > 0;
  const winnerEvent = data.events.find((e) => e.kind === 'finish');
  const redEvent = data.events.find((e) => e.kind === 'redFlag');
  const restartEvent = data.events.find((e) => e.kind === 'restart');
  const redActive =
    racing &&
    !!redEvent &&
    t >= redEvent.t &&
    (redEvent.final ? t < redEvent.t + 8 : !!restartEvent && t < restartEvent.t);
  const phase = !racing
    ? t < -INTRO + 14
      ? 'Uscita dai box'
      : t < -3
        ? 'Giro di ricognizione'
        : 'Semaforo rosso…'
    : redActive
      ? 'Bandiera rossa'
      : finished
        ? 'Gara finita'
        : `Giro ${lap} di ${data.laps}`;

  // Battaglie: piloti consecutivi in classifica a meno di 0,6 s.
  const battles: [string, string][] = [];
  if (racing && !finished)
    for (let k = 1; k < order.length; k++) {
      const a = order[k - 1]!,
        b = order[k]!;
      if (a.d < 0 || b.d < 0) continue;
      if ((a.d - b.d) / avgSpeed < 0.6) battles.push([a.r.id, b.r.id]);
    }
  const inBattle = new Set(battles.flat());

  const nG = scene.garages.length;
  const span = scene.pitLane.length - 1;
  const exitFrac = scene.pitExitIdx / scene.pts.length;
  const posLabel = new Map(order.map((o, k) => [o.r.id, k + 1]));
  const bikes: BikeDraw[] = [];
  data.riders.forEach((r, i) => {
    const lateral = ((i % 3) - 1) * scene.width * 0.28;
    let pd: { pos: V; dir: V } | null = null;
    if (!racing) {
      // Fase box: garage → corsia box → giro di ricognizione → casella di griglia.
      const g = Math.max(
        0,
        teams.findIndex((x) => x.team === r.team),
      );
      const fGarage = (scene.pitBoxStart + ((g + 0.5) / nG) * (scene.pitBoxEnd - scene.pitBoxStart)) / span;
      const gridFrac = 1 + data.frames[0]![i]! / L; // poco prima del traguardo
      const leave = -INTRO + 1 + i * 0.55;
      const tPit = (1 - fGarage) * 10;
      const arrive = -4;
      if (t < leave) {
        const gr = scene.garages[g]!;
        pd = {
          pos: [gr.at[0] + gr.dir[0] * 0.004, gr.at[1] + gr.dir[1] * 0.004],
          dir: [-gr.dir[0], -gr.dir[1]],
        };
      } else if (t < leave + tPit) {
        pd = onPitLane(scene, fGarage + ((t - leave) / tPit) * (1 - fGarage));
      } else if (t < arrive) {
        const k = (t - leave - tPit) / (arrive - leave - tPit);
        const e = k * k * (3 - 2 * k);
        pd = onTrack(scene, exitFrac + e * (gridFrac - exitFrac), lateral * e);
      } else pd = onTrack(scene, gridFrac, ((i % 2) - 0.5) * scene.width * 0.5);
    } else {
      const d = dists[i]!;
      // Nell'anello della Long Lap?
      const ll = data.events.find(
        (e) => e.kind === 'longLap' && e.riderId === r.id && e.t <= t && t < e.t + (e.duration ?? 0),
      );
      if (ll && d >= 0) pd = onLongLap(scene, (t - ll.t) / (ll.duration ?? 1));
      else if (d >= 0) pd = onTrack(scene, d / L, lateral);
    }
    if (!pd) return;
    const pos = posLabel.get(r.id) ?? 0;
    const selected = r.id === selectedId;
    bikes.push({
      ...pd,
      id: r.id,
      color: r.color,
      color2: r.color2,
      number: r.number,
      mine: r.mine,
      selected,
      battle: inBattle.has(r.id),
      label: r.mine || selected || (racing && pos <= 3) ? `${racing ? `${pos}. ` : ''}${r.short}` : null,
    });
  });
  // Il selezionato e i miei disegnati per ultimi (sopra agli altri).
  bikes.sort((a, b) => Number(a.mine || a.selected) - Number(b.mine || b.selected));

  const crashes: V[] = racing
    ? data.events
        .filter((e) => e.kind === 'crash' && e.t <= t)
        .map((e) => {
          const n = data.riders.findIndex((r) => r.id === e.riderId);
          const frac = lastDist[n]! / L;
          const i = Math.floor((((frac % 1) + 1) % 1) * scene.pts.length) % scene.pts.length;
          const side = scene.curv[i]! > 0 ? -1 : 1;
          return onTrack(scene, frac, (scene.width / 2 + 0.014) * side).pos;
        })
    : [];
  const yellow = racing
    ? data.events
        .filter((e) => e.kind === 'yellowFlag' && e.t <= t && t < e.t + (e.duration ?? 0))
        .map((e) => e.at ?? 0)
    : [];
  const rain = data.weather.grip === 'wet' ? 1 : data.weather.sky === 'drizzle' ? 0.45 : 0;

  return {
    t,
    racing,
    finished,
    dists,
    order,
    lap,
    lastLap: racing && !finished && lap === data.laps,
    avgSpeed,
    phase,
    redActive,
    chequered: !!winnerEvent && t >= winnerEvent.t,
    bikes,
    crashes,
    yellow,
    battles,
    rain,
  };
}
