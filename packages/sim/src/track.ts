/**
 * Tracciati originali generati in modo stabile dal nome del circuito.
 * Punti di controllo attorno a un ovale con raggio variabile → curva chiusa morbida (Catmull-Rom) →
 * campionamento uniforme. Da curvatura e rettilinei si ricava il profilo di velocità usato dalla gara.
 */
import { Rng, clamp } from '@lean-angle/core';

export interface TrackShape {
  /** Punti del tracciato (coordinate normalizzate 0–1), chiusi: l'ultimo si collega al primo. */
  points: [number, number][];
  /** Fattore di velocità relativo per ogni punto (1 = velocità media del giro). */
  speed: number[];
  /** 0–1: quanto il punto è adatto al sorpasso (rettilinei e staccate). */
  overtake: number[];
  /** Indici dei punti che separano i tre settori. */
  sectors: [number, number];
}

const SAMPLES = 480;

export function generateTrack(key: string, turns: number): TrackShape {
  const rng = Rng.fromSeed(`track::${key}`);
  const n = clamp(Math.round(turns * 0.7) + 4, 8, 18);
  const ctrl: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.18, 0.18) * (Math.PI / n);
    const r = 1 + rng.range(-0.38, 0.32);
    ctrl.push([Math.cos(a) * r * 1.35, Math.sin(a) * r]);
  }
  // Curva chiusa Catmull-Rom molto campionata.
  const dense: [number, number][] = [];
  const per = 40;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n]!,
      p1 = ctrl[i]!,
      p2 = ctrl[(i + 1) % n]!,
      p3 = ctrl[(i + 2) % n]!;
    for (let k = 0; k < per; k++) {
      const t = k / per,
        t2 = t * t,
        t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // Campionamento uniforme per distanza.
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1]!,
      b = dense[i % dense.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[cum.length - 1]!;
  const pts: [number, number][] = [];
  let j = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const d = (i / SAMPLES) * total;
    while (cum[j + 1]! < d) j++;
    const a = dense[j % dense.length]!,
      b = dense[(j + 1) % dense.length]!;
    const t = (d - cum[j]!) / (cum[j + 1]! - cum[j]! || 1);
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  // Normalizzazione in 0–1 mantenendo le proporzioni.
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  const points = pts.map(([x, y]) => [(x - minX) / span, (y - minY) / span] as [number, number]);

  // Curvatura → velocità: curve strette lente, rettilinei veloci (smussato per simulare frenate e accelerazioni).
  const curv = points.map((_, i) => {
    const a = points[(i - 3 + SAMPLES) % SAMPLES]!,
      b = points[i]!,
      c = points[(i + 3) % SAMPLES]!;
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]),
      a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  });
  const maxC = Math.max(...curv) || 1;
  let raw = curv.map((c) => 1 / (1 + 3.2 * (c / maxC)));
  for (let pass = 0; pass < 6; pass++) {
    raw = raw.map((v, i) => (raw[(i - 1 + SAMPLES) % SAMPLES]! + 2 * v + raw[(i + 1) % SAMPLES]!) / 4);
  }
  // Normalizzazione: il tempo medio sul giro con fattore v deve essere 1.
  const meanInv = raw.reduce((s, v) => s + 1 / v, 0) / SAMPLES;
  const speed = raw.map((v) => v * meanInv);
  const maxS = Math.max(...speed),
    minS = Math.min(...speed);
  const overtake = speed.map((v, i) => {
    const next = speed[(i + 8) % SAMPLES]!;
    const braking = v > next * 1.15 ? 0.6 : 0; // zona di staccata
    return clamp(((v - minS) / (maxS - minS || 1)) * 0.7 + braking, 0, 1);
  });
  return { points, speed, overtake, sectors: [Math.round(SAMPLES / 3), Math.round((2 * SAMPLES) / 3)] };
}

/** Posizione (x, y) normalizzata e indice per una frazione di giro 0–1. */
export function pointAt(shape: TrackShape, lapFraction: number): [number, number] {
  const f = ((lapFraction % 1) + 1) % 1;
  const x = f * shape.points.length;
  const i = Math.floor(x),
    t = x - i;
  const a = shape.points[i % shape.points.length]!,
    b = shape.points[(i + 1) % shape.points.length]!;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
