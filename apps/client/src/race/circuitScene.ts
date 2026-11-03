/**
 * Autodromo disegnato attorno al tracciato della simulazione (vista dall'alto).
 *
 * Dalla linea centrale (punti normalizzati, gli stessi usati dal motore di gara) si ricavano:
 *  - curve: angolo di sterzata fra tangenti vicine; esterno della curva = lato opposto al centro di curvatura;
 *  - cordoli rossi/bianchi su entrambi i lati delle curve, ghiaia all'esterno (più larga nelle curve veloci),
 *    barriere e reti oltre le vie di fuga;
 *  - rettilineo dei box attorno al traguardo (indice 0): corsia box sul lato interno con ingresso e uscita,
 *    box delle squadre, edificio dei box, paddock con camion e torre di controllo;
 *  - tribune sul rettilineo principale e nelle staccate più forti, con pubblico, vialetti dai parcheggi,
 *    maxischermi e bandiere; alberi ed edifici negli spazi liberi; ambiente in base al paese.
 * Tutto è deterministico (seme = nome del circuito): lo stesso circuito appare sempre uguale.
 */

export type V = [number, number];
export type Env = 'desert' | 'arid' | 'temperate' | 'tropical' | 'coastal';

export interface Garage {
  team: string;
  color: string;
  color2: string;
  /** Punto del garage sul bordo della corsia box e direzione verso la corsia. */
  at: V;
  dir: V;
}

export interface Stand {
  /** Quattro angoli (il lato 0-1 guarda la pista). */
  quad: [V, V, V, V];
  rows: number;
  seed: number;
}

export interface Scene {
  name: string;
  env: Env;
  pts: V[];
  tan: V[];
  nor: V[];
  curv: number[];
  /** Lato interno del rettilineo dei box (+1 = normale sinistra, −1 = destra). */
  pitSide: 1 | -1;
  width: number;
  /** Corsia box: punti della linea centrale. */
  pitLane: V[];
  /** Indice del punto della corsia box dove inizia la zona dei box. */
  pitBoxStart: number;
  pitBoxEnd: number;
  pitEntryIdx: number;
  pitExitIdx: number;
  garages: Garage[];
  kerbs: { from: number; to: number; side: 1 | -1 }[];
  gravel: { from: number; to: number; side: 1 | -1; depth: number }[];
  /** Distanza della barriera dalla linea centrale, per indice e lato (sinistra, destra). */
  barrier: [number[], number[]];
  stands: Stand[];
  /** Motorhome delle squadre nel paddock, dietro ai camion. */
  motorhomes: { quad: [V, V, V, V]; color: string; color2: string; dir: V }[];
  trees: { at: V; r: number; palm: boolean }[];
  buildings: { quad: [V, V, V, V]; color: string; roof: string }[];
  paths: V[][];
  screens: { at: V; dir: V }[];
  flags: { at: V; color: string }[];
  marshals: V[];
  parking: [V, V, V, V][];
  sea: [V, V, V, V] | null;
  bounds: { x0: number; y0: number; x1: number; y1: number };
  sectors: [number, number];
  /** Anello della Long Lap Penalty (all'esterno della curva indicata dalla simulazione). */
  longLap: { path: V[]; side: 1 | -1; from: number; to: number } | null;
}

const ENV: Record<string, Env> = {
  UAE: 'desert',
  MEX: 'arid',
  USA: 'arid',
  ARG: 'arid',
  TUR: 'arid',
  ESP: 'arid',
  THA: 'tropical',
  MAS: 'tropical',
  INA: 'tropical',
  JPN: 'temperate',
  AUS: 'coastal',
  POR: 'coastal',
};

export const PALETTE: Record<
  Env,
  { ground: string; ground2: string; verge: string; tree: string; tree2: string }
> = {
  desert: { ground: '#d8c39a', ground2: '#ccb486', verge: '#6f9a45', tree: '#4f7a33', tree2: '#3c6128' },
  arid: { ground: '#9f9a5c', ground2: '#928d52', verge: '#6c8a3c', tree: '#56702f', tree2: '#445a25' },
  temperate: { ground: '#4f7f37', ground2: '#487632', verge: '#5a8d3f', tree: '#2f5a26', tree2: '#25491f' },
  tropical: { ground: '#3f7a35', ground2: '#386f2f', verge: '#4b8b3c', tree: '#24561f', tree2: '#1c4718' },
  coastal: { ground: '#5a8540', ground2: '#527b3a', verge: '#64924a', tree: '#36602a', tree2: '#2b4f22' },
};

function rnd(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let x = h >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const len = (a: V) => Math.hypot(a[0], a[1]);
const norm = (a: V): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

export function buildScene(
  name: string,
  country: string,
  points: [number, number][],
  sectors: [number, number],
  teams: { team: string; color: string; color2: string }[],
  longLapIdx?: number,
): Scene {
  const N = points.length;
  const R = rnd(`scene::${name}`);
  const pts = points.map((p) => [p[0], p[1]] as V);
  const at = (i: number) => pts[((i % N) + N) % N]!;
  const tan = pts.map((_, i) => norm(sub(at(i + 1), at(i - 1))));
  const nor = tan.map((t) => [-t[1], t[0]] as V);
  const curv = pts.map((_, i) => {
    const a = tan[(((i - 4) % N) + N) % N]!,
      b = tan[(i + 4) % N]!;
    return Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
  });
  const width = 0.016;
  const env = ENV[country] ?? 'temperate';

  // Corsia box sul lato interno del rettilineo del traguardo (verso il baricentro del tracciato).
  const cx = pts.reduce((t, p) => t + p[0], 0) / N,
    cy = pts.reduce((t, p) => t + p[1], 0) / N;
  const toC = sub([cx, cy], at(0));
  const pitSide: 1 | -1 = toC[0] * nor[0]![0] + toC[1] * nor[0]![1] >= 0 ? 1 : -1;
  const ENTRY = Math.round(N * 0.07),
    EXIT = Math.round(N * 0.06);
  const pitEntryIdx = N - ENTRY,
    pitExitIdx = EXIT;
  const lane = 0.034;
  const pitLane: V[] = [];
  const span = ENTRY + EXIT;
  for (let k = 0; k <= span; k++) {
    const i = pitEntryIdx + k;
    const ramp = Math.min(1, k / 10, (span - k) / 10);
    const off = (width / 2 + 0.004 + lane * smooth(ramp)) * pitSide;
    pitLane.push(add(at(i), mul(nor[((i % N) + N) % N]!, off)));
  }
  const pitBoxStart = 14,
    pitBoxEnd = span - 14;
  const garages: Garage[] = [];
  const nG = Math.max(1, teams.length);
  for (let g = 0; g < nG; g++) {
    const k = Math.round(pitBoxStart + ((g + 0.5) / nG) * (pitBoxEnd - pitBoxStart));
    const i = (pitEntryIdx + k) % N;
    const dir = mul(nor[i]!, pitSide);
    garages.push({
      team: teams[g]?.team ?? '',
      color: teams[g]?.color ?? '#777',
      color2: teams[g]?.color2 ?? '#333',
      at: add(pitLane[k]!, mul(dir, 0.008)),
      dir,
    });
  }

  // Curve: cordoli su entrambi i lati, ghiaia all'esterno.
  const kerbs: Scene['kerbs'] = [];
  const gravel: Scene['gravel'] = [];
  let i0 = -1;
  for (let i = 0; i <= N; i++) {
    const c = Math.abs(curv[i % N]!);
    if (c > 0.18 && i0 < 0) i0 = i;
    if ((c <= 0.18 || i === N) && i0 >= 0) {
      const from = i0,
        to = i;
      let peak = 0,
        sign = 0;
      for (let j = from; j < to; j++) {
        if (Math.abs(curv[j % N]!) > peak) {
          peak = Math.abs(curv[j % N]!);
          sign = Math.sign(curv[j % N]!);
        }
      }
      if (to - from >= 3) {
        const outside = (sign > 0 ? -1 : 1) as 1 | -1;
        kerbs.push({ from: from - 2, to: to + 2, side: outside });
        kerbs.push({ from: from + 1, to: to - 1, side: -outside as 1 | -1 });
        // Curve veloci (poco angolo, lunghe) = vie di fuga profonde.
        const depth = 0.014 + Math.min(0.022, (to - from) * 0.0009);
        gravel.push({ from: from - 2, to: to + 7, side: outside, depth });
      }
      i0 = -1;
    }
  }
  // Barriere: distanza minima dalla pista, più in là dove c'è ghiaia; mai sopra la corsia box.
  const base = width / 2 + 0.012;
  const barrier: [number[], number[]] = [pts.map(() => base), pts.map(() => base)];
  for (const g of gravel) {
    for (let j = g.from - 4; j <= g.to + 4; j++) {
      const i = ((j % N) + N) % N;
      const edge = Math.min(1, (j - (g.from - 4)) / 6, (g.to + 4 - j) / 6);
      const d = width / 2 + 0.006 + g.depth * smooth(Math.max(0, edge)) + 0.004;
      const side = g.side === 1 ? 0 : 1;
      barrier[side][i] = Math.max(barrier[side][i]!, d);
    }
  }
  const pitIdx = new Set<number>();
  for (let k = 0; k <= span; k++) pitIdx.add((pitEntryIdx + k) % N);
  for (const i of pitIdx) barrier[pitSide === 1 ? 0 : 1][i] = width / 2 + lane + 0.022;

  // Anello della Long Lap: parte dal punto indicato dalla simulazione, sull'esterno della curva.
  let longLap: Scene['longLap'] = null;
  if (longLapIdx !== undefined) {
    const SPAN = 12;
    const from = longLapIdx - SPAN,
      to = longLapIdx + SPAN;
    const side = (curv[((longLapIdx % N) + N) % N]! > 0 ? -1 : 1) as 1 | -1;
    const path: V[] = [];
    for (let j = from; j <= to; j++) {
      const t = (j - from) / (to - from);
      const i = ((j % N) + N) % N;
      const off = (width / 2 + 0.003 + 0.026 * Math.sin(Math.PI * t) ** 0.8) * side;
      path.push(add(at(i), mul(nor[i]!, off)));
      const sideIdx = side === 1 ? 0 : 1;
      barrier[sideIdx][i] = Math.max(
        barrier[sideIdx][i]!,
        width / 2 + 0.042 * Math.sin(Math.PI * t) ** 0.6 + 0.008,
      );
    }
    longLap = { path, side, from, to };
  }

  // Tribune: rettilineo principale (lato opposto ai box) e staccate più forti.
  const stands: Stand[] = [];
  const standAt = (i: number, side: 1 | -1, lengthIdx: number, depth: number) => {
    const sideIdx = side === 1 ? 0 : 1;
    const a = (((i - lengthIdx) % N) + N) % N,
      b = (i + lengthIdx) % N;
    const offA = barrier[sideIdx][a]! + 0.008,
      offB = barrier[sideIdx][b]! + 0.008;
    const p0 = add(at(a), mul(nor[a]!, offA * side));
    const p1 = add(at(b), mul(nor[b]!, offB * side));
    const p2 = add(p1, mul(nor[b]!, depth * side));
    const p3 = add(p0, mul(nor[a]!, depth * side));
    // Scarta le tribune che toccano un altro tratto di pista.
    const clear = width / 2 + 0.012;
    const probe: V[] = [];
    for (let t = 0; t <= 1.0001; t += 0.125) {
      probe.push(
        add(p0, mul(sub(p1, p0), t)),
        add(p3, mul(sub(p2, p3), t)),
        add(mul(add(p0, p3), 0.5), mul(sub(mul(add(p1, p2), 0.5), mul(add(p0, p3), 0.5)), t)),
      );
    }
    for (let k = 0; k < N; k++) if (probe.some((q) => len(sub(pts[k]!, q)) < clear)) return;
    stands.push({ quad: [p0, p1, p2, p3], rows: Math.round(depth / 0.004), seed: Math.floor(R() * 1e6) });
  };
  standAt(0, -pitSide as 1 | -1, Math.round(N * 0.045), 0.04);
  const corners = gravel
    .map((g) => ({ g, mid: Math.round((g.from + g.to) / 2) % N }))
    .filter((c) => !pitIdx.has(c.mid))
    .sort((a, b) => b.g.depth - a.g.depth || a.mid - b.mid)
    .slice(0, 7);
  for (const c of corners) if (stands.length < 6) standAt(c.g.from, c.g.side, 9, 0.026);

  // Box: edificio dei box dietro i garage, paddock, torre di controllo.
  const buildings: Scene['buildings'] = [];
  const boxQuad = (k0: number, k1: number, o0: number, o1: number): [V, V, V, V] => {
    const i0 = (pitEntryIdx + k0) % N,
      i1 = (pitEntryIdx + k1) % N;
    const s = pitSide;
    return [
      add(pitLane[k0]!, mul(nor[i0]!, o0 * s)),
      add(pitLane[k1]!, mul(nor[i1]!, o0 * s)),
      add(pitLane[k1]!, mul(nor[i1]!, o1 * s)),
      add(pitLane[k0]!, mul(nor[i0]!, o1 * s)),
    ];
  };
  buildings.push({ quad: boxQuad(pitBoxStart, pitBoxEnd, 0.016, 0.03), color: '#cfd2d8', roof: '#9aa0aa' });
  const tower = Math.round(ENTRY);
  buildings.push({ quad: boxQuad(tower - 3, tower + 3, 0.032, 0.048), color: '#e6e8ec', roof: '#5f6b7a' });
  // Camion e hospitality nel paddock.
  for (let g = 0; g < nG; g++) {
    const k = Math.round(pitBoxStart + ((g + 0.5) / nG) * (pitBoxEnd - pitBoxStart));
    buildings.push({
      quad: boxQuad(k - 2, k + 1, 0.036, 0.046),
      color: teams[g]?.color ?? '#888',
      roof: '#2b2d31',
    });
    buildings.push({
      quad: boxQuad(k - 2, k + 2, 0.05, 0.058),
      color: '#f1efe9',
      roof: teams[g]?.color2 ?? '#555',
    });
  }

  // Motorhome: una fila per squadra dietro ai camion (lato box), con tendalino verso il paddock.
  const motorhomes: Scene['motorhomes'] = [];
  for (let g = 0; g < nG; g++) {
    const k = Math.round(pitBoxStart + ((g + 0.5) / nG) * (pitBoxEnd - pitBoxStart));
    const i = (pitEntryIdx + k) % N;
    motorhomes.push({
      quad: boxQuad(k - 3, k + 2, 0.066, 0.075),
      color: teams[g]?.color ?? '#888',
      color2: teams[g]?.color2 ?? '#333',
      dir: mul(nor[i]!, pitSide),
    });
  }

  // Confini della scena.
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const pad = 0.08;
  const bounds = {
    x0: Math.min(...xs) - pad,
    y0: Math.min(...ys) - pad,
    x1: Math.max(...xs) + pad,
    y1: Math.max(...ys) + pad,
  };

  // Parcheggi e vialetti verso le tribune.
  const parking: Scene['parking'] = [];
  const paths: V[][] = [];
  const corner = (k: number): V =>
    k === 0
      ? [bounds.x0 + 0.02, bounds.y0 + 0.02]
      : k === 1
        ? [bounds.x1 - 0.02, bounds.y0 + 0.02]
        : k === 2
          ? [bounds.x1 - 0.02, bounds.y1 - 0.02]
          : [bounds.x0 + 0.02, bounds.y1 - 0.02];
  const inside = (p: V) => {
    let c = false;
    for (let i = 0, j = N - 1; i < N; j = i++) {
      const a = pts[i]!,
        b = pts[j]!;
      if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0])
        c = !c;
    }
    return c;
  };
  for (const st of stands) {
    const back = mul(add(st.quad[2], st.quad[3]), 0.5);
    if (inside(back)) continue; // tribuna nell'infield: si raggiunge dal sottopassaggio, niente vialetto
    // Il parcheggio più vicino fra i quattro angoli della scena.
    let best = 0,
      bd = Infinity;
    for (let k = 0; k < 4; k++) {
      const d = len(sub(corner(k), back));
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    const c = corner(best);
    const mid: V = add(mul(add(c, back), 0.5), [(R() - 0.5) * 0.06, (R() - 0.5) * 0.06]);
    const path: V[] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const a = mul(c, (1 - t) * (1 - t)),
        b = mul(mid, 2 * t * (1 - t)),
        d = mul(back, t * t);
      path.push(add(add(a, b), d));
    }
    paths.push(path);
  }
  for (let k = 0; k < 4; k++) {
    const c = corner(k);
    const sx = k === 0 || k === 3 ? 1 : -1,
      sy = k < 2 ? 1 : -1;
    parking.push([c, add(c, [0.07 * sx, 0]), add(c, [0.07 * sx, 0.045 * sy]), add(c, [0, 0.045 * sy])]);
  }

  // Maxischermi e bandiere.
  const screens: Scene['screens'] = stands.slice(0, 3).map((st) => {
    const back = mul(add(st.quad[2], st.quad[3]), 0.5);
    const front = mul(add(st.quad[0], st.quad[1]), 0.5);
    return { at: add(back, mul(norm(sub(back, front)), 0.01)), dir: norm(sub(st.quad[1], st.quad[0])) };
  });
  const flagColors = ['#e5484d', '#ffd21f', '#3d7bfd', '#f3f1ec', '#2fbf71', ...teams.map((t) => t.color)];
  const flags: Scene['flags'] = [];
  for (const st of stands) {
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      flags.push({
        at: add(st.quad[3], mul(sub(st.quad[2], st.quad[3]), t)),
        color: flagColors[Math.floor(R() * flagColors.length)]!,
      });
    }
  }

  // Postazioni dei commissari, ogni ~1/18 di giro, sul lato esterno.
  const marshals: V[] = [];
  for (let k = 1; k < 18; k++) {
    const i = Math.round((k / 18) * N) % N;
    if (pitIdx.has(i)) continue;
    const side = curv[i]! > 0 ? -1 : 1;
    const d = barrier[side === 1 ? 0 : 1][i]! + 0.004;
    marshals.push(add(at(i), mul(nor[i]!, d * side)));
  }

  // Mare per i circuiti sulla costa: una fascia lungo il lato più lontano dal tracciato.
  const sea: Scene['sea'] =
    env === 'coastal'
      ? [
          [bounds.x0 - 1, bounds.y1 - 0.06],
          [bounds.x1 + 1, bounds.y1 - 0.06],
          [bounds.x1 + 1, bounds.y1 + 1],
          [bounds.x0 - 1, bounds.y1 + 1],
        ]
      : null;

  // Alberi negli spazi liberi (lontani da pista, corsia box, tribune, edifici e parcheggi).
  const trees: Scene['trees'] = [];
  const blockers: V[] = [
    ...pitLane,
    ...stands.flatMap((s) => s.quad),
    ...buildings.flatMap((b) => b.quad),
    ...motorhomes.flatMap((m) => m.quad),
    ...parking.flatMap((p) => p),
  ];
  const nearTrack = (p: V, d: number) => {
    for (let i = 0; i < N; i += 2) if (len(sub(pts[i]!, p)) < d) return true;
    return false;
  };
  const nearBlock = (p: V, d: number) => blockers.some((b) => len(sub(b, p)) < d);
  const palm = env === 'desert' || env === 'tropical' || env === 'coastal';
  const wanted = env === 'desert' ? 90 : env === 'arid' ? 140 : 260;
  for (let n = 0, tries = 0; n < wanted && tries < wanted * 12; tries++) {
    const p: V = [bounds.x0 + R() * (bounds.x1 - bounds.x0), bounds.y0 + R() * (bounds.y1 - bounds.y0)];
    if (sea && p[1] > bounds.y1 - 0.07) continue;
    if (nearTrack(p, 0.07) || nearBlock(p, 0.035)) continue;
    if (paths.some((path) => path.some((q) => len(sub(q, p)) < 0.015))) continue;
    // Boschetti: gli alberi si raggruppano.
    const cluster = 1 + Math.floor(R() * 4);
    for (let c = 0; c < cluster; c++) {
      const q: V = add(p, [(R() - 0.5) * 0.03, (R() - 0.5) * 0.03]);
      if (nearTrack(q, 0.06)) continue;
      trees.push({ at: q, r: 0.005 + R() * 0.006, palm: palm && R() < 0.7 });
      n++;
    }
  }

  return {
    name,
    env,
    pts,
    tan,
    nor,
    curv,
    pitSide,
    width,
    pitLane,
    pitBoxStart,
    pitBoxEnd,
    pitEntryIdx,
    pitExitIdx,
    garages,
    kerbs,
    gravel,
    barrier,
    stands,
    motorhomes,
    trees,
    buildings,
    paths,
    screens,
    flags,
    marshals,
    parking,
    sea,
    bounds,
    sectors,
    longLap,
  };
}

function smooth(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

// ---------------------------------------------------------------------------------------------
export interface View {
  scale: number;
  ox: number;
  oy: number;
}

export function fitView(sc: Scene, w: number, h: number): View {
  const bw = sc.bounds.x1 - sc.bounds.x0,
    bh = sc.bounds.y1 - sc.bounds.y0;
  const scale = Math.min(w / bw, h / bh);
  return {
    scale,
    ox: (w - bw * scale) / 2 - sc.bounds.x0 * scale,
    oy: (h - bh * scale) / 2 - sc.bounds.y0 * scale,
  };
}

/** Disegno statico: tutto ciò che non si muove. Da fare una volta e mettere in cache. */
export function drawStatic(ctx: CanvasRenderingContext2D, sc: Scene, v: View, w: number, h: number) {
  const P = (p: V): V => [v.ox + p[0] * v.scale, v.oy + p[1] * v.scale];
  const S = (d: number) => d * v.scale;
  const N = sc.pts.length;
  const pal = PALETTE[sc.env];
  const R = rnd(`draw::${sc.name}`);
  const at = (i: number) => sc.pts[((i % N) + N) % N]!;
  const nr = (i: number) => sc.nor[((i % N) + N) % N]!;
  const offsetPath = (from: number, to: number, off: (i: number) => number) => {
    const out: V[] = [];
    for (let j = from; j <= to; j++) out.push(P(add(at(j), mul(nr(j), off(((j % N) + N) % N)))));
    return out;
  };
  const poly = (ps: V[], close = true) => {
    ctx.beginPath();
    ps.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    if (close) ctx.closePath();
  };

  // Terreno con strisce del prato tagliato (o dune nel deserto).
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = pal.ground2;
  const stripe = Math.max(10, S(0.03));
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.5);
  for (let x = -w * 1.5; x < w * 1.5; x += stripe * 2) ctx.fillRect(x, -h * 1.5, stripe, h * 3);
  ctx.restore();
  // Grana del terreno.
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let k = 0; k < 2600; k++) ctx.fillRect(R() * w, R() * h, 1.2, 1.2);

  if (sc.sea) {
    poly(sc.sea.map(P));
    const g = ctx.createLinearGradient(0, P(sc.sea[0])[1], 0, h);
    g.addColorStop(0, '#2f7ea8');
    g.addColorStop(1, '#1b4f74');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#e8d9a8';
    ctx.lineWidth = S(0.012);
    ctx.beginPath();
    ctx.moveTo(0, P(sc.sea[0])[1]);
    ctx.lineTo(w, P(sc.sea[1])[1]);
    ctx.stroke();
  }

  // Parcheggi.
  for (const p of sc.parking) {
    poly(p.map(P));
    ctx.fillStyle = '#6b6e75';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const [a, b, , d] = p.map(P) as [V, V, V, V];
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const x = a[0] + (b[0] - a[0]) * t,
        y = a[1] + (b[1] - a[1]) * t;
      ctx.fillRect(x, Math.min(y, d[1]), 1, Math.abs(d[1] - a[1]));
    }
    // Auto parcheggiate.
    const cars = ['#c9ccd2', '#2b2d31', '#8d1f26', '#1d3f8a', '#f3f1ec', '#555a63'];
    for (let k = 0; k < 26; k++) {
      ctx.fillStyle = cars[Math.floor(R() * cars.length)]!;
      const t = R(),
        u = 0.15 + R() * 0.7;
      ctx.fillRect(a[0] + (b[0] - a[0]) * t, a[1] + (d[1] - a[1]) * u, S(0.004), S(0.0025));
    }
  }

  // Vialetti verso le tribune.
  ctx.lineCap = 'round';
  for (const path of sc.paths) {
    ctx.strokeStyle = 'rgba(210, 200, 175, 0.85)';
    ctx.lineWidth = Math.max(2, S(0.006));
    poly(path.map(P), false);
    ctx.stroke();
  }

  // Bordo d'erba vicino alla pista (irrigato anche nel deserto).
  ctx.strokeStyle = pal.verge;
  ctx.lineJoin = 'round';
  ctx.lineWidth = S(0.07);
  poly(sc.pts.map(P));
  ctx.stroke();

  // Ghiaia.
  for (const g of sc.gravel) {
    const inner = () => (sc.width / 2 + 0.006) * g.side;
    const outer = (j: number) => {
      const t = Math.min(1, (j - g.from) / 5, (g.to - j) / 5);
      return (sc.width / 2 + 0.006 + g.depth * smooth(Math.max(0, t))) * g.side;
    };
    const a = offsetPath(g.from, g.to, inner);
    const b: V[] = [];
    for (let j = g.to; j >= g.from; j--) b.push(P(add(at(j), mul(nr(j), outer(j)))));
    poly([...a, ...b]);
    ctx.fillStyle = '#d6c18f';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(120, 95, 50, 0.35)';
    for (let k = 0; k < 220; k++) {
      const p = a[Math.floor(R() * a.length)]!;
      ctx.fillRect(p[0] + (R() - 0.5) * S(0.08), p[1] + (R() - 0.5) * S(0.08), 1.4, 1.4);
    }
    ctx.restore();
    // Fascia di asfalto prima della ghiaia (via di fuga).
    ctx.strokeStyle = '#5b5e64';
    ctx.lineWidth = Math.max(1, S(0.004));
    poly(
      offsetPath(g.from, g.to, () => (sc.width / 2 + 0.004) * g.side),
      false,
    );
    ctx.stroke();
  }

  // Corsia box: asfalto, linea bianca, ingresso/uscita.
  const lane = sc.pitLane.map(P);
  ctx.strokeStyle = '#3d3f45';
  ctx.lineWidth = S(0.011);
  poly(lane, false);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  poly(lane, false);
  ctx.stroke();
  ctx.setLineDash([]);
  // Zona box: piazzole davanti ai garage.
  for (const gr of sc.garages) {
    const p = P(gr.at);
    const d = gr.dir;
    const t: V = [-d[1], d[0]];
    const hw = S(0.006),
      hd = S(0.006);
    const q = (u: number, vv: number): V => [p[0] + t[0] * u + d[0] * vv, p[1] + t[1] * u + d[1] * vv];
    poly([q(-hw, -hd), q(hw, -hd), q(hw, hd * 1.4), q(-hw, hd * 1.4)]);
    ctx.fillStyle = '#4a4d54';
    ctx.fill();
    // Garage con il colore della squadra.
    poly([q(-hw, hd * 1.4), q(hw, hd * 1.4), q(hw, hd * 2.6), q(-hw, hd * 2.6)]);
    ctx.fillStyle = gr.color;
    ctx.fill();
    ctx.strokeStyle = gr.color2;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Edifici.
  for (const b of sc.buildings) {
    const q = b.quad.map(P);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    poly(q.map((p) => [p[0] + 3, p[1] + 3] as V));
    ctx.fill();
    poly(q);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle = b.roof;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Motorhome: carrozzeria nei colori della squadra, tetto con finestre, tendalino e tavolini.
  for (const m of sc.motorhomes) {
    const q = m.quad.map(P) as [V, V, V, V];
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    poly(q.map((p) => [p[0] + 3, p[1] + 3] as V));
    ctx.fill();
    poly(q);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Fascia centrale del tetto e finestre.
    const a = add(q[0], mul(sub(q[3], q[0]), 0.35)),
      b = add(q[1], mul(sub(q[2], q[1]), 0.35)),
      c = add(q[1], mul(sub(q[2], q[1]), 0.65)),
      d = add(q[0], mul(sub(q[3], q[0]), 0.65));
    poly([a, b, c, d]);
    ctx.fillStyle = m.color2;
    ctx.fill();
    ctx.fillStyle = 'rgba(180,215,240,0.8)';
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const p = add(q[0], mul(sub(q[1], q[0]), t));
      ctx.fillRect(p[0] - 1, p[1] - 1, 2.5, 2.5);
    }
    // Tendalino a strisce verso il paddock, con tavolini.
    const out = mul(m.dir, -0.006);
    const t0 = q[0],
      t1 = q[1],
      t2 = P(add(m.quad[1], out)),
      t3 = P(add(m.quad[0], out));
    poly([t0, t1, t2, t3]);
    ctx.fillStyle = 'rgba(243,241,236,0.85)';
    ctx.fill();
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 1;
    for (let k = 1; k < 8; k++) {
      const t = k / 8;
      const u = add(t0, mul(sub(t1, t0), t)),
        v2 = add(t3, mul(sub(t2, t3), t));
      ctx.beginPath();
      ctx.moveTo(u[0], u[1]);
      ctx.lineTo(v2[0], v2[1]);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a3d22';
    for (let k = 1; k < 4; k++) {
      const p = add(add(t3, mul(sub(t2, t3), k / 4)), mul(sub(t0, t3), -0.6));
      ctx.beginPath();
      ctx.arc(p[0], p[1], Math.max(1.5, S(0.0012)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tribune (struttura; il pubblico è dinamico).
  for (const st of sc.stands) {
    const q = st.quad.map(P) as [V, V, V, V];
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    poly(q.map((p) => [p[0] + 4, p[1] + 4] as V));
    ctx.fill();
    poly(q);
    ctx.fillStyle = '#8b9099';
    ctx.fill();
    ctx.strokeStyle = '#d7dae0';
    ctx.lineWidth = 1;
    for (let r = 1; r < st.rows; r++) {
      const t = r / st.rows;
      const a = add(q[0], mul(sub(q[3], q[0]), t)),
        b = add(q[1], mul(sub(q[2], q[1]), t));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    // Tetto sul retro.
    const r0 = add(q[3], mul(sub(q[0], q[3]), 0.25)),
      r1 = add(q[2], mul(sub(q[1], q[2]), 0.25));
    poly([q[3], q[2], r1, r0]);
    ctx.fillStyle = '#e8e9ec';
    ctx.fill();
  }

  // Barriere: reti blu/bianche dove c'è la ghiaia, guard-rail grigio altrove.
  for (const side of [1, -1] as const) {
    const arr = sc.barrier[side === 1 ? 0 : 1];
    const pts = sc.pts.map((p, i) => P(add(p, mul(sc.nor[i]!, arr[i]! * side))));
    ctx.strokeStyle = '#9ea3ad';
    ctx.lineWidth = 2;
    poly(pts);
    ctx.stroke();
    ctx.strokeStyle = '#2f6fd0';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    for (const g of sc.gravel.filter((x) => x.side === side)) {
      poly(
        offsetPath(g.from, g.to, (i) => arr[i]! * side),
        false,
      );
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Pista: bordo bianco, asfalto con grana.
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Ombra morbida sotto il nastro d'asfalto (profondità; disegnata una volta nello strato statico).
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(4, S(0.012));
  ctx.shadowOffsetY = Math.max(1, S(0.003));
  poly(sc.pts.map(P));
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = S(sc.width) + 3;
  ctx.stroke();
  ctx.restore();
  poly(sc.pts.map(P));
  ctx.strokeStyle = '#3b3d42';
  ctx.lineWidth = S(sc.width);
  ctx.stroke();
  // Traiettoria più scura (gommata) e grana.
  poly(sc.pts.map(P));
  ctx.strokeStyle = 'rgba(20,20,22,0.35)';
  ctx.lineWidth = S(sc.width) * 0.35;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let k = 0; k < 1800; k++) {
    const i = Math.floor(R() * N);
    const p = P(add(at(i), mul(nr(i), (R() - 0.5) * sc.width)));
    ctx.fillRect(p[0], p[1], 1, 1);
  }

  // Cordoli rossi e bianchi.
  for (const k of sc.kerbs) {
    for (let j = k.from; j < k.to; j++) {
      const off = (sc.width / 2 + 0.0015) * k.side;
      const a = P(add(at(j), mul(nr(j), off))),
        b = P(add(at(j + 1), mul(nr(j + 1), off)));
      ctx.strokeStyle = Math.floor(j / 1) % 2 === 0 ? '#d7262e' : '#f4f4f4';
      ctx.lineWidth = Math.max(2.5, S(0.0035));
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }

  // Anello della Long Lap Penalty.
  if (sc.longLap) {
    const lp = sc.longLap.path.map(P);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    poly(lp, false);
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = S(0.009) + 3;
    ctx.stroke();
    poly(lp, false);
    ctx.strokeStyle = '#46484e';
    ctx.lineWidth = S(0.009);
    ctx.stroke();
    // Frecce gialle nel senso di marcia.
    ctx.fillStyle = '#ffd21f';
    for (let k = 3; k < lp.length - 3; k += 5) {
      const a = lp[k]!,
        b = lp[k + 1]!;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const r = Math.max(2.5, S(0.003));
      ctx.save();
      ctx.translate(a[0], a[1]);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r, -r);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r, r);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Cartello "LONG LAP" all'esterno dell'anello.
    const mid = sc.longLap.path[Math.floor(sc.longLap.path.length / 2)]!;
    const i = ((Math.round((sc.longLap.from + sc.longLap.to) / 2) % N) + N) % N;
    const lab = P(add(mid, mul(sc.nor[i]!, 0.014 * sc.longLap.side)));
    const fs = Math.max(9, S(0.009));
    ctx.font = `900 ${fs}px Archivo, system-ui, sans-serif`;
    const tw = ctx.measureText('LONG LAP').width;
    ctx.fillStyle = '#1d3f8a';
    ctx.fillRect(lab[0] - tw / 2 - 5, lab[1] - fs * 0.75, tw + 10, fs * 1.5);
    ctx.fillStyle = '#ffd21f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LONG LAP', lab[0], lab[1] + 1);
  }

  // Griglia di partenza (piazzole sfalsate dietro il traguardo).
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.2;
  for (let g = 0; g < 24; g++) {
    const i = (N - 1 - Math.floor(g / 3) * 2) % N;
    const lat = ((g % 3) - 1) * sc.width * 0.3;
    const c = add(at(i), mul(nr(i), lat));
    const a = P(add(c, mul(nr(i), sc.width * 0.12))),
      b = P(add(c, mul(nr(i), -sc.width * 0.12)));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  // Traguardo a scacchi.
  const f0 = at(0),
    fn = nr(0),
    ft = sc.tan[0]!;
  const cells = 8;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cells; c++) {
      const u = -sc.width / 2 + (c / cells) * sc.width;
      const s0 = add(add(f0, mul(fn, u)), mul(ft, r * (sc.width / cells)));
      const q = [
        s0,
        add(s0, mul(fn, sc.width / cells)),
        add(add(s0, mul(fn, sc.width / cells)), mul(ft, sc.width / cells)),
        add(s0, mul(ft, sc.width / cells)),
      ].map(P);
      poly(q);
      ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
      ctx.fill();
    }
  }

  // Settori cronometrati.
  const sectorColor = ['#ffd21f', '#6aa8ff', '#e5484d'];
  [0, sc.sectors[0], sc.sectors[1]].forEach((i, k) => {
    const a = P(add(at(i), mul(nr(i), sc.width * 0.9))),
      b = P(add(at(i), mul(nr(i), -sc.width * 0.9)));
    ctx.strokeStyle = sectorColor[k]!;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    if (k > 0) {
      const side = sc.curv[i]! > 0 ? -1 : 1;
      const lp = P(add(at(i), mul(nr(i), (sc.barrier[side === 1 ? 0 : 1][i]! + 0.016) * side)));
      const fs = Math.max(10, S(0.012));
      ctx.font = `800 ${fs}px Archivo, system-ui, sans-serif`;
      const tw = ctx.measureText(`S${k}|S${k + 1}`).width;
      ctx.fillStyle = 'rgba(16,17,19,0.8)';
      ctx.fillRect(lp[0] - tw / 2 - 4, lp[1] - fs * 0.7, tw + 8, fs * 1.4);
      ctx.fillStyle = sectorColor[k]!;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`S${k}|S${k + 1}`, lp[0], lp[1]);
    }
  });

  // Postazioni dei commissari.
  for (const m of sc.marshals) {
    const p = P(m);
    ctx.fillStyle = '#f07c1f';
    ctx.fillRect(p[0] - 3, p[1] - 3, 6, 6);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.strokeRect(p[0] - 3, p[1] - 3, 6, 6);
  }

  // Alberi (ombra + chioma) e palme.
  for (const t of sc.trees) {
    const p = P(t.at);
    const r = Math.max(2.5, S(t.r));
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(p[0] + r * 0.4, p[1] + r * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = pal.tree;
      ctx.lineWidth = Math.max(1.5, r * 0.35);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + t.at[0] * 50;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.quadraticCurveTo(
          p[0] + Math.cos(a) * r * 0.8,
          p[1] + Math.sin(a) * r * 0.8 - r * 0.2,
          p[0] + Math.cos(a) * r * 1.3,
          p[1] + Math.sin(a) * r * 1.3,
        );
        ctx.stroke();
      }
      ctx.fillStyle = '#7a5a33';
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.1, p[0], p[1], r);
      g.addColorStop(0, pal.tree);
      g.addColorStop(1, pal.tree2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------------------------
export interface BikeDraw {
  /** Pilota (stesso id della simulazione). */
  id: string;
  pos: V;
  dir: V;
  color: string;
  color2: string;
  number: number;
  label: string | null;
  mine: boolean;
  /** Pilota selezionato dal giocatore (evidenziato in 2D e seguito dalle telecamere). */
  selected: boolean;
  /** In lotta con chi lo precede o lo segue (meno di 0,6 s). */
  battle: boolean;
}

const CROWD = [
  '#e5484d',
  '#ffd21f',
  '#f3f1ec',
  '#3d7bfd',
  '#2b2d31',
  '#f07c1f',
  '#2fbf71',
  '#c9ccd2',
  '#8d1f26',
];

/** Bianco o nero, il più leggibile sul colore dato. */
function contrastInk(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#111' : '#fff';
}

/** Elementi animati: pubblico, gente sui vialetti, bandiere, maxischermi, moto, pioggia. */
export function drawDynamic(
  ctx: CanvasRenderingContext2D,
  sc: Scene,
  v: View,
  w: number,
  h: number,
  time: number,
  bikes: BikeDraw[],
  extra: {
    rain: number;
    leaderNumber: number | null;
    lap: string;
    crashes: V[];
    chequered: boolean;
    /** Punti del giro (0–1) con la bandiera gialla esposta. */
    yellow?: number[];
    red?: boolean;
  },
) {
  const P = (p: V): V => [v.ox + p[0] * v.scale, v.oy + p[1] * v.scale];
  const S = (d: number) => d * v.scale;

  // Pubblico sulle tribune: puntini colorati che si muovono appena.
  for (const st of sc.stands) {
    const q = st.quad.map(P) as [V, V, V, V];
    const R = rnd(`crowd::${st.seed}`);
    const cols = Math.max(8, Math.round(len(sub(q[1], q[0])) / 4));
    const rows = Math.max(2, Math.round(len(sub(q[3], q[0])) / 4) - 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (R() < 0.12) continue; // posti vuoti
        const t = (c + 0.5) / cols,
          u = 0.08 + ((r + 0.5) / rows) * 0.62;
        const a = add(q[0], mul(sub(q[1], q[0]), t)),
          b = add(q[3], mul(sub(q[2], q[3]), t));
        const p = add(a, mul(sub(b, a), u));
        const jump = Math.sin(time * 3 + r * 1.7 + c * 0.9) > 0.985 ? -1.2 : 0;
        ctx.fillStyle = CROWD[Math.floor(R() * CROWD.length)]!;
        ctx.fillRect(p[0] - 1, p[1] - 1 + jump, 2.2, 2.2);
      }
    }
  }
  // Gente che cammina sui vialetti.
  sc.paths.forEach((path, k) => {
    const pp = path.map(P);
    for (let n = 0; n < 7; n++) {
      const f = (time * 0.012 + n / 7 + k * 0.13) % 1;
      const idx = f * (pp.length - 1);
      const i = Math.floor(idx);
      const a = pp[i]!,
        b = pp[Math.min(pp.length - 1, i + 1)]!;
      const x = a[0] + (b[0] - a[0]) * (idx - i),
        y = a[1] + (b[1] - a[1]) * (idx - i);
      ctx.fillStyle = CROWD[(n + k) % CROWD.length]!;
      ctx.beginPath();
      ctx.arc(x + ((n % 2) - 0.5) * 3, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // Bandiere sui tetti delle tribune.
  for (const f of sc.flags) {
    const p = P(f.at);
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[0], p[1] - 9);
    ctx.stroke();
    const wave = Math.sin(time * 6 + p[0] * 0.3) * 1.6;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] - 9);
    ctx.quadraticCurveTo(p[0] + 4, p[1] - 9 + wave, p[0] + 8, p[1] - 8 + wave * 0.5);
    ctx.lineTo(p[0] + 8, p[1] - 4 + wave * 0.5);
    ctx.quadraticCurveTo(p[0] + 4, p[1] - 5 + wave, p[0], p[1] - 5);
    ctx.closePath();
    ctx.fill();
  }
  // Maxischermi con il numero del leader.
  for (const scr of sc.screens) {
    const p = P(scr.at);
    const ang = Math.atan2(scr.dir[1], scr.dir[0]);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(ang);
    ctx.fillStyle = '#0b0c0e';
    ctx.fillRect(-17, -9, 34, 18);
    ctx.fillStyle = '#1e2a44';
    ctx.fillRect(-15, -7, 30, 14);
    ctx.fillStyle = '#ffd21f';
    ctx.font = '800 8px Archivo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(extra.leaderNumber !== null ? `#${extra.leaderNumber}` : 'LIVE', 0, -2);
    ctx.fillStyle = '#f3f1ec';
    ctx.font = '600 5px Archivo, system-ui, sans-serif';
    ctx.fillText(extra.lap, 0, 4);
    ctx.restore();
  }
  // Bandiere dei commissari: gialla nel tratto della caduta, rossa ovunque se la gara è interrotta.
  const waveFlag = (p: V, color: string, k: number) => {
    const wave = Math.sin(time * 9 + k) * 2;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(p[0], p[1] - 14);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] - 14);
    ctx.quadraticCurveTo(p[0] + 6, p[1] - 15 + wave, p[0] + 11, p[1] - 13 + wave);
    ctx.lineTo(p[0] + 11, p[1] - 6 + wave);
    ctx.quadraticCurveTo(p[0] + 6, p[1] - 8 + wave, p[0], p[1] - 7);
    ctx.closePath();
    ctx.fill();
  };
  const N = sc.pts.length;
  // Tratto di pista in regime di bandiera gialla (±3% del giro): striscia gialla trasparente sull'asfalto.
  for (const y of extra.yellow ?? []) {
    const i0 = Math.floor(((((y - 0.03) % 1) + 1) % 1) * N);
    const cnt = Math.floor(0.06 * N);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 210, 31, ${0.35 + 0.15 * Math.sin(time * 6)})`;
    ctx.lineWidth = Math.max(4, S(sc.width) * 1.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k <= cnt; k++) {
      const p = P(sc.pts[(i0 + k) % N]!);
      if (k === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.restore();
  }
  sc.marshals.forEach((m, k) => {
    if (extra.red) return waveFlag(P(m), '#e5484d', k);
    if (!extra.yellow?.length) return;
    // Postazione vicina a una zona gialla?
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < N; i += 3) {
      const d = len(sub(sc.pts[i]!, m));
      if (d < bd) {
        bd = d;
        best = i / N;
      }
    }
    if (extra.yellow.some((y) => Math.min(Math.abs(y - best), 1 - Math.abs(y - best)) < 0.06))
      waveFlag(P(m), '#ffd21f', k);
  });
  if (extra.red) {
    ctx.fillStyle = 'rgba(229,72,77,0.9)';
    ctx.fillRect(w / 2 - 110, 14, 220, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '800 16px Archivo, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BANDIERA ROSSA', w / 2, 31);
  }

  // Moto cadute nella ghiaia.
  for (const c of extra.crashes) {
    const p = P(c);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(0.9);
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(-5, -2, 10, 4);
    ctx.restore();
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(p[0] + 6, p[1] - 5, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Moto viste dall'alto.
  const L = Math.max(10, S(0.012)),
    W = L * 0.36;
  // Battaglie: alone arancio pulsante sotto le moto a meno di 0,6 s l'una dall'altra.
  for (const b of bikes) {
    if (!b.battle) continue;
    const p = P(b.pos);
    ctx.fillStyle = `rgba(255, 122, 26, ${0.18 + 0.1 * Math.sin(time * 5)})`;
    ctx.beginPath();
    ctx.arc(p[0], p[1], L * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of bikes) {
    const p = P(b.pos);
    const ang = Math.atan2(b.dir[1], b.dir[0]);
    if (b.selected) {
      // Pilota selezionato: anello bianco/arancio.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], L * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], L * 0.85 + 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(1.5, 1.5, L * 0.55, W * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ruote.
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(L * 0.32, -W * 0.18, L * 0.22, W * 0.36);
    ctx.fillRect(-L * 0.55, -W * 0.2, L * 0.22, W * 0.4);
    // Carena nei colori della squadra.
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(L * 0.42, 0);
    ctx.quadraticCurveTo(L * 0.3, -W * 0.55, -L * 0.1, -W * 0.5);
    ctx.lineTo(-L * 0.42, -W * 0.28);
    ctx.lineTo(-L * 0.42, W * 0.28);
    ctx.lineTo(-L * 0.1, W * 0.5);
    ctx.quadraticCurveTo(L * 0.3, W * 0.55, L * 0.42, 0);
    ctx.fill();
    ctx.strokeStyle = b.mine ? '#ff7a1a' : 'rgba(0,0,0,0.6)';
    ctx.lineWidth = b.mine ? 2 : 1;
    ctx.stroke();
    // Pilota: schiena e casco.
    ctx.fillStyle = b.color2;
    ctx.beginPath();
    ctx.ellipse(-L * 0.05, 0, L * 0.18, W * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3f1ec';
    ctx.beginPath();
    ctx.arc(L * 0.14, 0, W * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Etichette senza sovrapposizioni. Priorità: pilota selezionato, i miei, i primi tre (nome + posizione),
  // poi il numero degli altri solo se c'è spazio. Le moto non vengono spostate: si spostano o si omettono le
  // etichette; se un'etichetta è lontana dalla moto, una linea sottile la collega.
  const placed: [number, number, number, number][] = [];
  const free = (x: number, y: number, w: number, h: number) =>
    !placed.some(([a, b2, c, d]) => x < a + c + 2 && x + w + 2 > a && y < b2 + d + 2 && y + h + 2 > b2);
  // Le moto stesse occupano spazio: le etichette non le coprono.
  for (const b of bikes) {
    const p = P(b.pos);
    placed.push([p[0] - W * 0.6, p[1] - W * 0.6, W * 1.2, W * 1.2]);
  }
  const rank = (b: BikeDraw) => (b.selected ? 0 : b.mine ? 1 : b.label ? 2 : 3);
  const order = [...bikes].sort((a, b) => rank(a) - rank(b));
  for (const b of order) {
    const p = P(b.pos);
    const strong = rank(b) < 3;
    const text = strong && b.label ? `${b.number}  ${b.label}` : String(b.number);
    if (!strong && L < 9) continue; // vista molto lontana: solo le icone
    ctx.font = strong
      ? '700 10px Archivo, system-ui, sans-serif'
      : 'italic 800 9px Archivo, system-ui, sans-serif';
    const w = ctx.measureText(text).width + (strong ? 10 : 6);
    const h = strong ? 14 : 11;
    const tries: [number, number][] = strong
      ? [
          [8, -h - 4],
          [8, 6],
          [-w - 8, -h - 4],
          [-w - 8, 6],
          [8, -h - 20],
          [-w - 8, -h - 20],
          [8, 22],
          [-w - 8, 22],
        ]
      : [
          [-w / 2, W * 0.9],
          [W * 0.8, -h / 2],
          [-w - W * 0.8, -h / 2],
        ];
    const spot = tries.find(([dx, dy]) => free(p[0] + dx, p[1] + dy, w, h));
    if (!spot) continue;
    const [x, y] = [p[0] + spot[0], p[1] + spot[1]];
    placed.push([x, y, w, h]);
    if (strong && Math.abs(spot[1]) > 16) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(x + (spot[0] < 0 ? w : 0), y + h / 2);
      ctx.stroke();
    }
    if (strong) {
      ctx.fillStyle = b.mine ? '#ff7a1a' : b.selected ? '#ffffff' : 'rgba(16,17,19,0.88)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = b.mine || b.selected ? '#17150c' : '#f3f1ec';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + 5, y + h / 2 + 0.5);
    } else {
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = contrastInk(b.color);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
    }
  }
  // Bandiera a scacchi agitata al traguardo.
  if (extra.chequered) {
    const i0 = sc.pts[0]!;
    const side = sc.pitSide;
    const p = P(add(i0, mul(sc.nor[0]!, (sc.width / 2 + 0.01) * -side)));
    const wave = Math.sin(time * 10) * 3;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
        ctx.fillRect(p[0] + c * 3, p[1] - 12 + r * 3 + (c / 4) * wave, 3, 3);
      }
  }
  // Pioggia.
  if (extra.rain > 0) {
    ctx.fillStyle = `rgba(30, 45, 70, ${0.18 * extra.rain})`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(200, 220, 255, ${0.35 * extra.rain})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const n = Math.round(260 * extra.rain);
    for (let k = 0; k < n; k++) {
      const x = ((k * 97.13 + time * 260) % (w + 40)) - 20;
      const y = ((k * 53.71 + time * 900) % (h + 40)) - 20;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 10);
    }
    ctx.stroke();
  }
}

/** Posizione e direzione lungo la linea centrale, con spostamento laterale. */
export function onTrack(sc: Scene, frac: number, lateral: number): { pos: V; dir: V } {
  const N = sc.pts.length;
  const f = (((frac % 1) + 1) % 1) * N;
  const i = Math.floor(f) % N,
    j = (i + 1) % N;
  const k = f - Math.floor(f);
  const a = sc.pts[i]!,
    b = sc.pts[j]!;
  const n = sc.nor[i]!;
  const base: V = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return { pos: add(base, mul(n, lateral)), dir: sc.tan[i]! };
}

/** Posizione lungo la corsia box (0 = ingresso, 1 = uscita). */
export function onPitLane(sc: Scene, f: number): { pos: V; dir: V } {
  const pl = sc.pitLane;
  const x = Math.max(0, Math.min(0.9999, f)) * (pl.length - 1);
  const i = Math.floor(x),
    k = x - i;
  const a = pl[i]!,
    b = pl[i + 1]!;
  return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: norm(sub(b, a)) };
}

/** Posizione lungo l'anello della Long Lap (0 = ingresso, 1 = uscita). */
export function onLongLap(sc: Scene, f: number): { pos: V; dir: V } | null {
  const pl = sc.longLap?.path;
  if (!pl) return null;
  const x = Math.max(0, Math.min(0.9999, f)) * (pl.length - 1);
  const i = Math.floor(x),
    k = x - i;
  const a = pl[i]!,
    b = pl[i + 1]!;
  return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], dir: norm(sub(b, a)) };
}
