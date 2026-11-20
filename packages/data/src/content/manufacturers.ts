/** Costruttori originali (GDD §2). `strength` 0–100 guida le prestazioni iniziali delle moto. */
import type { CategoryTier } from '../schema/world.ts';

export interface ManufacturerContent {
  key: string;
  name: string;
  country: string;
  categories: CategoryTier[];
  strength: number;
  philosophy: string;
}

export const MANUFACTURERS: ManufacturerContent[] = [
  {
    key: 'ardena',
    name: 'Ardena',
    country: 'ITA',
    categories: ['premier'],
    strength: 88,
    philosophy: 'Motore potente e aerodinamica avanzata; consumo gomme elevato',
  },
  {
    key: 'hoshiro',
    name: 'Hoshiro',
    country: 'JPN',
    categories: ['premier', 'lightweight'],
    strength: 84,
    philosophy: 'Equilibrio e grande affidabilità; sviluppo prudente',
  },
  {
    key: 'takaido',
    name: 'Takaido',
    country: 'JPN',
    categories: ['premier', 'lightweight'],
    strength: 79,
    philosophy: 'Agilità e velocità di percorrenza; poca potenza',
  },
  {
    key: 'vohrmann',
    name: 'Vohrmann',
    country: 'AUT',
    categories: ['premier'],
    strength: 81,
    philosophy: 'Telaio rigido e frenata eccellente; moto difficile da guidare',
  },
  {
    key: 'corvane',
    name: 'Corvane',
    country: 'FRA',
    categories: ['premier', 'lightweight'],
    strength: 72,
    philosophy: 'Costruttore giovane con concessioni; elettronica innovativa',
  },
  {
    key: 'lysander',
    name: 'Lysander',
    country: 'GBR',
    categories: ['lightweight', 'rookies'],
    strength: 74,
    philosophy: 'Moto leggere e semplici; fornitore unico della Rookies Cup',
  },
  {
    key: 'navarra',
    name: 'Navarra Chassis',
    country: 'ESP',
    categories: ['intermediate'],
    strength: 80,
    philosophy: 'Telai in alluminio stabili in frenata',
  },
  {
    key: 'bertoldi',
    name: 'Bertoldi Telai',
    country: 'ITA',
    categories: ['intermediate'],
    strength: 77,
    philosophy: 'Telai agili, ottimi nei cambi di direzione',
  },
  {
    key: 'hollis',
    name: 'Hollis Engineering',
    country: 'GBR',
    categories: ['intermediate'],
    strength: 71,
    philosophy: 'Telai economici e facili da regolare',
  },
];
