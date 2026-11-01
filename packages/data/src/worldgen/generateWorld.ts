/**
 * Generatore del mondo iniziale (ROADMAP M1.4).
 *
 * Dal seme della partita crea, in modo deterministico: federazione, categorie e regolamenti, stagioni e
 * calendario, circuiti, costruttori, squadre e iscrizioni, piloti (titolari, collaudatori, liberi, riserve
 * Rookies, accademia), staff tecnico con contratti e assegnazioni, rapporti pilota-staff, moto (A/B solo
 * dove previsto), strutture, conti e sponsor.
 *
 * Nessun risultato sportivo viene deciso qui: la "forza" delle squadre influenza solo l'assegnazione
 * iniziale di piloti, staff e budget. Le prestazioni emergeranno dalla simulazione.
 */
import { GameCalendar, IdFactory, RngStreams, clamp, type Rng } from '@lean-angle/core';
import { createEmptyGameState, type GameState } from '../schema/state.ts';
import type { CategoryId, CategoryTier, Regulation, SeasonId } from '../schema/world.ts';
import type {
  Rider,
  RiderAttribute,
  RiderId,
  RiderRole,
  StaffId,
  StaffMember,
  StaffRole,
} from '../schema/people.ts';
import { RIDER_ATTRIBUTES } from '../schema/people.ts';
import type { ManufacturerId, Seat, TeamId, TeamType } from '../schema/org.ts';
import type { Bike } from '../schema/tech.ts';
import { FACILITY_TYPES } from '../schema/tech.ts';
import { insert } from '../tables.ts';
import {
  CATEGORIES,
  CIRCUITS,
  MANUFACTURERS,
  NAMES,
  PRESET_RIDERS,
  RIDER_NATIONALITY_WEIGHTS,
  SPONSORS,
  STAFF_NATIONALITY_WEIGHTS,
  STAFF_SKILLS,
  STAFF_SPECIALIZATION,
  TEAMS,
  isBlockedSurname,
  type PresetStaff,
  type RidingStyle,
  type TeamContent,
} from '../content/index.ts';

export interface WorldOptions {
  seed: string;
  startYear?: number;
  saveName?: string;
  difficulty?: GameState['meta']['difficulty'];
}

/** Scostamenti degli attributi per stile di guida (sommati alla qualità del pilota). */
const STYLE_BIAS: Record<RidingStyle, Partial<Record<RiderAttribute, number>>> = {
  braker: { braking: 6, cornerEntry: 5, overtaking: 3, tyreManagement: -4, aggression: 3 },
  flowing: { racePace: 5, tyreManagement: 5, consistency: 4, cornerEntry: -2, aggression: -4 },
  aggressive: { overtaking: 6, aggression: 8, speed: 3, consistency: -5, concentration: -3 },
  technical: { technicalFeedback: 8, adaptability: 4, consistency: 3, overtaking: -3 },
  allRounder: {},
};
const STYLES: RidingStyle[] = ['braker', 'flowing', 'aggressive', 'technical', 'allRounder'];

/** Stipendio annuo base del titolare medio, per categoria. */
const BASE_SALARY: Record<CategoryTier, number> = {
  premier: 1_500_000,
  intermediate: 250_000,
  lightweight: 80_000,
  rookies: 0,
};

/** Budget iniziale (min–max) per tipo di squadra e categoria. */
const OPENING_BALANCE: Record<CategoryTier, Partial<Record<TeamType, [number, number]>>> = {
  premier: {
    factory: [60_000_000, 90_000_000],
    satellite: [25_000_000, 40_000_000],
    independent: [15_000_000, 25_000_000],
    private: [10_000_000, 15_000_000],
  },
  intermediate: { independent: [5_000_000, 8_000_000], private: [3_500_000, 5_500_000] },
  lightweight: {
    factory: [4_000_000, 6_000_000],
    independent: [2_500_000, 4_000_000],
    private: [1_800_000, 2_800_000],
  },
  rookies: {},
};

const FACILITY_LEVELS: Record<TeamType, [number, number]> = {
  factory: [3, 5],
  satellite: [2, 4],
  independent: [2, 3],
  private: [1, 2],
  newManufacturer: [2, 4],
  organizer: [1, 1],
};

/** Qualità media dello staff per categoria (1–100). */
const STAFF_QUALITY: Record<CategoryTier, number> = {
  premier: 72,
  intermediate: 64,
  lightweight: 58,
  rookies: 50,
};

const round1000 = (x: number) => Math.round(x / 1000) * 1000;
const rating = (x: number) => Math.round(clamp(x, 1, 99));

export function generateWorld(opts: WorldOptions): GameState {
  const startYear = opts.startYear ?? 2027;
  const streams = new RngStreams(opts.seed);
  const ids = new IdFactory();
  const cal = new GameCalendar(startYear);
  const state = createEmptyGameState({
    saveName: opts.saveName ?? 'Nuova carriera',
    seed: opts.seed,
    startYear,
    currentDay: 0,
    playerTeamId: null,
    difficulty: opts.difficulty ?? 'normal',
  });
  const endOfYear = (y: number) => cal.fromDate({ year: y, month: 12, day: 31 });
  const usedNames = new Set<string>();
  /** Cognomi dei personaggi scritti a mano: non riutilizzati per i personaggi generati. */
  const presetSurnames = new Set(
    PRESET_RIDERS.flatMap((p) => [p.lastName, p.crewChief.lastName, p.trackEngineer.lastName]),
  );

  // --- Nomi --------------------------------------------------------------------------------------
  function pickNationality(rng: Rng, weights: Record<string, number>): string {
    const keys = Object.keys(weights).sort();
    return rng.weightedPick(
      keys,
      keys.map((k) => weights[k] as number),
    );
  }
  function uniqueName(
    rng: Rng,
    nationality: string,
    female: boolean,
    avoidSurnames?: Set<string>,
  ): [string, string] {
    const pool = NAMES[nationality];
    if (!pool) throw new Error(`Nessun elenco di nomi per ${nationality}`);
    for (let i = 0; i < 200; i++) {
      const first = rng.pick(female && pool.female.length > 0 ? pool.female : pool.male);
      const last = rng.pick(pool.last);
      const key = `${first} ${last}`;
      if (
        !usedNames.has(key) &&
        !isBlockedSurname(last) &&
        !presetSurnames.has(last) &&
        !avoidSurnames?.has(last)
      ) {
        usedNames.add(key);
        avoidSurnames?.add(last);
        return [first, last];
      }
    }
    throw new Error(`Nomi esauriti per ${nationality}`);
  }
  function reserveName(first: string, last: string) {
    const key = `${first} ${last}`;
    if (usedNames.has(key)) throw new Error(`Personaggio duplicato: ${key}`);
    if (isBlockedSurname(last)) throw new Error(`Cognome riservato a un pilota reale: ${last}`);
    usedNames.add(key);
  }
  function birthDayForAge(rng: Rng, age: number): number {
    // Nato fra il 2 gennaio e il 31 dicembre dell'anno (startYear - age - 1): ha `age` anni al 1° gennaio.
    return cal.fromDate({ year: startYear - age - 1, month: 1, day: 2 }) + rng.int(0, 360);
  }
  const personality = (rng: Rng) => ({
    ambition: rng.int(30, 95),
    loyalty: rng.int(25, 90),
    temperament: rng.int(20, 90),
    professionalism: rng.int(40, 95),
    mediaSavvy: rng.int(20, 90),
  });

  // I nomi dei personaggi scritti a mano sono prenotati prima di generare gli altri.
  for (const p of PRESET_RIDERS) {
    reserveName(p.firstName, p.lastName);
    reserveName(p.crewChief.firstName, p.crewChief.lastName);
    reserveName(p.trackEngineer.firstName, p.trackEngineer.lastName);
  }

  // --- Federazione, circuiti, costruttori --------------------------------------------------------
  insert(state, 'federations', {
    id: ids.next('fed'),
    name: 'International Velocity Federation',
    acronym: 'IVF',
  });
  const circuitIds = CIRCUITS.map((c) => {
    const id = ids.next('cir');
    insert(state, 'circuits', {
      id,
      name: c.name,
      country: c.country,
      lengthM: c.lengthM,
      turns: c.turns,
      abrasiveness: c.abrasiveness,
      overtaking: c.overtaking,
    });
    return id;
  });
  const mfrIds = new Map<string, ManufacturerId>();
  for (const m of MANUFACTURERS) {
    const id = ids.next('mfr');
    mfrIds.set(m.key, id);
    insert(state, 'manufacturers', {
      id,
      name: m.name,
      country: m.country,
      categories: [],
      engineeringStrength: m.strength,
      philosophy: m.philosophy,
    });
  }

  // --- Categorie, regolamenti, stagioni, calendario ----------------------------------------------
  const catIds = new Map<CategoryTier, CategoryId>();
  const seasonIds = new Map<CategoryTier, SeasonId>();
  const regs = new Map<CategoryTier, Regulation>();
  for (const c of CATEGORIES) {
    const catId = ids.next('cat');
    catIds.set(c.key, catId);
    insert(state, 'categories', {
      id: catId,
      tier: c.key,
      name: c.name,
      maxGrid: c.maxGrid,
      teamsManaged: c.teamsManaged,
    });
    const reg: Regulation = {
      id: ids.next('reg'),
      categoryId: catId,
      season: startYear,
      ...(JSON.parse(JSON.stringify(c.regulation)) as typeof c.regulation),
    };
    regs.set(c.key, reg);
    insert(state, 'regulations', reg);
    const seasonId = ids.next('ssn');
    seasonIds.set(c.key, seasonId);
    const roundIdx = c.rounds ?? CIRCUITS.map((_, i) => i);
    const roundIds = roundIdx.map((ci, n) => {
      const id = ids.next('rnd');
      const circuit = CIRCUITS[ci];
      if (!circuit) throw new Error(`Round ${ci} inesistente`);
      insert(state, 'rounds', {
        id,
        seasonId,
        number: n + 1,
        circuitId: circuitIds[ci] as (typeof circuitIds)[number],
        startDay: cal.fromDate({ year: startYear, month: circuit.date[0], day: circuit.date[1] }),
      });
      return id;
    });
    insert(state, 'seasons', {
      id: seasonId,
      year: startYear,
      categoryId: catId,
      regulationId: reg.id,
      roundIds,
      status: 'planned',
    });
  }
  for (const m of MANUFACTURERS) {
    const mid = mfrIds.get(m.key)!;
    state.tables.manufacturers[mid]!.categories = m.categories.map((t) => catIds.get(t)!);
  }

  // --- Sponsor -----------------------------------------------------------------------------------
  for (const s of SPONSORS)
    insert(state, 'sponsors', {
      id: ids.next('spo'),
      name: s.name,
      industry: s.industry,
      country: s.country,
      budgetRange: [s.budget[0], s.budget[1]],
    });

  // --- Squadre ----------------------------------------------------------------------------------
  const teamRng = streams.get('worldgen.teams');
  const teamIds = new Map<string, TeamId>();
  for (const t of TEAMS) {
    const id = ids.next('tem') as TeamId;
    teamIds.set(t.key, id);
    const owner =
      'manufacturer' in t.owner
        ? { kind: 'manufacturer' as const, manufacturerId: mfrIds.get(t.owner.manufacturer)! }
        : { kind: 'private' as const, name: t.owner.privateName };
    insert(state, 'teams', {
      id,
      name: t.name,
      shortName: t.shortName,
      nationality: t.nationality,
      baseCity: t.baseCity,
      founded: t.founded,
      type: t.type,
      colors: t.colors,
      reputation: rating(t.strength * 0.9 + teamRng.normal(0, 3)),
      owner,
    });
    const range = OPENING_BALANCE[t.category][t.type];
    if (range)
      state.accounts.push({
        teamId: id,
        openingBalance: round1000(teamRng.range(range[0], range[1])),
        creditLimit: round1000(range[0] * 0.25),
      });
    if (t.type !== 'organizer') {
      const [lo, hi] = FACILITY_LEVELS[t.type];
      const shift = t.category === 'premier' ? 0 : -1;
      for (const type of FACILITY_TYPES) {
        const level = clamp(teamRng.int(lo, hi) + shift, 1, 5) as 1 | 2 | 3 | 4 | 5;
        insert(state, 'facilities', { id: ids.next('fac'), teamId: id, type, level });
      }
    }
  }

  // --- Piloti -----------------------------------------------------------------------------------
  const riderRng = streams.get('worldgen.riders');
  /** Cognomi già usati dai piloti di ogni categoria: due piloti della stessa categoria non hanno lo stesso cognome. */
  const surnamesByTier = new Map<CategoryTier, Set<string>>();
  function makeRider(o: {
    first: string;
    last: string;
    nationality: string;
    birthDay: number;
    quality: number;
    potential: number;
    style: RidingStyle;
    categoryId: CategoryId | null;
    role: RiderRole;
    status?: Rider['status'];
    developmentSkill?: number;
  }): Rider {
    const bias = STYLE_BIAS[o.style];
    const attributes = Object.fromEntries(
      RIDER_ATTRIBUTES.map((a) => [a, rating(o.quality + (bias[a] ?? 0) + riderRng.normal(0, 3.5))]),
    ) as Record<RiderAttribute, number>;
    const rider: Rider = {
      id: ids.next('rdr'),
      firstName: o.first,
      lastName: o.last,
      nationality: o.nationality,
      birthDay: o.birthDay,
      reputation: rating(o.quality * 0.8 + riderRng.normal(0, 5)),
      morale: riderRng.int(55, 85),
      personality: personality(riderRng),
      status: o.status ?? 'active',
      categoryId: o.categoryId,
      role: o.role,
      attributes,
      potential: rating(Math.max(o.potential, o.quality)),
      form: 0,
      fatigue: 0,
      ...(o.developmentSkill !== undefined ? { developmentSkill: o.developmentSkill } : {}),
    };
    insert(state, 'riders', rider);
    return rider;
  }
  function randomRider(
    tier: CategoryTier,
    categoryId: CategoryId | null,
    role: RiderRole,
    qualityShift = 0,
    ageOverride?: [number, number],
  ) {
    const c = CATEGORIES.find((x) => x.key === tier)!;
    const q = clamp(
      riderRng.normal(c.riderQuality.mean + qualityShift, c.riderQuality.sd),
      c.riderQuality.min,
      c.riderQuality.max,
    );
    const [aMin, aMax] = ageOverride ?? c.riderAgeRange;
    const age = riderRng.int(aMin, aMax);
    const nationality = pickNationality(riderRng, RIDER_NATIONALITY_WEIGHTS);
    let avoid = surnamesByTier.get(tier);
    if (!avoid) surnamesByTier.set(tier, (avoid = new Set()));
    const [first, last] = uniqueName(riderRng, nationality, riderRng.chance(0.03), avoid);
    // Margine di crescita: maggiore per i più giovani (un quattordicenne può migliorare di 15–30 punti).
    const growth = Math.max(0, 28 - age) * riderRng.range(0.8, 2.2);
    return makeRider({
      first,
      last,
      nationality,
      birthDay: birthDayForAge(riderRng, age),
      quality: q,
      potential: q + growth + riderRng.normal(0, 2),
      style: riderRng.pick(STYLES),
      categoryId,
      role,
    });
  }
  function riderSalary(tier: CategoryTier, quality: number) {
    const c = CATEGORIES.find((x) => x.key === tier)!;
    return round1000(BASE_SALARY[tier] * Math.pow(1.12, quality - c.riderQuality.mean));
  }
  const avgAttr = (r: Rider) =>
    RIDER_ATTRIBUTES.reduce((s, a) => s + r.attributes[a], 0) / RIDER_ATTRIBUTES.length;
  function contract(
    kind: 'rider' | 'staff',
    teamId: TeamId,
    personId: RiderId | StaffId,
    salary: number,
    role: string,
    years: number,
  ) {
    insert(state, 'contracts', {
      id: ids.next('ctr'),
      kind,
      employerId: teamId,
      counterpartyId: personId,
      startDay: 0,
      endDay: endOfYear(startYear + years - 1),
      salary,
      bonuses:
        kind === 'rider' && salary > 0
          ? [
              { condition: 'podium', amount: round1000(salary * 0.04) },
              { condition: 'win', amount: round1000(salary * 0.1) },
            ]
          : [],
      role,
      status: 'active',
    });
  }

  // --- Staff ------------------------------------------------------------------------------------
  const staffRng = streams.get('worldgen.staff');
  function makeStaff(
    role: StaffRole,
    quality: number,
    o?: { first: string; last: string; nationality: string; birthYear: number },
  ): StaffMember {
    let first: string, last: string, nationality: string, birthDay: number;
    if (o) {
      ({ first, last, nationality } = o);
      birthDay = cal.fromDate({ year: o.birthYear, month: 1, day: 2 }) + staffRng.int(0, 360);
    } else {
      nationality = pickNationality(staffRng, STAFF_NATIONALITY_WEIGHTS);
      [first, last] = uniqueName(staffRng, nationality, staffRng.chance(role === 'mechanic' ? 0.08 : 0.22));
      const [aMin, aMax] =
        role === 'mechanic' ? [22, 55] : role === 'technicalDirector' ? [40, 64] : [26, 60];
      birthDay = birthDayForAge(staffRng, staffRng.int(aMin, aMax));
    }
    const age = cal.ageOn(birthDay, 0);
    const keys = STAFF_SKILLS[role] ?? ['skill'];
    const skills = Object.fromEntries(keys.map((k) => [k, rating(quality + staffRng.normal(0, 6))]));
    const s: StaffMember = {
      id: ids.next('stf'),
      firstName: first,
      lastName: last,
      nationality,
      birthDay,
      reputation: rating(quality * 0.85 + staffRng.normal(0, 6)),
      morale: staffRng.int(55, 85),
      personality: personality(staffRng),
      status: 'active',
      role,
      specialization: STAFF_SPECIALIZATION[role] ?? 'management',
      skills,
      experienceYears: Math.max(0, age - 23 - staffRng.int(0, 4)),
      potential: rating(quality + Math.max(0, 40 - age) * staffRng.range(0.2, 0.8)),
    };
    insert(state, 'staff', s);
    return s;
  }
  function staffSalary(role: StaffRole, tier: CategoryTier, quality: number) {
    const base: Partial<Record<StaffRole, number>> = {
      technicalDirector: 900_000,
      crewChief: 380_000,
      trackEngineer: 300_000,
      telemetryAnalyst: 140_000,
      strategyChief: 260_000,
      mechanic: 70_000,
      sportingDirector: 300_000,
      physio: 90_000,
      doctor: 160_000,
    };
    const scale: Record<CategoryTier, number> = {
      premier: 1,
      intermediate: 0.4,
      lightweight: 0.25,
      rookies: 0.2,
    };
    return round1000((base[role] ?? 100_000) * scale[tier] * Math.pow(1.05, quality - STAFF_QUALITY[tier]));
  }
  function bond(riderId: RiderId, staffId: StaffId, seasons: number) {
    const compatibility = staffRng.int(40, 88);
    const sharedSessions = seasons * 60 + staffRng.int(0, 20);
    const c0 = 0.35 + 0.25 * (compatibility / 100);
    const styleUnderstanding = Math.round(100 * (c0 + (1 - c0) * (1 - Math.exp(-sharedSessions / 120))));
    state.bonds.push({
      riderId,
      staffId,
      compatibility,
      sharedSessions,
      styleUnderstanding,
      trust: clamp(Math.round(45 + seasons * 8 + staffRng.normal(0, 8)), 1, 99),
      communication: clamp(Math.round(compatibility * 0.8 + staffRng.normal(0, 8)), 1, 99),
      satisfaction: staffRng.int(50, 85),
    });
  }

  // --- Iscrizioni: piloti titolari per categoria ------------------------------------------------
  const numberRng = streams.get('worldgen.numbers');
  for (const c of CATEGORIES) {
    const catId = catIds.get(c.key)!;
    const reg = regs.get(c.key)!;
    const teams = TEAMS.filter((t) => t.category === c.key);
    const usedNumbers = new Set<number>();
    // Numeri previsti dai documenti (personaggi scritti a mano, preferenze delle squadre): esclusi dall'estrazione casuale.
    const reservedNumbers = new Set<number>([
      ...PRESET_RIDERS.filter((p) => teams.some((t) => t.key === p.team)).map((p) => p.number),
      ...teams.flatMap((t) => t.numbers ?? []),
    ]);
    const takeNumber = (preferred?: number) => {
      if (preferred !== undefined && !usedNumbers.has(preferred)) {
        usedNumbers.add(preferred);
        return preferred;
      }
      let n: number;
      do n = numberRng.int(2, 99);
      while (usedNumbers.has(n) || reservedNumbers.has(n));
      usedNumbers.add(n);
      return n;
    };

    if (c.key === 'rookies') {
      const org = teams[0]!;
      const orgId = teamIds.get(org.key)!;
      const seats: Seat[] = [];
      for (let i = 0; i < c.maxGrid; i++) {
        const r = randomRider('rookies', catId, 'race');
        contract('rider', orgId, r.id, 0, 'rookie', 1);
        seats.push({ number: takeNumber(), riderId: r.id });
        insertBike(orgId, r.id, catId, reg);
      }
      for (let i = 0; i < 4; i++) {
        const r = randomRider('rookies', catId, 'reserve', -4);
        contract('rider', orgId, r.id, 0, 'reserve', 1);
      }
      insert(state, 'teamEntries', {
        id: ids.next('ent'),
        teamId: orgId,
        categoryId: catId,
        seasonId: seasonIds.get(c.key)!,
        manufacturerId: mfrIds.get(org.manufacturer)!,
        seats,
      });
      continue;
    }

    // Piloti scritti a mano + piloti generati, assegnati alle squadre in base alla loro forza (con rumore).
    const presetsHere = PRESET_RIDERS.filter((p) => teams.some((t) => t.key === p.team));
    const generatedCount = teams.length * 2 - presetsHere.length;
    const pool = Array.from({ length: generatedCount }, () => randomRider(c.key, catId, 'race'));
    pool.sort((a, b) => avgAttr(b) - avgAttr(a));
    const order = teams
      .map((t) => ({ t, score: t.strength + teamRng.normal(0, 6) }))
      .sort((a, b) => b.score - a.score || a.t.key.localeCompare(b.t.key));

    for (const { t } of order) {
      const teamId = teamIds.get(t.key)!;
      const seats: Seat[] = [];
      const presets = presetsHere.filter((p) => p.team === t.key);
      const riders: { rider: Rider; number?: number; cc?: PresetStaff; te?: PresetStaff }[] = presets.map(
        (p) => {
          const rider = makeRider({
            first: p.firstName,
            last: p.lastName,
            nationality: p.nationality,
            birthDay: cal.fromDate({ year: p.birth[0], month: p.birth[1], day: p.birth[2] }),
            quality: p.quality,
            potential: p.potential,
            style: p.style,
            categoryId: catId,
            role: 'race',
          });
          return { rider, number: p.number, cc: p.crewChief, te: p.trackEngineer };
        },
      );
      while (riders.length < 2) riders.push({ rider: pool.shift()! });

      const teamStaffQ = STAFF_QUALITY[c.key] + (t.strength - 70) * 0.35;
      const sq = () => teamStaffQ + staffRng.normal(0, 4);
      const hire = (role: StaffRole, q: number, preset?: PresetStaff) => {
        const s = makeStaff(
          role,
          preset ? preset.quality : q,
          preset
            ? {
                first: preset.firstName,
                last: preset.lastName,
                nationality: preset.nationality,
                birthYear: preset.birthYear,
              }
            : undefined,
        );
        contract(
          'staff',
          teamId,
          s.id,
          staffSalary(role, c.key, preset ? preset.quality : q),
          role,
          staffRng.int(1, 3),
        );
        return s;
      };
      hire('technicalDirector', sq() + 3);
      hire('sportingDirector', sq());
      if (c.key !== 'lightweight') hire('strategyChief', sq());
      if (c.key !== 'lightweight') hire('physio', sq());
      if (c.key === 'premier') hire('doctor', sq());

      for (const { rider, number, cc, te } of riders) {
        const q = avgAttr(rider);
        contract('rider', teamId, rider.id, riderSalary(c.key, q), 'race', riderRng.int(1, 2));
        seats.push({ number: takeNumber(number ?? t.numbers?.[seats.length]), riderId: rider.id });
        const crewChief = hire('crewChief', sq(), cc);
        const trackEngineer = hire('trackEngineer', sq(), te);
        const analyst = c.key === 'premier' ? hire('telemetryAnalyst', sq()) : undefined;
        for (let m = 0; m < (c.key === 'premier' ? 3 : 2); m++) hire('mechanic', sq() - 4);
        state.staffAssignments.push({
          teamId,
          riderId: rider.id,
          crewChiefId: crewChief.id,
          trackEngineerId: trackEngineer.id,
          ...(analyst ? { analystId: analyst.id } : {}),
        });
        bond(rider.id, crewChief.id, cc?.seasonsWithRider ?? staffRng.int(0, 3));
        bond(rider.id, trackEngineer.id, te?.seasonsWithRider ?? staffRng.int(0, 3));
        insertBike(teamId, rider.id, catId, reg);
      }
      insert(state, 'teamEntries', {
        id: ids.next('ent'),
        teamId,
        categoryId: catId,
        seasonId: seasonIds.get(c.key)!,
        manufacturerId: mfrIds.get(t.manufacturer)!,
        seats,
      });

      // Collaudatore: squadre ufficiali Premier.
      if (c.key === 'premier' && t.type === 'factory') {
        const tester = randomRider('premier', null, 'test', -6, [27, 38]);
        tester.developmentSkill = rating(60 + riderRng.normal(10, 8));
        tester.attributes.technicalFeedback = rating(tester.attributes.technicalFeedback + 10);
        contract(
          'rider',
          teamId,
          tester.id,
          round1000(riderSalary('premier', avgAttr(tester)) * 0.3),
          'test',
          2,
        );
        insert(state, 'bikes', newBike(teamId, tester.id, catId, 'A', 'test'));
      }
    }
  }

  // --- Mercato iniziale: piloti e staff senza contratto, accademie ------------------------------
  for (let i = 0; i < 6; i++) randomRider('premier', null, 'race', -5, [25, 35]).status = 'free';
  for (let i = 0; i < 6; i++) randomRider('intermediate', null, 'race', -3, [19, 30]).status = 'free';
  const academyTeams = TEAMS.filter(
    (t) => t.category === 'premier' && (t.type === 'factory' || t.type === 'satellite'),
  );
  for (let i = 0; i < 10; i++) {
    const t = academyTeams[i % academyTeams.length] as TeamContent;
    const r = randomRider('rookies', null, 'academy', 2, [12, 15]);
    contract('rider', teamIds.get(t.key)!, r.id, 0, 'academy', 2);
  }
  const freeRoles: StaffRole[] = [
    'crewChief',
    'trackEngineer',
    'trackEngineer',
    'telemetryAnalyst',
    'engineEngineer',
    'electronicsEngineer',
    'chassisEngineer',
    'aeroEngineer',
    'strategyChief',
    'technicalDirector',
    'talentScout',
    'mechanic',
  ];
  for (let i = 0; i < 36; i++) {
    const role = freeRoles[i % freeRoles.length] as StaffRole;
    makeStaff(role, STAFF_QUALITY.intermediate + staffRng.normal(2, 8)).status = 'free';
  }

  state.idCounters = ids.snapshot();
  state.rng = streams.snapshot();
  return state;

  // --- Moto -------------------------------------------------------------------------------------
  function newBike(
    teamId: TeamId,
    riderId: RiderId,
    categoryId: CategoryId,
    slot: 'A' | 'B',
    label: Bike['label'],
  ): Bike {
    return {
      id: ids.next('bik'),
      teamId,
      riderId,
      categoryId,
      slot,
      label,
      components: {},
      mileageKm: 0,
      wear: 0,
      readiness: 1,
      availability: 'ready',
    };
  }
  function insertBike(teamId: TeamId, riderId: RiderId, categoryId: CategoryId, reg: Regulation) {
    insert(state, 'bikes', newBike(teamId, riderId, categoryId, 'A', 'reference'));
    if (reg.bikesPerRider === 2)
      insert(state, 'bikes', newBike(teamId, riderId, categoryId, 'B', 'experimental'));
  }
}
