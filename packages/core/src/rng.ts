/**
 * Generatore pseudo-casuale deterministico (ADR-0002, ARCHITECTURE.md §3.3).
 *
 * Algoritmo: SFC32 (Small Fast Counting, Chris Doty-Humphrey), stato di 128 bit.
 * Seme: stringa → 4 parole a 32 bit con l'hash cyrb128.
 * Stesso seme + stessa sequenza di chiamate ⇒ stessi numeri, su ogni piattaforma.
 * Lo stato è serializzabile (`getState` / `fromState`) per salvataggi e replay.
 */

export type RngState = readonly [number, number, number, number];

/** cyrb128: hash a 128 bit di una stringa (4 interi senza segno a 32 bit). */
export function cyrb128(str: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  /** Valore gaussiano già calcolato dal metodo polare (secondo valore della coppia). */
  private spareNormal: number | null = null;

  private constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  /** Crea un generatore da un seme testuale. Scarta i primi 15 valori per mescolare lo stato. */
  static fromSeed(seed: string): Rng {
    const rng = new Rng(cyrb128(seed));
    for (let i = 0; i < 15; i++) rng.nextUint32();
    return rng;
  }

  /** Ricrea un generatore da uno stato salvato. */
  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  getState(): RngState {
    // Il valore gaussiano in sospeso viene scartato: lo stato salvato è sempre "pulito".
    return [this.a, this.b, this.c, this.d];
  }

  /** Intero senza segno a 32 bit. */
  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Numero in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Numero reale in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Intero in [min, max] (estremi inclusi), senza distorsione modulo. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`int(${min}, ${max}): estremi non validi`);
    }
    const span = max - min + 1;
    if (span > 4294967296) throw new RangeError('int(): intervallo troppo ampio');
    const limit = 4294967296 - (4294967296 % span);
    let x: number;
    do x = this.nextUint32();
    while (x >= limit);
    return min + (x % span);
  }

  /** true con probabilità p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Variabile normale N(mean, sd) con il metodo polare di Marsaglia. */
  normal(mean = 0, sd = 1): number {
    if (this.spareNormal !== null) {
      const v = this.spareNormal;
      this.spareNormal = null;
      return mean + sd * v;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    this.spareNormal = v * m;
    return mean + sd * u * m;
  }

  /** Variabile lognormale: exp(N(mu, sigma)). Usata ad es. per la variabilità dei tempi di recupero. */
  logNormal(mu: number, sigma: number): number {
    return Math.exp(this.normal(mu, sigma));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick(): elenco vuoto');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Scelta pesata: i pesi devono essere ≥ 0 e non tutti nulli. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0 || items.length !== weights.length) {
      throw new RangeError('weightedPick(): elementi e pesi non corrispondono');
    }
    let total = 0;
    for (const w of weights) {
      if (!(w >= 0)) throw new RangeError('weightedPick(): peso negativo o non numerico');
      total += w;
    }
    if (total <= 0) throw new RangeError('weightedPick(): somma dei pesi nulla');
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i] as number;
      if (r < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Mescola una copia dell'array (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
}

/**
 * Flussi indipendenti per sottosistema derivati dal seme principale della partita.
 * Aggiungere chiamate al flusso "weather" non cambia i numeri del flusso "market".
 */
export class RngStreams {
  private readonly streams = new Map<string, Rng>();
  private readonly masterSeed: string;

  constructor(masterSeed: string, saved?: Readonly<Record<string, RngState>>) {
    this.masterSeed = masterSeed;
    if (saved) {
      for (const [name, state] of Object.entries(saved)) this.streams.set(name, Rng.fromState(state));
    }
  }

  get(name: string): Rng {
    let rng = this.streams.get(name);
    if (!rng) {
      rng = Rng.fromSeed(`${this.masterSeed}::${name}`);
      this.streams.set(name, rng);
    }
    return rng;
  }

  /** Stato di tutti i flussi creati, per il salvataggio. */
  snapshot(): Record<string, RngState> {
    const out: Record<string, RngState> = {};
    for (const [name, rng] of [...this.streams.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      out[name] = rng.getState();
    }
    return out;
  }
}
