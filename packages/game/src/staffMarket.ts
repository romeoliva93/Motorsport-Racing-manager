/**
 * Mercato del personale tecnico: capotecnici, ingegneri, meccanici e dirigenti senza contratto si possono
 * ingaggiare in ogni momento. Un nuovo capotecnico o ingegnere di pista si assegna a un pilota (quello attuale
 * viene liberato con un'indennità); gli altri ruoli entrano in squadra, sostituendo eventualmente qualcuno.
 *
 * Effetti reali: il capotecnico decide consigli e tempi delle modifiche d'assetto nelle prove; il numero di
 * meccanici accelera o rallenta i lavori fra le sessioni; gli stipendi pesano sul bilancio ogni mese.
 */
import { GameCalendar, type IdFactory } from '@lean-angle/core';
import {
  portraitKey,
  poolPortraitKey,
  rows,
  teamBalance,
  STAFF_BASE_SALARY,
  STAFF_QUALITY,
  STAFF_SALARY_SCALE,
  type ContractId,
  type GameState,
  type RiderId,
  type StaffId,
  type StaffMember,
  type StaffRole,
  type TeamId,
  type TransactionId,
} from '@lean-angle/data';
import { managerSkill } from './managerSkills.ts';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
export const staffRatingOf = (m: StaffMember) => Math.round(mean(Object.values(m.skills)));

/** Ruoli che si assegnano a un pilota. */
export const RIDER_ROLES: StaffRole[] = ['crewChief', 'trackEngineer'];

function tierOf(s: GameState, teamId: string) {
  const e = rows(s, 'teamEntries').find((x) => x.teamId === teamId);
  return e ? s.tables.categories[e.categoryId]!.tier : 'premier';
}

export function activeStaffContract(s: GameState, staffId: string) {
  return rows(s, 'contracts').find(
    (k) => k.kind === 'staff' && k.counterpartyId === staffId && k.status === 'active',
  );
}

/** Personale senza contratto (svincolato). */
export function freeStaff(s: GameState): StaffMember[] {
  const employed = new Set(
    rows(s, 'contracts')
      .filter((k) => k.kind === 'staff' && k.status === 'active')
      .map((k) => k.counterpartyId),
  );
  return rows(s, 'staff').filter((m) => !employed.has(m.id));
}

/** Stipendio annuo richiesto da un tecnico per la squadra (la trattativa del manager lo abbassa). */
export function staffAskingSalary(s: GameState, m: StaffMember, teamId: string): number {
  const tier = tierOf(s, teamId);
  const base =
    (STAFF_BASE_SALARY[m.role] ?? 100_000) *
    STAFF_SALARY_SCALE[tier] *
    Math.pow(1.05, staffRatingOf(m) - STAFF_QUALITY[tier]);
  return Math.round((base * (1 - 0.04 * managerSkill(s, 'negotiation'))) / 1000) * 1000;
}

/** Meccanici in squadra: il numero di riferimento è 6 in MotoGP e 4 altrove. */
export function mechanicsFactor(s: GameState, teamId: string): number {
  const n = rows(s, 'contracts').filter(
    (k) =>
      k.kind === 'staff' &&
      k.status === 'active' &&
      k.employerId === teamId &&
      s.tables.staff[k.counterpartyId as StaffId]?.role === 'mechanic',
  ).length;
  const ref = tierOf(s, teamId) === 'premier' ? 6 : 4;
  return Math.max(0.8, Math.min(1.3, 1 + (ref - n) * 0.06));
}

function payTeam(s: GameState, ids: IdFactory, teamId: string, amount: number, note: string) {
  if (!amount) return;
  const id = ids.next('trx') as TransactionId;
  s.tables.transactions[id] = {
    id,
    teamId: teamId as TeamId,
    day: s.meta.currentDay,
    amount,
    category: 'salaries',
    note,
  };
}

/** Libera un tecnico: contratto risolto con indennità del 25% del residuo. */
export function releaseStaff(s: GameState, ids: IdFactory, teamId: string, staffId: string): void {
  const k = activeStaffContract(s, staffId);
  if (!k || k.employerId !== teamId) return;
  const residual = Math.max(0, ((k.endDay - s.meta.currentDay) / 365) * k.salary);
  const m = s.tables.staff[staffId as StaffId]!;
  payTeam(
    s,
    ids,
    teamId,
    -Math.round((residual * 0.25) / 1000) * 1000,
    `Risoluzione del contratto di ${m.firstName} ${m.lastName}`,
  );
  k.status = 'terminated';
}

export interface HireOrder {
  staffId: string;
  years: number;
  /** Capotecnico / ingegnere di pista: pilota a cui assegnarlo (sostituisce quello attuale). */
  riderId?: string;
  /** Altri ruoli: tecnico della squadra da sostituire (facoltativo). */
  replaceStaffId?: string;
}

export function validateHire(s: GameState, teamId: string, o: HireOrder): string | null {
  const m = s.tables.staff[o.staffId as StaffId];
  if (!m) return 'Tecnico inesistente';
  if (activeStaffContract(s, m.id)) return 'Questo tecnico è già sotto contratto';
  if (![1, 2, 3].includes(o.years)) return 'Durata non valida (1–3 anni)';
  const salary = staffAskingSalary(s, m, teamId);
  if (teamBalance(s, teamId as TeamId) < salary / 2)
    return 'Budget insufficiente: servono almeno sei mesi di stipendio in cassa';
  if (RIDER_ROLES.includes(m.role)) {
    if (!o.riderId) return 'Scegli a quale pilota assegnarlo';
    const a = s.staffAssignments.find((x) => x.teamId === teamId && x.riderId === o.riderId);
    if (!a) return 'Il pilota non è della tua squadra';
  } else if (o.replaceStaffId) {
    const k = activeStaffContract(s, o.replaceStaffId);
    if (!k || k.employerId !== teamId) return 'Il tecnico da sostituire non è della tua squadra';
    if (s.tables.staff[o.replaceStaffId as StaffId]?.role !== m.role)
      return 'Si sostituisce un tecnico dello stesso ruolo';
  }
  return null;
}

export function hireStaff(s: GameState, ids: IdFactory, teamId: string, o: HireOrder): void {
  const m = s.tables.staff[o.staffId as StaffId]!;
  const cal = new GameCalendar(s.meta.startYear);
  const year = cal.toDate(s.meta.currentDay).year;
  const id = ids.next('ctr') as ContractId;
  s.tables.contracts[id] = {
    id,
    kind: 'staff',
    employerId: teamId as TeamId,
    counterpartyId: m.id,
    startDay: s.meta.currentDay,
    endDay: cal.fromDate({ year: year + o.years - 1, month: 12, day: 31 }),
    salary: staffAskingSalary(s, m, teamId),
    bonuses: [],
    role: m.role,
    status: 'active',
  };
  if (RIDER_ROLES.includes(m.role) && o.riderId) {
    const a = s.staffAssignments.find((x) => x.teamId === teamId && x.riderId === (o.riderId as RiderId))!;
    const slot = m.role === 'crewChief' ? 'crewChiefId' : 'trackEngineerId';
    const old = a[slot];
    a[slot] = m.id;
    // Il predecessore resta in squadra solo se segue anche un altro pilota; altrimenti viene liberato.
    if (old && !s.staffAssignments.some((x) => x.crewChiefId === old || x.trackEngineerId === old))
      releaseStaff(s, ids, teamId, old);
  } else if (o.replaceStaffId) releaseStaff(s, ids, teamId, o.replaceStaffId);
}

export interface StaffMarketRow {
  id: string;
  name: string;
  role: StaffRole;
  nationality: string;
  age: number;
  rating: number;
  experienceYears: number;
  /** Le tre competenze migliori. */
  best: { key: string; value: number }[];
  askingSalary: number;
  portrait: { key: string; pool: string };
}

export interface StaffMarketView {
  free: StaffMarketRow[];
  /** Personale della squadra, per scegliere chi sostituire. */
  mine: {
    id: string;
    name: string;
    role: StaffRole;
    rating: number;
    salary: number;
    assignedTo: string | null;
  }[];
  /** Piloti della squadra con capotecnico e ingegnere attuali. */
  riders: { id: string; name: string; crewChief: string; trackEngineer: string }[];
  mechanics: { count: number; reference: number; factor: number };
  balance: number;
}

export function staffMarket(s: GameState): StaffMarketView | null {
  const teamId = s.meta.playerTeamId;
  if (!teamId) return null;
  const cal = new GameCalendar(s.meta.startYear);
  const nm = (id: string) => {
    const m = s.tables.staff[id as StaffId];
    return m ? `${m.firstName} ${m.lastName}` : '—';
  };
  const riderName = (id: string) => {
    const r = s.tables.riders[id as RiderId]!;
    return `${r.firstName} ${r.lastName}`;
  };
  const assigned = new Map<string, string>();
  for (const a of s.staffAssignments.filter((x) => x.teamId === teamId)) {
    assigned.set(a.crewChiefId, riderName(a.riderId));
    assigned.set(a.trackEngineerId, riderName(a.riderId));
  }
  const mine = rows(s, 'contracts')
    .filter((k) => k.kind === 'staff' && k.status === 'active' && k.employerId === teamId)
    .map((k) => {
      const m = s.tables.staff[k.counterpartyId as StaffId]!;
      return {
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        role: m.role,
        rating: staffRatingOf(m),
        salary: k.salary,
        assignedTo: assigned.get(m.id) ?? null,
      };
    });
  const ref = tierOf(s, teamId) === 'premier' ? 6 : 4;
  return {
    free: freeStaff(s)
      .map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        role: m.role,
        nationality: m.nationality,
        age: cal.ageOn(m.birthDay, s.meta.currentDay),
        rating: staffRatingOf(m),
        experienceYears: m.experienceYears,
        best: Object.entries(m.skills)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([key, value]) => ({ key, value })),
        askingSalary: staffAskingSalary(s, m, teamId),
        portrait: {
          key: portraitKey(m),
          pool: poolPortraitKey(portraitKey(m), cal.ageOn(m.birthDay, s.meta.currentDay)),
        },
      }))
      .sort((a, b) => b.rating - a.rating),
    mine,
    riders: s.staffAssignments
      .filter((a) => a.teamId === teamId)
      .map((a) => ({
        id: a.riderId,
        name: riderName(a.riderId),
        crewChief: nm(a.crewChiefId),
        trackEngineer: nm(a.trackEngineerId),
      })),
    mechanics: {
      count: mine.filter((m) => m.role === 'mechanic').length,
      reference: ref,
      factor: mechanicsFactor(s, teamId),
    },
    balance: teamBalance(s, teamId as TeamId),
  };
}
