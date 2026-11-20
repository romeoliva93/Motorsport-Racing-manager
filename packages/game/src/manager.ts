/**
 * Il manager (il giocatore): stipendio, soldi personali, corsi, reputazione e offerte di lavoro.
 *
 * - Lo stipendio lo paga la squadra ogni mese (è un costo del bilancio) e finisce nel portafoglio del manager.
 * - Con i suoi soldi il manager può frequentare corsi (negoziazione, rapporti commerciali, gestione tecnica:
 *   effetti reali su stipendi richiesti, sponsor e tempi di lavoro) o investire nella squadra.
 * - A fine stagione la reputazione cambia in base al risultato rispetto alle attese. Chi fa bene riceve
 *   offerte da altre squadre, ognuna con un compromesso: la squadra forte paga di più, quella media offre
 *   meno ma porta un pilota di punta, quella debole garantisce la moto migliore ma ha piloti modesti.
 *   Lo stipendio si tratta (al massimo tre rilanci), poi si firma o si rifiuta.
 */
import { GameCalendar, Rng, clamp, type IdFactory } from '@lean-angle/core';
import {
  MAX_PART_LEVEL,
  PART_KEYS,
  rows,
  type CategoryTier,
  type ContractId,
  type GameState,
  type JobOffer,
  type ManagerSkill,
  type ManagerState,
  type ManufacturerId,
  type RiderId,
  type TeamId,
  type TransactionId,
} from '@lean-angle/data';
import { activeRiderContract, aiFillVacancy, detachRider, equipRider, marketValue } from './market.ts';
import { addNews } from './news.ts';
import { chooseSupplier } from './suppliers.ts';
import { partLevel, setRiderLevel } from './upgrades.ts';
import { expectedPosition } from './sponsors.ts';
import { standings } from './weekend.ts';

/** Stipendio annuo del manager di una squadra media, per categoria. */
export const MANAGER_SALARY: Record<CategoryTier, number> = {
  premier: 1_200_000,
  intermediate: 300_000,
  lightweight: 120_000,
  rookies: 0,
};

export const COURSES: Record<ManagerSkill, { name: string; effect: (l: number) => string }> = {
  negotiation: {
    name: 'Negoziazione',
    effect: (l) => `piloti e tecnici chiedono il ${l * 4}% in meno`,
  },
  commercial: {
    name: 'Rapporti commerciali',
    effect: (l) => `sponsor mensili +${l * 4}%`,
  },
  technical: {
    name: 'Gestione tecnica',
    effect: (l) => `modifiche d'assetto nel weekend ${l * 8}% più rapide`,
  },
};
export const MAX_COURSE_LEVEL = 3;

function tierOf(s: GameState, teamId: string | null): CategoryTier {
  const e = teamId ? rows(s, 'teamEntries').find((x) => x.teamId === teamId) : undefined;
  return e ? s.tables.categories[e.categoryId]!.tier : 'premier';
}
const scale = (s: GameState) =>
  MANAGER_SALARY[tierOf(s, s.meta.playerTeamId)] / MANAGER_SALARY.premier || 0.1;

/** Costo del prossimo livello di un corso (sale a ogni livello, in proporzione alla categoria). */
export function courseCost(s: GameState, skill: ManagerSkill): number | null {
  const l = s.manager?.skills[skill] ?? 0;
  if (l >= MAX_COURSE_LEVEL) return null;
  return Math.round((250_000 * 2 ** l * scale(s)) / 10_000) * 10_000;
}

/** Crea il manager alla scelta della squadra (stipendio della categoria). */
export function ensureManager(s: GameState): ManagerState {
  if (!s.manager)
    s.manager = {
      reputation: 40,
      salary: MANAGER_SALARY[tierOf(s, s.meta.playerTeamId)],
      wallet: 0,
      skills: { negotiation: 0, commercial: 0, technical: 0 },
      offersYear: null,
      offers: [],
      history: [],
    };
  return s.manager;
}

function trx(
  s: GameState,
  ids: IdFactory,
  teamId: string,
  amount: number,
  category: 'salaries' | 'investors',
  note: string,
) {
  if (!amount) return;
  const id = ids.next('trx') as TransactionId;
  s.tables.transactions[id] = {
    id,
    teamId: teamId as TeamId,
    day: s.meta.currentDay,
    amount,
    category,
    note,
  };
}

/** Stipendio mensile del manager (lo paga la squadra, va nel portafoglio). */
export function managerMonthly(s: GameState): number {
  return s.manager ? Math.round(s.manager.salary / 12 / 1000) * 1000 : 0;
}
export function payManager(s: GameState, ids: IdFactory): void {
  const teamId = s.meta.playerTeamId;
  if (!teamId || !s.manager) return;
  const m = managerMonthly(s);
  trx(s, ids, teamId, -m, 'salaries', 'Stipendio del manager');
  s.manager.wallet += m;
}

export function validateCourse(s: GameState, skill: ManagerSkill): string | null {
  if (!s.manager) return 'Scegli prima una squadra';
  if (!COURSES[skill]) return 'Corso inesistente';
  const c = courseCost(s, skill);
  if (c === null) return 'Livello massimo già raggiunto';
  if (s.manager.wallet < c) return 'Soldi personali insufficienti';
  return null;
}
export function takeCourse(s: GameState, skill: ManagerSkill): void {
  const c = courseCost(s, skill)!;
  s.manager!.wallet -= c;
  s.manager!.skills[skill]++;
}

export function validateInvest(s: GameState, amount: number): string | null {
  if (!s.manager || !s.meta.playerTeamId) return 'Scegli prima una squadra';
  if (!Number.isFinite(amount) || amount < 10_000) return 'Importo minimo € 10.000';
  if (amount > s.manager.wallet) return 'Soldi personali insufficienti';
  return null;
}
export function investInTeam(s: GameState, ids: IdFactory, amount: number): void {
  s.manager!.wallet -= amount;
  trx(s, ids, s.meta.playerTeamId!, amount, 'investors', 'Investimento personale del manager');
  // Mettere soldi propri nella squadra è apprezzato.
  s.manager!.reputation = clamp(s.manager!.reputation + Math.min(3, amount / 1_000_000), 0, 100);
}

// ---------------------------------------------------------------------------------------------
function seasonOfPlayer(s: GameState) {
  const e = rows(s, 'teamEntries').find((x) => x.teamId === s.meta.playerTeamId);
  return e ? { entry: e, season: s.tables.seasons[e.seasonId]! } : null;
}

/**
 * Fine stagione (una volta per anno): aggiorna la reputazione e genera le offerte di lavoro.
 * Deterministico: stesso mondo e stessi risultati, stesse offerte.
 */
export function seasonReviewForManager(s: GameState, ids: IdFactory): void {
  const m = s.manager;
  const ps = seasonOfPlayer(s);
  if (!m || !ps || m.offersYear === ps.season.year) return;
  m.offersYear = ps.season.year;
  const st = standings(s, ps.season.id);
  const pos = st.teams.findIndex((t) => t.teamId === s.meta.playerTeamId) + 1;
  const exp = expectedPosition(s, s.meta.playerTeamId!);
  const perf = exp.position - pos;
  const topRider = st.riders.slice(0, 3).some((r) => r.teamId === s.meta.playerTeamId);
  m.reputation = clamp(
    Math.round(m.reputation + perf * 4 + (topRider ? 5 : 0) - (perf < -2 ? 3 : 0)),
    0,
    100,
  );
  m.history.push({
    year: ps.season.year,
    team: s.tables.teams[s.meta.playerTeamId!]!.name,
    position: pos,
    of: st.teams.length,
  });

  const score = perf + (topRider ? 1 : 0);
  const n = score >= 3 ? 3 : score >= 1 ? 2 : score >= 0 && m.reputation >= 50 ? 1 : 0;
  m.offers = n > 0 ? makeOffers(s, ps.entry.categoryId, ps.season.year, n) : [];
  if (m.offers.length)
    addNews(s, ids, {
      day: s.meta.currentDay,
      tag: 'mercato',
      title: `${m.offers.length === 1 ? 'Un’offerta' : `${m.offers.length} offerte`} di lavoro per te`,
      body: 'La tua stagione non è passata inosservata: alcune squadre ti vogliono come manager. Le trovi nel riepilogo di fine stagione.',
      mine: true,
    });
}

function makeOffers(s: GameState, categoryId: string, year: number, n: number): JobOffer[] {
  const rng = Rng.fromSeed(`${s.meta.seed}::lavoro::${year}`);
  const me = s.meta.playerTeamId!;
  const myRep = s.tables.teams[me]!.reputation;
  const base = MANAGER_SALARY[s.tables.categories[categoryId as never]!.tier];
  const rep = s.manager!.reputation;
  const teams = rows(s, 'teamEntries')
    .filter(
      (e) => e.categoryId === categoryId && e.teamId !== me && e.seasonId === seasonOfPlayer(s)!.season.id,
    )
    .map((e) => ({ e, t: s.tables.teams[e.teamId]! }))
    .filter((x) => x.t.type !== 'organizer')
    .sort((a, b) => b.t.reputation - a.t.reputation);
  const out: JobOffer[] = [];
  const take = (
    kind: JobOffer['kind'],
    pool: typeof teams,
    mult: [number, number],
    extra: Partial<JobOffer>,
  ) => {
    const pick = pool.find((x) => !out.some((o) => o.teamId === x.t.id));
    if (!pick) return;
    const salary =
      Math.round((base * rng.range(mult[0], mult[1]) * (1 + (rep - 50) / 250)) / 10_000) * 10_000;
    out.push({
      id: `job_${year}_${out.length + 1}`,
      teamId: pick.t.id,
      kind,
      salary,
      maxSalary: Math.round((salary * (1.12 + rep / 500)) / 10_000) * 10_000,
      years: 2,
      status: 'open',
      rounds: [],
      ...extra,
    });
  };
  const third = Math.max(1, Math.floor(teams.length / 3));
  const kinds: JobOffer['kind'][] =
    n >= 3 ? ['top', 'star', 'bike'] : n === 2 ? ['star', 'bike'] : [rng.chance(0.5) ? 'star' : 'bike'];
  for (const k of kinds) {
    if (k === 'top')
      take(
        'top',
        teams.filter((x) => x.t.reputation > myRep),
        [1.6, 1.9],
        {},
      );
    else if (k === 'star') {
      const mid = teams.slice(third, third * 2 + 1);
      const target = mid.find((x) => !out.some((o) => o.teamId === x.t.id));
      const star = target ? starFor(s, categoryId, target.t.id) : null;
      if (star) take('star', [target!], [0.95, 1.1], { starRiderId: star });
    } else {
      const weak = teams
        .slice(-third * 2)
        .reverse()
        .filter((x) => x.t.type !== 'factory');
      const best = rows(s, 'manufacturers')
        .filter((m) => m.categories.includes(categoryId as never))
        .sort((a, b) => b.engineeringStrength - a.engineeringStrength)[0];
      if (best) take('bike', weak, [0.85, 1.0], { manufacturerId: best.id, upgradeLevels: 1 });
    }
  }
  return out;
}

/** Pilota di punta che la squadra media promette di ingaggiare: il migliore della categoria fuori da lì. */
function starFor(s: GameState, categoryId: string, teamId: string): string | null {
  const rating = (r: { attributes: Record<string, number> }) => {
    const v = Object.values(r.attributes);
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  const inTeam = new Set(
    rows(s, 'teamEntries')
      .filter((e) => e.teamId === teamId || e.teamId === s.meta.playerTeamId)
      .flatMap((e) => e.seats.map((x) => x.riderId)),
  );
  const pool = rows(s, 'riders')
    .filter((r) => r.status !== 'retired' && r.role === 'race' && !inTeam.has(r.id))
    .filter((r) => r.categoryId === categoryId || r.status === 'free')
    .sort((a, b) => rating(b) - rating(a));
  return pool[0]?.id ?? null;
}

// ---------------------------------------------------------------------------------------------
export function validateNegotiate(s: GameState, offerId: string, ask: number): string | null {
  const o = s.manager?.offers.find((x) => x.id === offerId);
  if (!o) return 'Offerta inesistente';
  if (o.status !== 'open') return 'Questa offerta non è più valida';
  if (!Number.isFinite(ask) || ask < 0 || ask > 20_000_000) return 'Cifra non valida';
  return null;
}

/** Il manager chiede uno stipendio: la squadra accetta, rilancia o (al terzo rifiuto) si ritira. */
export function negotiateOffer(s: GameState, offerId: string, ask: number): JobOffer['rounds'][number] {
  const o = s.manager!.offers.find((x) => x.id === offerId)!;
  const ask1 = Math.round(ask / 10_000) * 10_000;
  let r: JobOffer['rounds'][number];
  if (ask1 <= o.salary) r = { ask: ask1, answer: 'accepted', offer: o.salary };
  else if (ask1 <= o.maxSalary) {
    o.salary = ask1;
    r = { ask: ask1, answer: 'accepted', offer: ask1 };
  } else if (o.rounds.length < 2) {
    o.salary = Math.round((o.salary + o.maxSalary) / 2 / 10_000) * 10_000;
    r = { ask: ask1, answer: 'countered', offer: o.salary };
  } else {
    o.status = 'withdrawn';
    r = { ask: ask1, answer: 'withdrawn', offer: o.salary };
  }
  o.rounds.push(r);
  return r;
}

export function validateAcceptJob(s: GameState, offerId: string): string | null {
  const o = s.manager?.offers.find((x) => x.id === offerId);
  if (!o) return 'Offerta inesistente';
  if (o.status !== 'open') return 'Questa offerta non è più valida';
  return null;
}

/**
 * Il manager firma: diventa il manager della nuova squadra (da subito, a stagione finita) con lo stipendio
 * concordato; la squadra mantiene la promessa (pilota di punta o moto al top).
 */
export function acceptJobOffer(s: GameState, ids: IdFactory, rng: Rng, offerId: string): void {
  const m = s.manager!;
  const o = m.offers.find((x) => x.id === offerId)!;
  const from = s.tables.teams[s.meta.playerTeamId!]!.name;
  const team = s.tables.teams[o.teamId as TeamId]!;
  o.status = 'accepted';
  for (const x of m.offers) if (x !== o && x.status === 'open') x.status = 'declined';
  s.meta.playerTeamId = o.teamId as TeamId;
  m.salary = o.salary;
  s.practice = undefined;
  let promise = '';
  if (o.kind === 'star' && o.starRiderId)
    promise = signStar(s, ids, rng, o.teamId as TeamId, o.starRiderId as RiderId);
  if (o.kind === 'bike' && o.manufacturerId) {
    chooseSupplier(s, ids, o.teamId as TeamId, o.manufacturerId as ManufacturerId);
    const up = (s.upgrades[o.teamId] ??= {});
    const add = o.upgradeLevels ?? 1;
    for (const rid of Object.keys(s.riderUpgrades?.[o.teamId] ?? {}))
      for (const k of PART_KEYS)
        setRiderLevel(s, o.teamId, rid, k, Math.min(MAX_PART_LEVEL, partLevel(s, o.teamId, k, rid) + add));
    for (const k of PART_KEYS) up[k] = Math.min(MAX_PART_LEVEL, (up[k] ?? 0) + add);
    promise = ` Moto ${s.tables.manufacturers[o.manufacturerId as ManufacturerId]!.name} con tutti i reparti sviluppati di un livello.`;
  }
  addNews(s, ids, {
    day: s.meta.currentDay,
    tag: 'squadra',
    title: `Il manager di ${from} passa a ${team.name}`,
    body: `Firmato un contratto di ${o.years} anni da € ${(o.salary / 1e6).toFixed(2).replace('.', ',')} mln all'anno.${promise}`,
    mine: true,
  });
}

/** Ingaggio del pilota promesso: prende il posto del pilota più debole della squadra. */
function signStar(s: GameState, ids: IdFactory, rng: Rng, teamId: TeamId, starId: RiderId): string {
  const star = s.tables.riders[starId];
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  if (!star || !entry) return '';
  const rating = (id: string | null) => {
    const r = id ? s.tables.riders[id as RiderId] : undefined;
    return r ? Object.values(r.attributes).reduce((a, b) => a + b, 0) : -1;
  };
  const weakest = [...entry.seats].sort((a, b) => rating(a.riderId) - rating(b.riderId))[0]!;
  if (weakest.riderId) {
    const out = s.tables.riders[weakest.riderId]!;
    const k = activeRiderContract(s, out.id);
    if (k) k.status = 'terminated';
    detachRider(s, teamId, out.id);
    out.status = 'free';
    out.categoryId = null;
  }
  // Il pilota lascia la sua squadra, che cerca un sostituto fra i liberi.
  const old = activeRiderContract(s, star.id);
  let vacated: TeamId | null = null;
  if (old) {
    old.status = 'terminated';
    if (detachRider(s, old.employerId, star.id).seatFreed) vacated = old.employerId as TeamId;
  }
  const cal = new GameCalendar(s.meta.startYear);
  const year = cal.toDate(s.meta.currentDay).year;
  const id = ids.next('ctr') as ContractId;
  const tier = s.tables.categories[entry.categoryId]!.tier;
  s.tables.contracts[id] = {
    id,
    kind: 'rider',
    employerId: teamId,
    counterpartyId: star.id,
    startDay: s.meta.currentDay,
    endDay: cal.fromDate({ year: year + 2, month: 12, day: 31 }),
    salary: marketValue(s, star, tier),
    bonuses: [],
    role: 'race',
    status: 'active',
  };
  star.status = 'active';
  star.role = 'race';
  star.categoryId = entry.categoryId;
  const seat = entry.seats.find((x) => x.riderId === null)!;
  seat.riderId = star.id;
  equipRider(s, teamId, star.id, ids);
  if (vacated && vacated !== teamId) aiFillVacancy(s, vacated, ids, rng);
  return ` Arriva ${star.firstName} ${star.lastName}, pilota di punta, con un contratto di due anni.`;
}

/** Le offerte non accettate decadono all'inizio della nuova stagione. */
export function closeOffers(s: GameState): void {
  for (const o of s.manager?.offers ?? []) if (o.status === 'open') o.status = 'declined';
}

// ---------------------------------------------------------------------------------------------
export interface ManagerView {
  reputation: number;
  salary: number;
  monthly: number;
  wallet: number;
  team: string;
  courses: {
    skill: ManagerSkill;
    name: string;
    level: number;
    max: number;
    effect: string;
    next: string | null;
    cost: number | null;
  }[];
  history: ManagerState['history'];
  seasonOver: boolean;
  offers: {
    id: string;
    kind: JobOffer['kind'];
    team: string;
    teamType: string;
    manufacturer: string;
    colors: { primary: string; secondary: string };
    reputation: number;
    salary: number;
    years: number;
    status: JobOffer['status'];
    pitch: string;
    riders: { name: string; rating: number }[];
    rounds: JobOffer['rounds'];
  }[];
}

export function managerView(s: GameState): ManagerView | null {
  const m = s.manager;
  const teamId = s.meta.playerTeamId;
  if (!m || !teamId) return null;
  const ratingOf = (id: string | null) => {
    const r = id ? s.tables.riders[id as RiderId] : undefined;
    if (!r) return null;
    const v = Object.values(r.attributes);
    return {
      name: `${r.firstName} ${r.lastName}`,
      rating: Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    };
  };
  const finished = rows(s, 'teamEntries').some(
    (e) => e.teamId === teamId && s.tables.seasons[e.seasonId]!.status === 'finished',
  );
  return {
    reputation: m.reputation,
    salary: m.salary,
    monthly: managerMonthly(s),
    wallet: m.wallet,
    team: s.tables.teams[teamId]!.name,
    courses: (Object.keys(COURSES) as ManagerSkill[]).map((k) => ({
      skill: k,
      name: COURSES[k].name,
      level: m.skills[k],
      max: MAX_COURSE_LEVEL,
      effect: m.skills[k] ? COURSES[k].effect(m.skills[k]) : 'nessun effetto',
      next: m.skills[k] < MAX_COURSE_LEVEL ? COURSES[k].effect(m.skills[k] + 1) : null,
      cost: courseCost(s, k),
    })),
    history: m.history,
    seasonOver: finished || m.offers.some((o) => o.status === 'open'),
    offers: m.offers.map((o) => {
      const t = s.tables.teams[o.teamId as TeamId]!;
      const e = rows(s, 'teamEntries').find((x) => x.teamId === o.teamId);
      const star = o.starRiderId ? ratingOf(o.starRiderId) : null;
      return {
        id: o.id,
        kind: o.kind,
        team: t.name,
        teamType: t.type,
        manufacturer: e ? s.tables.manufacturers[e.manufacturerId]!.name : '',
        colors: { primary: t.colors.primary, secondary: t.colors.secondary },
        reputation: t.reputation,
        salary: o.salary,
        years: o.years,
        status: o.status,
        pitch:
          o.kind === 'top'
            ? 'Squadra di vertice: ti offre più soldi e piloti forti.'
            : o.kind === 'star'
              ? `Ti offre meno, ma ingaggia per te ${star ? `${star.name} (${star.rating})` : 'un pilota di punta'}.`
              : `Squadra debole con piloti modesti, ma ti garantisce moto ${o.manufacturerId ? s.tables.manufacturers[o.manufacturerId as ManufacturerId]!.name : ''} e tutti i reparti sviluppati di un livello.`,
        riders: (e?.seats ?? [])
          .map((x) => ratingOf(x.riderId))
          .filter((x): x is { name: string; rating: number } => !!x),
        rounds: o.rounds,
      };
    }),
  };
}
