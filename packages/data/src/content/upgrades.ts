import type { CategoryTier } from '../schema/world.ts';
import type { PartKey } from '../schema/upgrades.ts';

/**
 * Componenti potenziabili. Ogni livello aggiunge `bike` alla qualità della moto (scala 0–1, usata dal motore di
 * gara: prestazione = 0,6 × pilota + 0,4 × moto) e gli eventuali effetti specifici.
 * Esempio: +0,012 di moto = +0,48 punti di prestazione ≈ −0,03% sul tempo sul giro (≈ 0,035 s su 2 minuti).
 */
export interface PartContent {
  key: PartKey;
  name: string;
  /** Spiegazione in parole semplici per chi non è esperto. */
  what: string;
  effect: string;
  bike: number;
  reliability?: number;
  tyreCare?: number;
  /** Colore con cui il componente si illumina sul disegno quando è potenziato. */
  color: string;
}

export const PARTS: PartContent[] = [
  {
    key: 'engine',
    name: 'Motore',
    what: 'Più cavalli: più velocità sui rettilinei.',
    effect: 'velocità di punta',
    bike: 0.02,
    color: '#e5484d',
  },
  {
    key: 'brakes',
    name: 'Freni',
    what: 'Dischi e pinze più potenti: si frena più tardi prima delle curve.',
    effect: 'staccate',
    bike: 0.012,
    color: '#f59e0b',
  },
  {
    key: 'suspension',
    name: 'Sospensioni',
    what: 'Forcella e ammortizzatore migliori: moto più stabile e gomme che si consumano meno.',
    effect: 'stabilità e gomme',
    bike: 0.01,
    tyreCare: 0.05,
    color: '#ffd21f',
  },
  {
    key: 'chassis',
    name: 'Telaio',
    what: 'Telaio più rigido e leggero: la moto entra meglio in curva.',
    effect: 'percorrenza in curva',
    bike: 0.012,
    color: '#a78bfa',
  },
  {
    key: 'aero',
    name: 'Aerodinamica',
    what: 'Carena e alette studiate in galleria del vento: meno resistenza, più aderenza.',
    effect: 'velocità e aderenza',
    bike: 0.012,
    color: '#2dd4bf',
  },
  {
    key: 'electronics',
    name: 'Elettronica',
    what: 'Centralina e controllo di trazione aggiornati: meno guasti, uscite di curva più pulite.',
    effect: 'affidabilità e trazione',
    bike: 0.006,
    reliability: 0.025,
    color: '#60a5fa',
  },
  {
    key: 'exhaust',
    name: 'Scarico',
    what: 'Scarico in titanio più leggero: qualche cavallo in più.',
    effect: 'potenza',
    bike: 0.006,
    color: '#d4d4d8',
  },
];

/** Costo del livello 1 per categoria; il livello n costa n volte tanto. */
export const UPGRADE_BASE_COST: Record<CategoryTier, number> = {
  premier: 900_000,
  intermediate: 180_000,
  lightweight: 70_000,
  rookies: 0,
};

/** Offerte degli sponsor con obiettivo: moltiplicatori rispetto alla rata di base della squadra. */
export const SPONSOR_DEAL_RISK = {
  safe: { label: 'Prudente', monthly: 0.15, bonus: 1.0, slack: 2 },
  balanced: { label: 'Equilibrata', monthly: 0.3, bonus: 2.5, slack: 0 },
  ambitious: { label: 'Ambiziosa', monthly: 0.55, bonus: 5.0, slack: -2 },
} as const;

/**
 * Tempi di produzione in fabbrica (giorni) per livello 1, 2, 3. Si moltiplicano per il fattore della fabbrica:
 * 1,3 − 0,1 × livello medio dei reparti tecnici (motore, telaio, aerodinamica, elettronica), fra 0,7 e 1,3.
 */
export const UPGRADE_LEAD_DAYS: Record<PartKey, [number, number, number]> = {
  engine: [21, 28, 35],
  brakes: [10, 14, 18],
  suspension: [12, 16, 21],
  chassis: [21, 28, 35],
  aero: [14, 21, 28],
  electronics: [10, 14, 18],
  exhaust: [7, 10, 14],
};
