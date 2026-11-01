/**
 * Viste per l'interfaccia (sola lettura). Trasformano lo stato normalizzato in dati pronti da mostrare,
 * applicando il filtro di conoscenza (ADR-0003): i valori nascosti — potenziale reale, data reale di
 * rientro da un infortunio — non escono mai dal motore; si espongono solo stime.
 */
import { GameCalendar, cyrb128 } from '@lean-angle/core';
import {
  RIDER_ATTRIBUTES,
  rows,
  teamBalance,
  type CategoryTier,
  type Contract,
  type FacilityType,
  type GameState,
  type Rider,
  type RiderAttribute,
  type RiderRole,
  type StaffMember,
  type StaffRole,
  type TeamId,
  type TeamType,
} from '@lean-angle/data';

const cal = (s: GameState) => new GameCalendar(s.meta.startYear);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const riderRating = (r: Rider) => Math.round(mean(RIDER_ATTRIBUTES.map((a) => r.attributes[a])));
export const staffRating = (m: StaffMember) => Math.round(mean(Object.values(m.skills)));

function activeContract(s: GameState, personId: string): Contract | undefined {
  return rows(s, 'contracts').find(
    (c) => c.counterpartyId === personId && c.status === 'active' && c.kind !== 'sponsor',
  );
}

/**
 * Stima del potenziale come intervallo. Più ampio per i piloti di altre squadre.
 * Deterministica (dipende solo dall'ID): rileggere la scheda non cambia la stima.
 */
export function potentialEstimate(s: GameState, r: Rider, viewerTeamId: TeamId | null): [number, number] {
  const own = viewerTeamId !== null && activeContract(s, r.id)?.employerId === viewerTeamId;
  const half = own ? 3 : 8;
  const bias = ((cyrb128(r.id)[0] ?? 0) % 7) - 3; // errore dello scout: −3…+3
  const center = r.potential + (own ? Math.round(bias / 2) : bias);
  return [Math.max(1, center - half), Math.min(99, center + half)];
}

// ---------------------------------------------------------------------------------------------
export interface TeamCard {
  id: TeamId;
  name: string;
  shortName: string;
  type: TeamType;
  nationality: string;
  baseCity: string;
  founded: number;
  colors: { primary: string; secondary: string; accent?: string };
  reputation: number;
  manufacturer: string;
  ownerName: string;
  balance: number | null;
  riders: { id: string; name: string; number: number; nationality: string; age: number; rating: number }[];
}

export interface CategoryTab {
  id: string;
  tier: CategoryTier;
  name: string;
  managed: boolean;
  bikesPerRider: number;
  rounds: number;
}

export function categories(s: GameState): CategoryTab[] {
  return rows(s, 'categories').map((c) => {
    const season = rows(s, 'seasons').find((x) => x.categoryId === c.id);
    const reg = season ? s.tables.regulations[season.regulationId] : undefined;
    return {
      id: c.id,
      tier: c.tier,
      name: c.name,
      managed: c.teamsManaged,
      bikesPerRider: reg?.bikesPerRider ?? 1,
      rounds: season?.roundIds.length ?? 0,
    };
  });
}

export function teamCards(s: GameState, categoryId: string): TeamCard[] {
  const c = cal(s);
  return rows(s, 'teamEntries')
    .filter((e) => e.categoryId === categoryId)
    .map((e) => {
      const t = s.tables.teams[e.teamId]!;
      const hasAccount = s.accounts.some((a) => a.teamId === t.id);
      return {
        id: t.id,
        name: t.name,
        shortName: t.shortName,
        type: t.type,
        nationality: t.nationality,
        baseCity: t.baseCity,
        founded: t.founded,
        colors: t.colors,
        reputation: t.reputation,
        manufacturer: s.tables.manufacturers[e.manufacturerId]!.name,
        ownerName:
          t.owner.kind === 'manufacturer'
            ? s.tables.manufacturers[t.owner.manufacturerId]!.name
            : t.owner.name,
        balance: hasAccount ? teamBalance(s, t.id) : null,
        riders: e.seats.flatMap((seat) => {
          if (!seat.riderId) return [];
          const r = s.tables.riders[seat.riderId]!;
          return [
            {
              id: r.id,
              name: `${r.firstName} ${r.lastName}`,
              number: seat.number,
              nationality: r.nationality,
              age: c.ageOn(r.birthDay, s.meta.currentDay),
              rating: riderRating(r),
            },
          ];
        }),
      };
    })
    .sort((a, b) => b.reputation - a.reputation);
}

// ---------------------------------------------------------------------------------------------
export interface CareerSummary {
  saveName: string;
  date: string;
  day: number;
  team: TeamCard | null;
  category: { id: string; name: string; tier: CategoryTier; bikesPerRider: number } | null;
  nextRound: {
    number: number;
    circuit: string;
    country: string;
    date: string;
    inDays: number;
    lengthM: number;
    turns: number;
  } | null;
  roundsTotal: number;
  roundsDone: number;
}

export function careerSummary(s: GameState): CareerSummary {
  const c = cal(s);
  const teamId = s.meta.playerTeamId;
  const entry = teamId ? rows(s, 'teamEntries').find((e) => e.teamId === teamId) : undefined;
  const team = entry ? (teamCards(s, entry.categoryId).find((t) => t.id === teamId) ?? null) : null;
  const cat = entry ? s.tables.categories[entry.categoryId] : undefined;
  const season = entry ? s.tables.seasons[entry.seasonId] : undefined;
  const reg = season ? s.tables.regulations[season.regulationId] : undefined;
  const rounds = season
    ? season.roundIds.map((id) => s.tables.rounds[id]!).sort((a, b) => a.startDay - b.startDay)
    : [];
  const next = rounds.find((r) => r.startDay > s.meta.currentDay);
  const circuit = next ? s.tables.circuits[next.circuitId]! : undefined;
  return {
    saveName: s.meta.saveName,
    date: c.format(s.meta.currentDay),
    day: s.meta.currentDay,
    team,
    category:
      cat && reg ? { id: cat.id, name: cat.name, tier: cat.tier, bikesPerRider: reg.bikesPerRider } : null,
    nextRound:
      next && circuit
        ? {
            number: next.number,
            circuit: circuit.name,
            country: circuit.country,
            date: c.format(next.startDay),
            inDays: next.startDay - s.meta.currentDay,
            lengthM: circuit.lengthM,
            turns: circuit.turns,
          }
        : null,
    roundsTotal: rounds.length,
    roundsDone: rounds.filter((r) => r.startDay <= s.meta.currentDay).length,
  };
}

// ---------------------------------------------------------------------------------------------
export interface TeamOverview extends TeamCard {
  owner: { kind: 'manufacturer' | 'private'; name: string };
  facilities: { type: FacilityType; level: number }[];
  staffByRole: { role: StaffRole; count: number }[];
  payroll: { riders: number; staff: number };
  bikes: { total: number; perRider: number };
}

export function teamOverview(s: GameState, teamId: TeamId): TeamOverview | null {
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  if (!entry) return null;
  const card = teamCards(s, entry.categoryId).find((t) => t.id === teamId)!;
  const team = s.tables.teams[teamId]!;
  const contracts = rows(s, 'contracts').filter((c) => c.employerId === teamId && c.status === 'active');
  const staffIds = new Set(contracts.filter((c) => c.kind === 'staff').map((c) => c.counterpartyId));
  const counts = new Map<StaffRole, number>();
  for (const id of staffIds) {
    const m = s.tables.staff[id as StaffMember['id']];
    if (m) counts.set(m.role, (counts.get(m.role) ?? 0) + 1);
  }
  const season = s.tables.seasons[entry.seasonId]!;
  const reg = s.tables.regulations[season.regulationId]!;
  return {
    ...card,
    owner:
      team.owner.kind === 'manufacturer'
        ? { kind: 'manufacturer', name: s.tables.manufacturers[team.owner.manufacturerId]!.name }
        : { kind: 'private', name: team.owner.name },
    facilities: rows(s, 'facilities')
      .filter((f) => f.teamId === teamId)
      .map((f) => ({ type: f.type, level: f.level })),
    staffByRole: [...counts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count),
    payroll: {
      riders: contracts.filter((c) => c.kind === 'rider').reduce((t, c) => t + c.salary, 0),
      staff: contracts.filter((c) => c.kind === 'staff').reduce((t, c) => t + c.salary, 0),
    },
    bikes: { total: rows(s, 'bikes').filter((b) => b.teamId === teamId).length, perRider: reg.bikesPerRider },
  };
}

// ---------------------------------------------------------------------------------------------
export interface RiderRow {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  number: number | null;
  nationality: string;
  age: number;
  role: RiderRole;
  rating: number;
  morale: number;
  contractEnd: string | null;
  salary: number | null;
}

export function teamRiders(s: GameState, teamId: TeamId): RiderRow[] {
  const c = cal(s);
  const seatNumber = new Map(
    rows(s, 'teamEntries')
      .filter((e) => e.teamId === teamId)
      .flatMap((e) => e.seats.map((x) => [x.riderId, x.number] as const)),
  );
  const order: RiderRole[] = ['race', 'test', 'reserve', 'academy'];
  return rows(s, 'contracts')
    .filter(
      (k) =>
        k.employerId === teamId && k.status === 'active' && (k.kind === 'rider' || k.kind === 'substitute'),
    )
    .map((k) => {
      const r = s.tables.riders[k.counterpartyId as Rider['id']]!;
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        firstName: r.firstName,
        lastName: r.lastName,
        number: seatNumber.get(r.id) ?? null,
        nationality: r.nationality,
        age: c.ageOn(r.birthDay, s.meta.currentDay),
        role: r.role,
        rating: riderRating(r),
        morale: r.morale,
        contractEnd: c.format(k.endDay),
        salary: k.salary,
      };
    })
    .sort(
      (a, b) =>
        order.indexOf(a.role) - order.indexOf(b.role) ||
        (a.number ?? 999) - (b.number ?? 999) ||
        b.rating - a.rating,
    );
}

export interface RiderDetail extends RiderRow {
  attributes: { key: RiderAttribute; value: number }[];
  potential: [number, number];
  reputation: number;
  form: number;
  team: string | null;
  bonuses: { condition: string; amount: number }[];
  staff: {
    role: 'crewChief' | 'trackEngineer';
    id: string;
    name: string;
    rating: number;
    trust: number;
    communication: number;
    compatibility: number;
    styleUnderstanding: number;
  }[];
  bikes: { slot: 'A' | 'B'; label: string; availability: string }[];
  injury: { type: string; severity: string; estimate: [number, number] } | null;
}

export function riderDetail(s: GameState, riderId: string): RiderDetail | null {
  const r = s.tables.riders[riderId as Rider['id']];
  if (!r) return null;
  const c = cal(s);
  const k = activeContract(s, r.id);
  const teamId = (k?.employerId ?? null) as TeamId | null;
  const row = teamId ? teamRiders(s, teamId).find((x) => x.id === r.id) : undefined;
  const assign = s.staffAssignments.find((a) => a.riderId === r.id);
  const staff = assign
    ? (['crewChief', 'trackEngineer'] as const).map((role) => {
        const m = s.tables.staff[role === 'crewChief' ? assign.crewChiefId : assign.trackEngineerId]!;
        const b = s.bonds.find((x) => x.riderId === r.id && x.staffId === m.id);
        return {
          role,
          id: m.id,
          name: `${m.firstName} ${m.lastName}`,
          rating: staffRating(m),
          trust: b?.trust ?? 50,
          communication: b?.communication ?? 50,
          compatibility: b?.compatibility ?? 50,
          styleUnderstanding: b?.styleUnderstanding ?? 40,
        };
      })
    : [];
  const inj = rows(s, 'injuries').find((i) => i.riderId === r.id && i.status === 'active');
  return {
    ...(row ?? {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      firstName: r.firstName,
      lastName: r.lastName,
      number: null,
      nationality: r.nationality,
      age: c.ageOn(r.birthDay, s.meta.currentDay),
      role: r.role,
      rating: riderRating(r),
      morale: r.morale,
      contractEnd: null,
      salary: null,
    }),
    attributes: RIDER_ATTRIBUTES.map((key) => ({ key, value: r.attributes[key] })),
    potential: potentialEstimate(s, r, s.meta.playerTeamId),
    reputation: r.reputation,
    form: r.form,
    team: teamId ? s.tables.teams[teamId]!.name : null,
    bonuses: k?.bonuses ?? [],
    staff,
    bikes: rows(s, 'bikes')
      .filter((b) => b.riderId === r.id)
      .map((b) => ({ slot: b.slot, label: b.label, availability: b.availability })),
    // Si espone solo la stima medica, mai il giorno reale di rientro.
    injury: inj ? { type: inj.type, severity: inj.severity, estimate: inj.recoveryDaysEstimate } : null,
  };
}

// ---------------------------------------------------------------------------------------------
export interface StaffRow {
  id: string;
  name: string;
  role: StaffRole;
  nationality: string;
  age: number;
  rating: number;
  experienceYears: number;
  assignedTo: string | null;
  contractEnd: string | null;
  salary: number | null;
}

export function teamStaff(s: GameState, teamId: TeamId): StaffRow[] {
  const c = cal(s);
  const assigned = new Map<string, string>();
  for (const a of s.staffAssignments.filter((x) => x.teamId === teamId)) {
    const r = s.tables.riders[a.riderId]!;
    const label = `${r.firstName.charAt(0)}. ${r.lastName}`;
    assigned.set(a.crewChiefId, label);
    assigned.set(a.trackEngineerId, label);
    if (a.analystId) assigned.set(a.analystId, label);
  }
  return rows(s, 'contracts')
    .filter((k) => k.employerId === teamId && k.status === 'active' && k.kind === 'staff')
    .map((k) => {
      const m = s.tables.staff[k.counterpartyId as StaffMember['id']]!;
      return {
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        role: m.role,
        nationality: m.nationality,
        age: c.ageOn(m.birthDay, s.meta.currentDay),
        rating: staffRating(m),
        experienceYears: m.experienceYears,
        assignedTo: assigned.get(m.id) ?? null,
        contractEnd: c.format(k.endDay),
        salary: k.salary,
      };
    });
}

export interface StaffDetail extends StaffRow {
  skills: { key: string; value: number }[];
  potential: number;
  reputation: number;
  morale: number;
  specialization: string;
  bonds: {
    riderId: string;
    rider: string;
    trust: number;
    communication: number;
    compatibility: number;
    styleUnderstanding: number;
    satisfaction: number;
  }[];
}

export function staffDetail(s: GameState, staffId: string): StaffDetail | null {
  const m = s.tables.staff[staffId as StaffMember['id']];
  if (!m) return null;
  const c = cal(s);
  const k = activeContract(s, m.id);
  const row = k ? teamStaff(s, k.employerId as TeamId).find((x) => x.id === m.id) : undefined;
  return {
    ...(row ?? {
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      role: m.role,
      nationality: m.nationality,
      age: c.ageOn(m.birthDay, s.meta.currentDay),
      rating: staffRating(m),
      experienceYears: m.experienceYears,
      assignedTo: null,
      contractEnd: null,
      salary: null,
    }),
    skills: Object.entries(m.skills).map(([key, value]) => ({ key, value })),
    // Il potenziale dello staff è mostrato arrotondato a 5 (stima), non il valore esatto.
    potential: Math.round(m.potential / 5) * 5,
    reputation: m.reputation,
    morale: m.morale,
    specialization: m.specialization,
    bonds: s.bonds
      .filter((b) => b.staffId === m.id)
      .map((b) => {
        const r = s.tables.riders[b.riderId]!;
        return {
          riderId: r.id,
          rider: `${r.firstName} ${r.lastName}`,
          trust: b.trust,
          communication: b.communication,
          compatibility: b.compatibility,
          styleUnderstanding: b.styleUnderstanding,
          satisfaction: b.satisfaction,
        };
      }),
  };
}

// ---------------------------------------------------------------------------------------------
export interface CalendarRow {
  id: string;
  number: number;
  circuit: string;
  country: string;
  date: string;
  lengthM: number;
  turns: number;
  status: 'done' | 'next' | 'upcoming';
}

export function calendar(s: GameState, categoryId: string): CalendarRow[] {
  const c = cal(s);
  const season = rows(s, 'seasons').find((x) => x.categoryId === categoryId);
  if (!season) return [];
  const rounds = season.roundIds.map((id) => s.tables.rounds[id]!).sort((a, b) => a.startDay - b.startDay);
  const nextId = rounds.find((r) => r.startDay > s.meta.currentDay)?.id;
  return rounds.map((r) => {
    const ci = s.tables.circuits[r.circuitId]!;
    return {
      id: r.id,
      number: r.number,
      circuit: ci.name,
      country: ci.country,
      date: c.format(r.startDay),
      lengthM: ci.lengthM,
      turns: ci.turns,
      status: r.startDay <= s.meta.currentDay ? 'done' : r.id === nextId ? 'next' : 'upcoming',
    };
  });
}

/** Registro delle viste disponibili all'interfaccia (usato dall'engine host per le richieste remote). */
export const QUERIES = {
  categories,
  teamCards,
  careerSummary,
  teamOverview,
  teamRiders,
  riderDetail,
  teamStaff,
  staffDetail,
  calendar,
} as const;
export type QueryName = keyof typeof QUERIES;
export type QueryArgs<N extends QueryName> = (typeof QUERIES)[N] extends (
  s: GameState,
  ...a: infer A
) => unknown
  ? A
  : never;
export type QueryResult<N extends QueryName> = ReturnType<(typeof QUERIES)[N]>;
