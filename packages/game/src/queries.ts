/**
 * Viste per l'interfaccia (sola lettura). Trasformano lo stato normalizzato in dati pronti da mostrare,
 * applicando il filtro di conoscenza (ADR-0003): i valori nascosti — potenziale reale, data reale di
 * rientro da un infortunio — non escono mai dal motore; si espongono solo stime.
 */
import { GameCalendar, cyrb128 } from '@lean-angle/core';
import {
  NAMES_CONTENT,
  OPENING_BALANCE,
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
import {
  bikeView,
  championship,
  financeView,
  newsFeed,
  seasonReview,
  riderProfile,
  sponsorView,
  weekendView,
} from './views.ts';
import { activeRiderContract, askingSalary, buyoutFor, ineligibility, marketOpen } from './market.ts';

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
  const next = rounds.find((r) => r.startDay >= s.meta.currentDay && r.status !== 'raced');
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
    roundsDone: rounds.filter((r) => r.status === 'raced').length,
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

// ---------------------------------------------------------------------------------------------
// Mercato

export interface MarketRow {
  id: string;
  name: string;
  nationality: string;
  age: number;
  team: string | null;
  teamColors: { primary: string; secondary: string } | null;
  /** Numero di gara se ha un posto in griglia. */
  number: number | null;
  category: string | null;
  tier: CategoryTier | null;
  role: RiderRole;
  rating: number;
  potential: [number, number];
  salary: number | null;
  contractEnd: string | null;
  buyout: number;
  /** Richiesta indicativa del manager (intervallo), per la squadra del giocatore. */
  askingRange: [number, number] | null;
  eligible: boolean;
  ineligibleReason: string | null;
  own: boolean;
  negotiation: 'open' | 'signed' | 'rejected' | 'withdrawn' | null;
}

export type MarketFilter = 'all' | 'free' | CategoryTier;

export function marketRiders(s: GameState, filter: MarketFilter = 'all', search = ''): MarketRow[] {
  const c = cal(s);
  const teamId = s.meta.playerTeamId;
  const q = search.trim().toLowerCase();
  const seatNo = new Map<string, number>();
  for (const e of rows(s, 'teamEntries'))
    for (const seat of e.seats) if (seat.riderId) seatNo.set(seat.riderId, seat.number);
  return rows(s, 'riders')
    .filter((r) => r.status !== 'retired')
    .map((r) => {
      const k = activeRiderContract(s, r.id);
      const team = k ? s.tables.teams[k.employerId as TeamId] : undefined;
      const tier = r.categoryId ? s.tables.categories[r.categoryId]!.tier : null;
      const why = teamId ? ineligibility(s, r, teamId, 'race') : null;
      const ask = teamId ? askingSalary(s, r, teamId) : null;
      const neg = rows(s, 'negotiations')
        .filter((n) => n.riderId === r.id && n.teamId === teamId)
        .at(-1);
      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        nationality: r.nationality,
        age: c.ageOn(r.birthDay, s.meta.currentDay),
        team: team ? team.name : null,
        teamColors: team ? { primary: team.colors.primary, secondary: team.colors.secondary } : null,
        number: seatNo.get(r.id) ?? null,
        category: r.categoryId ? s.tables.categories[r.categoryId]!.name : null,
        tier,
        role: r.role,
        rating: riderRating(r),
        potential: potentialEstimate(s, r, teamId),
        salary: k ? k.salary : null,
        contractEnd: k ? c.format(k.endDay) : null,
        buyout: k?.employerId === teamId ? 0 : buyoutFor(s, k),
        askingRange:
          ask === null
            ? null
            : [Math.round((ask * 0.9) / 10_000) * 10_000, Math.round((ask * 1.1) / 10_000) * 10_000],
        eligible: why === null,
        ineligibleReason: why,
        own: !!teamId && k?.employerId === teamId,
        negotiation: neg ? neg.status : null,
      } satisfies MarketRow;
    })
    .filter((r) => (filter === 'all' ? true : filter === 'free' ? r.team === null : r.tier === filter))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.team ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.rating - a.rating);
}

export interface NegotiationView {
  rider: MarketRow;
  open: boolean;
  marketOpen: boolean;
  kind: 'transfer' | 'renewal';
  balance: number;
  currentContract: {
    team: string;
    salary: number;
    end: string;
    role: string;
    bonuses: { condition: string; amount: number }[];
  } | null;
  ownSeats: { riderId: string | null; name: string | null; number: number }[];
  rounds: {
    day: string;
    salary: number;
    years: number;
    role: string;
    response: string;
    counter: { salary: number; years: number } | null;
    message: string;
  }[];
  status: 'open' | 'signed' | 'rejected' | 'withdrawn' | null;
  patience: number | null;
}

export function negotiationView(s: GameState, riderId: string): NegotiationView | null {
  const r = s.tables.riders[riderId as Rider['id']];
  const teamId = s.meta.playerTeamId;
  if (!r || !teamId) return null;
  const c = cal(s);
  const row = marketRiders(s, 'all').find((x) => x.id === riderId)!;
  const k = activeRiderContract(s, r.id);
  const neg = rows(s, 'negotiations')
    .filter((n) => n.riderId === r.id && n.teamId === teamId)
    .at(-1);
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId)!;
  return {
    rider: row,
    open: neg?.status === 'open',
    marketOpen: marketOpen(s),
    kind: k?.employerId === teamId ? 'renewal' : 'transfer',
    balance: teamBalance(s, teamId),
    currentContract: k
      ? {
          team: s.tables.teams[k.employerId as TeamId]!.name,
          salary: k.salary,
          end: c.format(k.endDay),
          role: k.role,
          bonuses: k.bonuses,
        }
      : null,
    ownSeats: entry.seats.map((seat) => {
      const sr = seat.riderId ? s.tables.riders[seat.riderId] : undefined;
      return {
        riderId: seat.riderId,
        name: sr ? `${sr.firstName} ${sr.lastName}` : null,
        number: seat.number,
      };
    }),
    rounds: (neg?.rounds ?? []).map((x) => ({
      day: c.format(x.day),
      salary: x.offer.salary,
      years: x.offer.years,
      role: x.offer.role,
      response: x.response,
      counter: x.counter ?? null,
      message: x.message,
    })),
    status: neg?.status ?? null,
    patience: neg ? neg.patience : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Crea la tua squadra

export interface CreateTeamOptionsView {
  categories: {
    tier: Exclude<CategoryTier, 'rookies'>;
    name: string;
    manufacturers: { id: string; name: string; country: string; strength: number }[];
    types: { type: 'private' | 'independent' | 'satellite'; budget: [number, number] }[];
  }[];
  nationalities: string[];
}

export function createTeamOptions(s: GameState): CreateTeamOptionsView {
  const tiers = ['premier', 'intermediate', 'lightweight'] as const;
  return {
    categories: tiers.map((tier) => {
      const cat = rows(s, 'categories').find((c) => c.tier === tier)!;
      return {
        tier,
        name: cat.name,
        manufacturers: rows(s, 'manufacturers')
          .filter((m) => m.categories.includes(cat.id))
          .map((m) => ({ id: m.id, name: m.name, country: m.country, strength: m.engineeringStrength })),
        types: (['private', 'independent', 'satellite'] as const).flatMap((type) => {
          const b = OPENING_BALANCE[tier][type];
          return b
            ? [
                {
                  type,
                  budget: [Math.round((b[0] + b[1]) / 2), Math.round((b[0] + b[1]) / 2)] as [number, number],
                },
              ]
            : [];
        }),
      };
    }),
    nationalities: Object.keys(NAMES_CONTENT).sort(),
  };
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
  marketRiders,
  negotiationView,
  createTeamOptions,
  weekendView,
  championship,
  financeView,
  newsFeed,
  seasonReview,
  bikeView,
  sponsorView,
  riderProfile,
} as const;
export type QueryName = keyof typeof QUERIES;
export type QueryArgs<N extends QueryName> = (typeof QUERIES)[N] extends (
  s: GameState,
  ...a: infer A
) => unknown
  ? A
  : never;
export type QueryResult<N extends QueryName> = ReturnType<(typeof QUERIES)[N]>;
