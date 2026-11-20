/**
 * Personaggi scritti a mano presenti nella documentazione di design (GDD, mockup, REGULATIONS.md).
 * Il generatore li inserisce nelle rispettive squadre; il resto del mondo è generato dal seme.
 * `quality` = livello medio degli attributi (1–100); gli attributi effettivi variano attorno a questo valore.
 */
export interface PresetRider {
  team: string;
  firstName: string;
  lastName: string;
  nationality: string;
  birth: [number, number, number];
  number: number;
  quality: number;
  potential: number;
  style: RidingStyle;
  /** Staff tecnico assegnato (capotecnico, ingegnere di pista). */
  crewChief: PresetStaff;
  trackEngineer: PresetStaff;
}

export interface PresetStaff {
  firstName: string;
  lastName: string;
  nationality: string;
  birthYear: number;
  quality: number;
  /** Stagioni già passate insieme al pilota (influenza la comprensione dello stile). */
  seasonsWithRider: number;
}

export type RidingStyle = 'braker' | 'flowing' | 'aggressive' | 'technical' | 'allRounder';

export const PRESET_RIDERS: PresetRider[] = [
  {
    team: 'lupo-blu',
    firstName: 'Teo',
    lastName: 'Varriale',
    nationality: 'ITA',
    birth: [2002, 6, 14],
    number: 27,
    quality: 82,
    potential: 89,
    style: 'braker',
    crewChief: {
      firstName: 'Marco',
      lastName: 'Doria',
      nationality: 'ITA',
      birthYear: 1976,
      quality: 82,
      seasonsWithRider: 4,
    },
    trackEngineer: {
      firstName: 'Anja',
      lastName: 'Kessler',
      nationality: 'AUT',
      birthYear: 1993,
      quality: 75,
      seasonsWithRider: 2,
    },
  },
  {
    team: 'lupo-blu',
    firstName: 'Rafa',
    lastName: 'Oyarzún',
    nationality: 'ESP',
    birth: [2005, 9, 3],
    number: 61,
    quality: 76,
    potential: 86,
    style: 'flowing',
    crewChief: {
      firstName: 'Franco',
      lastName: 'Cattaneo',
      nationality: 'ITA',
      birthYear: 1981,
      quality: 77,
      seasonsWithRider: 1,
    },
    trackEngineer: {
      firstName: 'Karl',
      lastName: 'Lindqvist',
      nationality: 'SWE',
      birthYear: 1988,
      quality: 70,
      seasonsWithRider: 1,
    },
  },
  {
    team: 'lupo-blu-junior',
    firstName: 'Fabrizio',
    lastName: 'Vitellino',
    nationality: 'ITA',
    birth: [2010, 4, 21],
    number: 44,
    quality: 63,
    potential: 90,
    style: 'aggressive',
    crewChief: {
      firstName: 'Fabio',
      lastName: 'Gallo',
      nationality: 'ITA',
      birthYear: 1979,
      quality: 68,
      seasonsWithRider: 0,
    },
    trackEngineer: {
      firstName: 'Giulia',
      lastName: 'Lanfranchi',
      nationality: 'ITA',
      birthYear: 2000,
      quality: 60,
      seasonsWithRider: 0,
    },
  },
  {
    team: 'lupo-blu-junior',
    firstName: 'Noa',
    lastName: 'Lindgren',
    nationality: 'SWE',
    birth: [2008, 11, 2],
    number: 9,
    quality: 61,
    potential: 79,
    style: 'technical',
    crewChief: {
      firstName: 'Ivan',
      lastName: 'Pellizzari',
      nationality: 'ITA',
      birthYear: 1984,
      quality: 64,
      seasonsWithRider: 1,
    },
    trackEngineer: {
      firstName: 'Emil',
      lastName: 'Kjær',
      nationality: 'DEN',
      birthYear: 1995,
      quality: 62,
      seasonsWithRider: 1,
    },
  },
];
