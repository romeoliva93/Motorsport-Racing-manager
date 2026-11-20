/**
 * Creazione di una squadra nuova da parte del giocatore (GDD §3.2).
 *
 * La squadra entra nella categoria scelta con identità, tipologia, costruttore, budget, strutture e uno staff
 * tecnico di partenza (direttore tecnico, due capotecnici, due ingegneri di pista, meccanici…). I due posti in
 * griglia partono vuoti: i piloti si ingaggiano dal mercato prima dell'inizio del campionato.
 */
import { GameCalendar, clamp, type IdFactory, type Rng } from '@lean-angle/core';
import type { GameState } from '../schema/state.ts';
import type { CategoryTier } from '../schema/world.ts';
import type { StaffMember, StaffRole } from '../schema/people.ts';
import type { ManufacturerId, TeamId, TeamType } from '../schema/org.ts';
import { FACILITY_TYPES } from '../schema/tech.ts';
import { insert, rows } from '../tables.ts';
import {
  FACILITY_LEVELS,
  NAMES,
  OPENING_BALANCE,
  STAFF_BASE_SALARY,
  STAFF_NATIONALITY_WEIGHTS,
  STAFF_QUALITY,
  STAFF_SALARY_SCALE,
  STAFF_SKILLS,
  STAFF_SPECIALIZATION,
  isBlockedSurname,
} from '../content/index.ts';

export type CustomTeamType = Extract<TeamType, 'private' | 'independent' | 'satellite'>;

export interface CustomTeamOptions {
  name: string;
  shortName: string;
  nationality: string;
  baseCity: string;
  colors: { primary: string; secondary: string };
  type: CustomTeamType;
  tier: Exclude<CategoryTier, 'rookies'>;
  manufacturerId: ManufacturerId;
}

/** Forza iniziale dello staff in base alla tipologia (una squadra nuova parte sotto la media). */
const STAFF_SHIFT: Record<CustomTeamType, number> = { private: -8, independent: -5, satellite: -2 };

export function validateCustomTeam(state: GameState, o: CustomTeamOptions): string | null {
  const name = o.name.trim();
  if (name.length < 3 || name.length > 40) return 'Il nome della squadra deve avere fra 3 e 40 caratteri';
  if (!/^[A-Z0-9]{2,4}$/.test(o.shortName)) return 'La sigla deve avere da 2 a 4 lettere maiuscole o cifre';
  if (rows(state, 'teams').some((t) => t.name.toLowerCase() === name.toLowerCase()))
    return 'Esiste già una squadra con questo nome';
  if (rows(state, 'teams').some((t) => t.shortName === o.shortName))
    return "Sigla già usata da un'altra squadra";
  if (!NAMES[o.nationality]) return 'Nazionalità non disponibile';
  if (o.baseCity.trim().length < 2) return 'Indica la sede della squadra';
  for (const c of [o.colors.primary, o.colors.secondary])
    if (!/^#[0-9a-f]{6}$/i.test(c)) return 'Colori non validi';
  const cat = rows(state, 'categories').find((c) => c.tier === o.tier);
  if (!cat || !cat.teamsManaged) return 'Categoria non disponibile';
  const mfr = state.tables.manufacturers[o.manufacturerId];
  if (!mfr || !mfr.categories.includes(cat.id))
    return 'Il costruttore scelto non fornisce moto per questa categoria';
  if (!OPENING_BALANCE[o.tier][o.type]) return 'Tipologia non disponibile in questa categoria';
  return null;
}

export function createCustomTeam(state: GameState, o: CustomTeamOptions, ids: IdFactory, rng: Rng): TeamId {
  const err = validateCustomTeam(state, o);
  if (err) throw new Error(err);
  const cal = new GameCalendar(state.meta.startYear);
  const year = cal.toDate(state.meta.currentDay).year;
  const cat = rows(state, 'categories').find((c) => c.tier === o.tier)!;
  const season = rows(state, 'seasons').find((s) => s.categoryId === cat.id && s.year === year)!;
  const reg = state.tables.regulations[season.regulationId]!;
  const round1000 = (x: number) => Math.round(x / 1000) * 1000;
  const rating = (x: number) => Math.round(clamp(x, 1, 99));

  const teamId = ids.next('tem') as TeamId;
  insert(state, 'teams', {
    id: teamId,
    name: o.name.trim(),
    shortName: o.shortName,
    nationality: o.nationality,
    baseCity: o.baseCity.trim(),
    founded: year,
    type: o.type,
    colors: { primary: o.colors.primary, secondary: o.colors.secondary },
    reputation: o.type === 'satellite' ? 45 : o.type === 'independent' ? 38 : 30,
    owner: { kind: 'private', name: 'Team Principal (giocatore)' },
  });
  const [lo, hi] = OPENING_BALANCE[o.tier][o.type]!;
  state.accounts.push({
    teamId,
    openingBalance: round1000((lo + hi) / 2),
    creditLimit: round1000(lo * 0.25),
  });
  const [fLo] = FACILITY_LEVELS[o.type];
  for (const type of FACILITY_TYPES) {
    const level = clamp(fLo + (o.tier === 'premier' ? 0 : -1) + (rng.chance(0.25) ? 1 : 0), 1, 5) as
      1 | 2 | 3 | 4 | 5;
    insert(state, 'facilities', { id: ids.next('fac'), teamId, type, level });
  }

  // Numeri di gara liberi nella categoria.
  const used = new Set(
    rows(state, 'teamEntries')
      .filter((e) => e.seasonId === season.id)
      .flatMap((e) => e.seats.map((s) => s.number)),
  );
  const free = Array.from({ length: 98 }, (_, i) => i + 2).filter((n) => !used.has(n));
  const n1 = rng.pick(free);
  const n2 = rng.pick(free.filter((n) => n !== n1));
  insert(state, 'teamEntries', {
    id: ids.next('ent'),
    teamId,
    categoryId: cat.id,
    seasonId: season.id,
    manufacturerId: o.manufacturerId,
    seats: [
      { number: n1, riderId: null },
      { number: n2, riderId: null },
    ],
  });

  // Staff di partenza.
  const usedNames = new Set(
    [...rows(state, 'riders'), ...rows(state, 'staff')].map((p) => `${p.firstName} ${p.lastName}`),
  );
  const baseQ = STAFF_QUALITY[o.tier] + STAFF_SHIFT[o.type];
  const hire = (role: StaffRole, q: number) => {
    const keys = Object.keys(STAFF_NATIONALITY_WEIGHTS).sort();
    const nat = rng.weightedPick(
      keys,
      keys.map((k) => STAFF_NATIONALITY_WEIGHTS[k] as number),
    );
    const pool = NAMES[nat]!;
    let first = '';
    let last = '';
    for (let i = 0; i < 200; i++) {
      first = rng.pick(rng.chance(0.2) && pool.female.length ? pool.female : pool.male);
      last = rng.pick(pool.last);
      if (!usedNames.has(`${first} ${last}`) && !isBlockedSurname(last)) break;
    }
    usedNames.add(`${first} ${last}`);
    const age = rng.int(role === 'mechanic' ? 22 : 28, role === 'technicalDirector' ? 60 : 55);
    const birthDay = cal.fromDate({ year: year - age - 1, month: 1, day: 2 }) + rng.int(0, 360);
    const quality = q + rng.normal(0, 4);
    const m: StaffMember = {
      id: ids.next('stf'),
      firstName: first,
      lastName: last,
      nationality: nat,
      birthDay,
      reputation: rating(quality * 0.8),
      morale: rng.int(65, 85),
      personality: {
        ambition: rng.int(30, 95),
        loyalty: rng.int(25, 90),
        temperament: rng.int(20, 90),
        professionalism: rng.int(40, 95),
        mediaSavvy: rng.int(20, 90),
      },
      status: 'active',
      role,
      specialization: STAFF_SPECIALIZATION[role] ?? 'management',
      skills: Object.fromEntries(
        (STAFF_SKILLS[role] ?? ['skill']).map((k) => [k, rating(quality + rng.normal(0, 6))]),
      ),
      experienceYears: Math.max(0, age - 24),
      potential: rating(quality + Math.max(0, 40 - age) * 0.5),
    };
    insert(state, 'staff', m);
    insert(state, 'contracts', {
      id: ids.next('ctr'),
      kind: 'staff',
      employerId: teamId,
      counterpartyId: m.id,
      startDay: state.meta.currentDay,
      endDay: cal.fromDate({ year: year + 1, month: 12, day: 31 }),
      salary: round1000(
        (STAFF_BASE_SALARY[role] ?? 100_000) *
          STAFF_SALARY_SCALE[o.tier] *
          Math.pow(1.05, quality - STAFF_QUALITY[o.tier]),
      ),
      bonuses: [],
      role,
      status: 'active',
    });
  };
  hire('technicalDirector', baseQ + 3);
  hire('sportingDirector', baseQ);
  if (o.tier !== 'lightweight') {
    hire('strategyChief', baseQ);
    hire('physio', baseQ);
  }
  for (let seat = 0; seat < 2; seat++) {
    hire('crewChief', baseQ);
    hire('trackEngineer', baseQ);
    for (let m = 0; m < (o.tier === 'premier' ? 3 : 2); m++) hire('mechanic', baseQ - 4);
    // Moto pronte per il pilota che verrà ingaggiato (A/B solo dove il regolamento lo prevede).
    for (const slot of reg.bikesPerRider === 2 ? (['A', 'B'] as const) : (['A'] as const)) {
      insert(state, 'bikes', {
        id: ids.next('bik'),
        teamId,
        riderId: null,
        categoryId: cat.id,
        slot,
        label: slot === 'A' ? 'reference' : 'experimental',
        components: {},
        mileageKm: 0,
        wear: 0,
        readiness: 1,
        availability: 'ready',
      });
    }
  }
  return teamId;
}
