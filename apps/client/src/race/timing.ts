/**
 * Cronometraggio per la schermata tempi (prove, qualifiche e gara), stile live timing.
 *
 * Ogni giro ha 4 checkpoint (fine di S1, S2, S3 e traguardo). Per ogni passaggio si conosce l'istante e il tempo
 * del settore. I colori si assegnano in ordine di tempo, come in TV: rosso = miglior settore assoluto fino a quel
 * momento, arancio = miglior settore personale, grigio = più lento. Giri di uscita e di rientro sono sempre grigi
 * e non contano per i migliori.
 *
 * Funzioni pure: dato lo stesso istante `t` restituiscono sempre la stessa tabella.
 */
import type { ReplayData, SessionTiming } from '@lean-angle/game';

export type SectorColor = 'best' | 'pb' | 'slow';

export interface TimingPass {
  /** Istante del passaggio (s). */
  t: number;
  sector: 0 | 1 | 2 | 3;
  /** Giro (0 = primo). */
  lap: number;
  /** Tempo del settore e tempo cumulato dall'inizio del giro (s). */
  dur: number;
  cum: number;
  valid: boolean;
  color: SectorColor;
}

export interface TimingLap {
  start: number;
  end: number;
  valid: boolean;
  /** 'push' o 'race' contano per il giro migliore. */
  type: 'out' | 'push' | 'in' | 'race';
}

export interface TimingRiderInfo {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  color: string;
  color2: string;
  mine: boolean;
  bike: string;
  compound: string;
  nationality: string;
}

export interface TimingModel {
  kind: 'session' | 'race';
  riders: TimingRiderInfo[];
  /** Per pilota: giri e passaggi in ordine di tempo. */
  laps: TimingLap[][];
  passes: TimingPass[][];
}

export interface TimingCell {
  state: 'empty' | 'progress' | 'done';
  color?: SectorColor;
  /** Tempo cumulato del giro al checkpoint (S4 = tempo del giro). */
  time?: number;
  /** Avanzamento nel settore in corso (0–1). */
  fill?: number;
}

export interface TimingRow {
  info: TimingRiderInfo;
  pos: number;
  best: number | null;
  lastLap: number | null;
  /** Giri completati. */
  laps: number;
  /** Distacco da chi precede e dal primo (s; null = non disponibile). */
  gapPrev: number | null;
  gapFirst: number | null;
  /** Giri di distacco dal primo (gara). */
  lapsDown: number;
  cells: TimingCell[];
  status: 'box' | 'out' | 'push' | 'in' | 'race' | 'retired' | 'finished';
}

/** Assegna i colori dei settori in ordine cronologico (migliori assoluti e personali "fino a quel momento"). */
function colorize(passes: TimingPass[][]): void {
  const all = passes.flatMap((ps, i) => ps.map((p) => ({ p, i }))).sort((a, b) => a.p.t - b.p.t);
  const overall = [Infinity, Infinity, Infinity, Infinity];
  const personal = passes.map(() => [Infinity, Infinity, Infinity, Infinity]);
  for (const { p, i } of all) {
    if (!p.valid) {
      p.color = 'slow';
      continue;
    }
    const pb = personal[i]!;
    if (p.dur <= overall[p.sector]!) p.color = 'best';
    else if (p.dur <= pb[p.sector]!) p.color = 'pb';
    else p.color = 'slow';
    overall[p.sector] = Math.min(overall[p.sector]!, p.dur);
    pb[p.sector] = Math.min(pb[p.sector]!, p.dur);
  }
}

/** Modello di una sessione a tempo (prove, qualifiche, Warm Up) dai giri calcolati dal motore. */
export function sessionModel(s: SessionTiming): TimingModel {
  const laps: TimingLap[][] = [];
  const passes: TimingPass[][] = [];
  for (const r of s.riders) {
    const L: TimingLap[] = [];
    const P: TimingPass[] = [];
    r.laps.forEach((l, k) => {
      let cum = 0;
      l.seg.forEach((d, j) => {
        cum += d;
        P.push({
          t: l.start + cum,
          sector: j as TimingPass['sector'],
          lap: k,
          dur: d,
          cum,
          valid: l.type === 'push',
          color: 'slow',
        });
      });
      L.push({ start: l.start, end: l.start + cum, valid: l.type === 'push', type: l.type });
    });
    laps.push(L);
    passes.push(P);
  }
  colorize(passes);
  return {
    kind: 'session',
    riders: s.riders.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      number: r.number,
      color: r.color,
      color2: r.color2,
      mine: r.mine,
      bike: r.bike,
      compound: r.compound,
      nationality: r.nationality,
    })),
    laps,
    passes,
  };
}

/** Stato di ogni pilota all'istante t in una sessione a tempo; classifica per giro migliore. */
export function sessionRows(m: TimingModel, t: number): TimingRow[] {
  const rows = m.riders.map((info, i) => {
    const L = m.laps[i]!;
    const P = m.passes[i]!;
    const done = L.filter((l) => l.end <= t);
    const valid = done.filter((l) => l.valid).map((l) => l.end - l.start);
    const best = valid.length ? Math.min(...valid) : null;
    const cur = L.findIndex((l) => l.start <= t && t < l.end);
    const shownLap = cur >= 0 ? cur : done.length - 1;
    const cells = cellsFor(P, shownLap, t, L[shownLap]?.start ?? 0);
    const last = done.at(-1);
    return {
      info,
      pos: 0,
      best,
      lastLap: last ? last.end - last.start : null,
      laps: done.length,
      gapPrev: null as number | null,
      gapFirst: null as number | null,
      lapsDown: 0,
      cells,
      status: (cur >= 0 ? L[cur]!.type : 'box') as TimingRow['status'],
    };
  });
  rows.sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity) || a.info.number - b.info.number);
  const first = rows[0]?.best ?? null;
  rows.forEach((r, k) => {
    r.pos = k + 1;
    if (r.best !== null && first !== null && k > 0) {
      r.gapFirst = r.best - first;
      const prev = rows[k - 1]!.best;
      r.gapPrev = prev !== null ? r.best - prev : null;
    }
  });
  return rows;
}

function cellsFor(P: TimingPass[], lap: number, t: number, lapStart: number): TimingCell[] {
  const cells: TimingCell[] = [0, 1, 2, 3].map(() => ({ state: 'empty' }));
  if (lap < 0) return cells;
  let prevT = lapStart;
  let lastDone = -1;
  for (const p of P) {
    if (p.lap !== lap) continue;
    if (p.t <= t) {
      cells[p.sector] = { state: 'done', color: p.color, time: p.cum };
      prevT = p.t;
      lastDone = p.sector;
    } else {
      cells[p.sector] = { state: 'progress', fill: Math.max(0, Math.min(1, (t - prevT) / p.dur)) };
      return cells;
    }
  }
  // Passaggio non ancora calcolato (gara in diretta): stima dal settore del giro precedente.
  const next = lastDone + 1;
  if (next <= 3 && t >= prevT) {
    const est = P.find((p) => p.lap === lap - 1 && p.sector === next)?.dur ?? 30;
    cells[next] = { state: 'progress', fill: Math.min(0.97, (t - prevT) / est) };
  }
  return cells;
}

// ---------------------------------------------------------------------------------------------
/**
 * Cronometraggio della gara ricavato dalle distanze della simulazione (fotogrammi): istante in cui ogni pilota
 * passa ai checkpoint. Incrementale: in diretta elabora solo i fotogrammi nuovi.
 */
export class RaceTiming {
  readonly model: TimingModel;
  private next: number[];
  private lastCross: number[];
  private lapStart: number[];
  private frame = 0;
  private targets: number[];

  private data: ReplayData;

  constructor(data: ReplayData) {
    this.data = data;
    const n = data.riders.length;
    const f = [...data.timingSectors, 1];
    this.targets = f.map((x) => x * data.lengthM);
    this.next = new Array(n).fill(0);
    this.lastCross = new Array(n).fill(0);
    this.lapStart = new Array(n).fill(0);
    this.model = {
      kind: 'race',
      riders: data.riders.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        number: r.number,
        color: r.color,
        color2: r.color2,
        mine: r.mine,
        bike: r.bike,
        compound: r.compound,
        nationality: r.nationality,
      })),
      laps: data.riders.map(() => []),
      passes: data.riders.map(() => []),
    };
  }

  /** Elabora i fotogrammi arrivati dall'ultima chiamata e ricolora i settori. */
  update(frames: number[][]): this {
    if (frames.length <= this.frame + 1) return this;
    const dt = this.data.frameEvery;
    const L = this.data.lengthM;
    for (let i = Math.max(1, this.frame + 1); i < frames.length; i++) {
      const a = frames[i - 1]!,
        b = frames[i]!;
      for (let n = 0; n < a.length; n++) {
        const d0 = a[n]!,
          d1 = b[n]!;
        if (d0 < 0 || d1 < 0 || d1 <= d0) continue;
        for (;;) {
          const c = this.next[n]!;
          const lap = Math.floor(c / 4);
          if (lap >= this.data.laps) break;
          const target = lap * L + this.targets[c % 4]!;
          if (d1 < target) break;
          const tt = (i - 1 + (target - d0) / (d1 - d0)) * dt;
          const sector = (c % 4) as TimingPass['sector'];
          const dur = tt - this.lastCross[n]!;
          this.model.passes[n]!.push({
            t: tt,
            sector,
            lap,
            dur,
            cum: tt - this.lapStart[n]!,
            // Il primo settore parte da fermo: non conta per i migliori.
            valid: !(lap === 0 && sector === 0),
            color: 'slow',
          });
          if (sector === 3) {
            this.model.laps[n]!.push({ start: this.lapStart[n]!, end: tt, valid: lap > 0, type: 'race' });
            this.lapStart[n] = tt;
          }
          this.lastCross[n] = tt;
          this.next[n] = c + 1;
        }
      }
    }
    this.frame = frames.length - 1;
    colorize(this.model.passes);
    return this;
  }

  /**
   * Righe all'istante t, nell'ordine della classifica in pista (`order`: indici dei piloti dalla vista gara).
   * Distacchi misurati all'ultimo checkpoint in comune, come nei monitor dei tempi.
   */
  rows(t: number, order: number[], retired: Set<number>, finished: Set<number>): TimingRow[] {
    const m = this.model;
    const crossed = (n: number) => {
      const P = m.passes[n]!;
      let k = 0;
      while (k < P.length && P[k]!.t <= t) k++;
      return k;
    };
    const counts = m.riders.map((_, n) => crossed(n));
    // Ordine del cronometraggio: più checkpoint passati, poi chi ci è passato prima (come i monitor dei tempi).
    // Prima del primo checkpoint vale l'ordine in pista; i ritirati in fondo.
    const lastT = (n: number) => (counts[n]! > 0 ? m.passes[n]![counts[n]! - 1]!.t : Infinity);
    const track = new Map(order.map((n, k) => [n, k]));
    const sorted = [...order].sort(
      (a, b) =>
        Number(retired.has(a)) - Number(retired.has(b)) ||
        counts[b]! - counts[a]! ||
        lastT(a) - lastT(b) ||
        track.get(a)! - track.get(b)!,
    );
    order = sorted;
    const leader = order[0] ?? 0;
    return order.map((n, k) => {
      const P = m.passes[n]!;
      const c = counts[n]!;
      const done = m.laps[n]!.filter((l) => l.end <= t);
      const valid = done.filter((l) => l.valid).map((l) => l.end - l.start);
      const curLap = Math.floor(c / 4);
      // A gara finita resta visibile l'ultimo giro completo.
      const shown = Math.min(curLap, this.data.laps - 1);
      const lapStart =
        shown === curLap ? (curLap === 0 ? 0 : (done.at(-1)?.end ?? 0)) : (done.at(-1)?.start ?? 0);
      const gapAt = (other: number) => {
        if (c === 0) return null;
        const mine = P[c - 1]!;
        const theirs = m.passes[other]![c - 1];
        return theirs && theirs.t <= t ? mine.t - theirs.t : null;
      };
      const lapsDown = Math.max(0, Math.floor((counts[leader]! - c) / 4));
      return {
        info: m.riders[n]!,
        pos: k + 1,
        best: valid.length ? Math.min(...valid) : null,
        lastLap: done.length ? done.at(-1)!.end - done.at(-1)!.start : null,
        laps: done.length,
        gapFirst: k === 0 ? null : gapAt(leader),
        gapPrev: k === 0 ? null : gapAt(order[k - 1]!),
        lapsDown,
        cells: retired.has(n)
          ? [0, 1, 2, 3].map(() => ({ state: 'empty' as const }))
          : cellsFor(P, shown, t, lapStart),
        status: retired.has(n) ? 'retired' : finished.has(n) ? 'finished' : 'race',
      };
    });
  }
}

/** Tempo sul giro: 1'57.430 · 57.430. */
export function fmtLap(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m > 0 ? `${m}'${r.toFixed(3).padStart(6, '0')}` : r.toFixed(3);
}
/** Distacco: 0.076 · 1.405 · 12.3 */
export function fmtGap(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return '';
  return s >= 60 ? fmtLap(s) : s.toFixed(3);
}
