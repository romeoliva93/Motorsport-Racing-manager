/**
 * Mercato piloti (GDD §5): valutazione, trattative con controproposte, firma e sostituzioni.
 *
 * Il mercato è aperto a tutti i piloti, liberi o sotto contratto, di ogni categoria, fino all'inizio del
 * campionato. Il pilota valuta ogni offerta confrontandola con il suo valore di mercato e con il contratto
 * che ha già (stipendio, squadra, categoria), poi accetta, rifiuta o risponde con una controproposta.
 *
 * Formule principali (calibrate per un primo bilanciamento):
 *   valore      = stipendio base categoria × 1,12^(valutazione − media categoria) × fattore età
 *   richiesta   = max(valore, stipendio attuale × 1,15 se cambia squadra | × 1,05 se rinnova) × (1 + (ambizione − 60)/400)
 *   punteggio   = 0,6·min(offerta/richiesta, 1,25) + 0,25·(attrattiva nuova squadra − attuale)
 *                 + cambio di categoria (+0,15 per salire, −0,25 per scendere) − fedeltà + adattamento durata/ruolo
 *   punteggio ≥ 0,6 → accetta · altrimenti controproposta (se basta alzare lo stipendio e c'è pazienza) · altrimenti rifiuta
 */
import { GameCalendar, clamp, type IdFactory, type Rng } from '@lean-angle/core';
import {
  CATEGORIES_CONTENT,
  RIDER_ATTRIBUTES,
  RIDER_BASE_SALARY,
  SALARY_GROWTH_PER_POINT,
  rows,
  teamBalance,
  type CategoryTier,
  type Contract,
  type ContractOffer,
  type GameState,
  type Negotiation,
  type NegotiationRound,
  type Rider,
  type RiderId,
  type TeamEntry,
  type TeamId,
} from '@lean-angle/data';

const TIER_RANK: Record<CategoryTier, number> = { rookies: 0, lightweight: 1, intermediate: 2, premier: 3 };
const round10k = (x: number) => Math.round(x / 10_000) * 10_000;
const ratingOf = (r: Rider) =>
  RIDER_ATTRIBUTES.reduce((s, a) => s + r.attributes[a], 0) / RIDER_ATTRIBUTES.length;

export function activeRiderContract(s: GameState, riderId: string): Contract | undefined {
  return rows(s, 'contracts').find(
    (c) =>
      c.counterpartyId === riderId &&
      c.status === 'active' &&
      (c.kind === 'rider' || c.kind === 'substitute'),
  );
}

export function entryOf(s: GameState, teamId: string): TeamEntry | undefined {
  return rows(s, 'teamEntries').find((e) => e.teamId === teamId);
}

export function tierOfTeam(s: GameState, teamId: string): CategoryTier | null {
  const e = entryOf(s, teamId);
  return e ? s.tables.categories[e.categoryId]!.tier : null;
}

/** Categoria in cui il pilota corre oggi (null se libero). */
export function riderTier(s: GameState, r: Rider): CategoryTier | null {
  return r.categoryId ? s.tables.categories[r.categoryId]!.tier : null;
}

/** Il mercato è aperto fino al primo evento della stagione della squadra del giocatore. */
export function marketOpen(s: GameState): boolean {
  const teamId = s.meta.playerTeamId;
  if (!teamId) return false;
  const entry = entryOf(s, teamId);
  if (!entry) return false;
  const season = s.tables.seasons[entry.seasonId]!;
  const first = Math.min(...season.roundIds.map((id) => s.tables.rounds[id]!.startDay));
  return s.meta.currentDay < first;
}

/** Valore di mercato del pilota per una squadra della categoria indicata (stipendio annuo in euro). */
export function marketValue(s: GameState, r: Rider, tier: CategoryTier): number {
  const c = CATEGORIES_CONTENT.find((x) => x.key === tier)!;
  const age = new GameCalendar(s.meta.startYear).ageOn(r.birthDay, s.meta.currentDay);
  const ageFactor = age <= 22 ? 1 + (r.potential - ratingOf(r)) / 100 : age >= 33 ? 0.85 : 1;
  const base =
    RIDER_BASE_SALARY[tier] *
    Math.pow(SALARY_GROWTH_PER_POINT, ratingOf(r) - c.riderQuality.mean) *
    ageFactor;
  const floor = tier === 'premier' ? 250_000 : tier === 'intermediate' ? 60_000 : 20_000;
  return Math.max(floor, round10k(base));
}

/** Clausola di rescissione: stipendio residuo del contratto (minimo il 25% di un anno). */
export function buyoutFor(s: GameState, c: Contract | undefined): number {
  if (!c) return 0;
  const team = s.tables.teams[c.employerId];
  if (team?.type === 'organizer') return 0;
  if (c.role === 'academy') return 150_000;
  const yearsLeft = Math.max(0, (c.endDay - s.meta.currentDay) / 365);
  return round10k(Math.max(c.salary * 0.25, c.salary * yearsLeft));
}

/** Motivo per cui il pilota non può firmare per la squadra del giocatore (null = idoneo). */
export function ineligibility(s: GameState, r: Rider, teamId: TeamId, role: 'race' | 'test'): string | null {
  if (r.status === 'retired') return 'Ritirato';
  const entry = entryOf(s, teamId);
  if (!entry) return 'Squadra senza iscrizione';
  const season = s.tables.seasons[entry.seasonId]!;
  const reg = s.tables.regulations[season.regulationId]!;
  const cal = new GameCalendar(s.meta.startYear);
  const age = cal.ageOn(r.birthDay, cal.fromDate({ year: season.year, month: 1, day: 1 }));
  if (role === 'race') {
    if (age < reg.riderAge.min) return `Troppo giovane per la categoria (min. ${reg.riderAge.min} anni)`;
    if (reg.riderAge.max !== null && age > reg.riderAge.max)
      return `Troppo grande per la categoria (max. ${reg.riderAge.max} anni)`;
  }
  return null;
}

function teamAppeal(s: GameState, teamId: string | null): number {
  if (!teamId) return 0.3;
  const t = s.tables.teams[teamId as TeamId];
  const e = entryOf(s, teamId);
  if (!t || !e || t.type === 'organizer') return 0.35;
  const m = s.tables.manufacturers[e.manufacturerId]!;
  return (t.reputation / 100) * 0.6 + (m.engineeringStrength / 100) * 0.4;
}

export interface OfferEvaluation {
  response: NegotiationRound['response'];
  counter?: { salary: number; years: 1 | 2 | 3 };
  message: string;
  /** Richiesta di partenza (stipendio annuo), usata anche per i suggerimenti nell'interfaccia. */
  asking: number;
}

/** Richiesta salariale del pilota verso la squadra del giocatore. */
export function askingSalary(s: GameState, r: Rider, teamId: TeamId): number {
  const tier = tierOfTeam(s, teamId)!;
  const c = activeRiderContract(s, r.id);
  const renewal = c?.employerId === teamId;
  const fromContract = c ? c.salary * (renewal ? 1.05 : 1.15) : 0;
  return round10k(
    Math.max(marketValue(s, r, tier), fromContract) * (1 + (r.personality.ambition - 60) / 400),
  );
}

export function evaluateOffer(
  s: GameState,
  r: Rider,
  teamId: TeamId,
  offer: ContractOffer,
  patienceLeft: number,
  rng: Rng,
): OfferEvaluation {
  const name = `${r.firstName} ${r.lastName}`;
  const c = activeRiderContract(s, r.id);
  const renewal = c?.employerId === teamId;
  const asking = askingSalary(s, r, teamId);
  const toTier = tierOfTeam(s, teamId)!;
  const fromTier = riderTier(s, r);
  const age = new GameCalendar(s.meta.startYear).ageOn(r.birthDay, s.meta.currentDay);

  const bonusValue = (offer.winBonus * 0.5 + offer.podiumBonus * 2) / Math.max(asking, 1);
  const money = offer.salary / Math.max(asking, 1) + Math.min(0.08, bonusValue);
  let rest = 0;
  if (!renewal) {
    rest += 0.25 * (teamAppeal(s, teamId) - teamAppeal(s, c?.employerId ?? null));
    if (fromTier !== null) {
      const diff = TIER_RANK[toTier] - TIER_RANK[fromTier];
      rest += diff > 0 ? 0.15 * diff : 0.25 * diff;
    }
    if (c && s.tables.teams[c.employerId]?.type !== 'organizer') rest -= (r.personality.loyalty / 100) * 0.12;
    if (!c) rest += 0.08; // un pilota libero vuole tornare a correre
  }
  const prefYears = age >= 30 ? 3 : age <= 23 && r.potential - ratingOf(r) > 6 ? 2 : 2;
  rest -= 0.04 * Math.abs(offer.years - prefYears);
  if (offer.role === 'test' && r.role === 'race' && ratingOf(r) >= 60) rest -= 0.2;
  rest += rng.normal(0, 0.015);

  const score = 0.6 * Math.min(money, 1.25) + rest;
  if (score >= 0.6) {
    return {
      response: 'accepted',
      asking,
      message: renewal ? `${name} accetta il rinnovo.` : `Accordo raggiunto: ${name} è pronto a firmare.`,
    };
  }
  const neededMoney = (0.62 - rest) / 0.6;
  const canFix = neededMoney <= 1.25;
  if (patienceLeft <= 1) {
    return {
      response: 'rejected',
      asking,
      message: `${name} ha interrotto la trattativa: troppe offerte lontane dalle sue richieste.`,
    };
  }
  if (!canFix) {
    const why =
      fromTier !== null && TIER_RANK[toTier] < TIER_RANK[fromTier]
        ? `non vuole scendere di categoria`
        : c && !renewal
          ? `non è interessato a lasciare ${s.tables.teams[c.employerId]!.name}`
          : `il progetto non lo convince`;
    return { response: 'rejected', asking, message: `${name} ${why}.` };
  }
  const counterSalary = Math.max(
    round10k(asking * Math.max(neededMoney, 1) - (offer.winBonus * 0.5 + offer.podiumBonus * 2) * 0),
    offer.salary + 10_000,
  );
  const years = prefYears as 1 | 2 | 3;
  const lowball = money < 0.6;
  return {
    response: 'countered',
    asking,
    counter: { salary: round10k(counterSalary), years },
    message: lowball
      ? `Il manager di ${name}: «Offerta molto lontana. Per parlarne servono almeno ${fmt(counterSalary)} all'anno per ${years} ${years === 1 ? 'anno' : 'anni'}».`
      : `Il manager di ${name} chiede ${fmt(counterSalary)} all'anno per ${years} ${years === 1 ? 'anno' : 'anni'}.`,
  };
}

const fmt = (v: number) => `€ ${(v / 1_000_000).toFixed(2).replace('.', ',')} mln`;

// ---------------------------------------------------------------------------------------------
// Esecuzione della firma

/** Assegna al pilota un capotecnico e un ingegnere di pista liberi della squadra e le moto senza pilota. */
function equipRider(s: GameState, teamId: TeamId, riderId: RiderId, ids: IdFactory): void {
  const entry = entryOf(s, teamId)!;
  const cat = s.tables.categories[entry.categoryId]!;
  if (cat.teamsManaged) {
    const assigned = new Set(
      s.staffAssignments
        .filter((a) => a.teamId === teamId)
        .flatMap((a) => [a.crewChiefId, a.trackEngineerId]),
    );
    const staffOfTeam = rows(s, 'contracts')
      .filter((c) => c.employerId === teamId && c.kind === 'staff' && c.status === 'active')
      .map((c) => s.tables.staff[c.counterpartyId as `stf_${string}`]!)
      .filter((m) => m && !assigned.has(m.id));
    const cc = staffOfTeam.find((m) => m.role === 'crewChief');
    const te = staffOfTeam.find((m) => m.role === 'trackEngineer');
    if (cc && te) {
      s.staffAssignments.push({ teamId, riderId, crewChiefId: cc.id, trackEngineerId: te.id });
      for (const m of [cc, te]) {
        s.bonds.push({
          riderId,
          staffId: m.id,
          trust: 50,
          communication: 55,
          compatibility: 60,
          sharedSessions: 0,
          styleUnderstanding: 50,
          satisfaction: 60,
        });
      }
    }
  }
  const season = s.tables.seasons[entry.seasonId]!;
  const reg = s.tables.regulations[season.regulationId]!;
  const free = rows(s, 'bikes').filter(
    (b) => b.teamId === teamId && b.riderId === null && b.label !== 'test',
  );
  for (const slot of reg.bikesPerRider === 2 ? (['A', 'B'] as const) : (['A'] as const)) {
    const b = free.find((x) => x.slot === slot && x.riderId === null);
    if (b) b.riderId = riderId;
    else {
      const id = ids.next('bik');
      s.tables.bikes[id] = {
        id,
        teamId,
        riderId,
        categoryId: entry.categoryId,
        slot,
        label: slot === 'A' ? 'reference' : 'experimental',
        components: {},
        mileageKm: 0,
        wear: 0,
        readiness: 1,
        availability: 'ready',
      };
    }
  }
}

/** Il pilota lascia la squadra: posto vacante, staff e moto liberati. */
function detachRider(s: GameState, teamId: string, riderId: RiderId): { seatFreed: boolean } {
  let seatFreed = false;
  for (const e of rows(s, 'teamEntries').filter((x) => x.teamId === teamId)) {
    for (const seat of e.seats)
      if (seat.riderId === riderId) {
        seat.riderId = null;
        seatFreed = true;
      }
  }
  s.staffAssignments = s.staffAssignments.filter((a) => !(a.teamId === teamId && a.riderId === riderId));
  s.bonds = s.bonds.filter((b) => b.riderId !== riderId);
  for (const b of rows(s, 'bikes')) if (b.teamId === teamId && b.riderId === riderId) b.riderId = null;
  return { seatFreed };
}

function pay(s: GameState, ids: IdFactory, teamId: string, amount: number, note: string) {
  if (!s.accounts.some((a) => a.teamId === teamId) || amount === 0) return;
  const id = ids.next('trx');
  s.tables.transactions[id] = {
    id,
    teamId: teamId as TeamId,
    day: s.meta.currentDay,
    amount,
    category: 'other',
    note,
  };
}

export interface SigningResult {
  releasedRiderId: RiderId | null;
  vacatedTeamId: TeamId | null;
  aiSignedRiderId: RiderId | null;
}

export function executeSigning(
  s: GameState,
  neg: Negotiation,
  offer: ContractOffer,
  ids: IdFactory,
  rng: Rng,
): SigningResult {
  const cal = new GameCalendar(s.meta.startYear);
  const year = cal.toDate(s.meta.currentDay).year;
  const r = s.tables.riders[neg.riderId]!;
  const teamId = neg.teamId;
  const old = activeRiderContract(s, r.id);
  const result: SigningResult = { releasedRiderId: null, vacatedTeamId: null, aiSignedRiderId: null };

  if (old) old.status = 'terminated';
  if (neg.kind === 'transfer') {
    // Clausola: pagata dalla squadra del giocatore a quella di provenienza.
    if (neg.buyout > 0 && old) {
      pay(s, ids, teamId, -neg.buyout, `Clausola rescissoria di ${r.firstName} ${r.lastName}`);
      pay(s, ids, old.employerId, neg.buyout, `Cessione di ${r.firstName} ${r.lastName}`);
    }
    if (old) {
      const { seatFreed } = detachRider(s, old.employerId, r.id);
      if (seatFreed) result.vacatedTeamId = old.employerId as TeamId;
    }
    // Pilota sostituito nella squadra del giocatore: contratto risolto con indennità (50% del residuo).
    if (offer.role === 'race' && offer.replaceRiderId) {
      const out = s.tables.riders[offer.replaceRiderId]!;
      const oc = activeRiderContract(s, out.id);
      if (oc) {
        const residual = Math.max(0, ((oc.endDay - s.meta.currentDay) / 365) * oc.salary);
        pay(
          s,
          ids,
          teamId,
          -Math.round((residual * 0.5) / 1000) * 1000,
          `Risoluzione del contratto di ${out.firstName} ${out.lastName}`,
        );
        oc.status = 'terminated';
      }
      detachRider(s, teamId, out.id);
      out.status = 'free';
      out.categoryId = null;
      result.releasedRiderId = out.id;
    }
  }

  const id = ids.next('ctr');
  s.tables.contracts[id] = {
    id,
    kind: 'rider',
    employerId: teamId,
    counterpartyId: r.id,
    startDay: s.meta.currentDay,
    endDay: cal.fromDate({ year: year + offer.years - 1, month: 12, day: 31 }),
    salary: offer.salary,
    bonuses: [
      ...(offer.podiumBonus > 0 ? [{ condition: 'podium' as const, amount: offer.podiumBonus }] : []),
      ...(offer.winBonus > 0 ? [{ condition: 'win' as const, amount: offer.winBonus }] : []),
    ],
    role: offer.role,
    status: 'active',
  };
  r.status = 'active';
  r.role = offer.role;
  const entry = entryOf(s, teamId)!;
  if (neg.kind === 'transfer' && offer.role === 'race') {
    r.categoryId = entry.categoryId;
    const seat = entry.seats.find((x) => x.riderId === null)!;
    seat.riderId = r.id;
    equipRider(s, teamId, r.id, ids);
  } else if (neg.kind === 'transfer') {
    r.categoryId = null;
  }

  if (result.vacatedTeamId && result.vacatedTeamId !== teamId) {
    result.aiSignedRiderId = aiFillVacancy(s, result.vacatedTeamId, ids, rng);
  }
  return result;
}

/**
 * Una squadra gestita dall'IA ha un posto libero: ingaggia il miglior pilota libero idoneo che può
 * permettersi. Se non ne trova, il posto resta vacante (il regolamento lo consente).
 */
export function aiFillVacancy(s: GameState, teamId: TeamId, ids: IdFactory, rng: Rng): RiderId | null {
  const entry = entryOf(s, teamId);
  if (!entry) return null;
  const cat = s.tables.categories[entry.categoryId]!;
  const seat = entry.seats.find((x) => x.riderId === null);
  if (!seat) return null;
  const tier = cat.tier;
  const candidates = rows(s, 'riders')
    .filter(
      (r) =>
        r.status === 'free' && !activeRiderContract(s, r.id) && ineligibility(s, r, teamId, 'race') === null,
    )
    .sort((a, b) => ratingOf(b) - ratingOf(a));
  const budget = s.accounts.some((a) => a.teamId === teamId) ? teamBalance(s, teamId) : Infinity;
  const pick = candidates.find((r) => marketValue(s, r, tier) <= budget * 0.2) ?? null;
  if (!pick) return null;
  const cal = new GameCalendar(s.meta.startYear);
  const year = cal.toDate(s.meta.currentDay).year;
  const id = ids.next('ctr');
  s.tables.contracts[id] = {
    id,
    kind: 'rider',
    employerId: teamId,
    counterpartyId: pick.id,
    startDay: s.meta.currentDay,
    endDay: cal.fromDate({ year: year + rng.int(0, 1), month: 12, day: 31 }),
    salary: marketValue(s, pick, tier),
    bonuses: [],
    role: 'race',
    status: 'active',
  };
  pick.status = 'active';
  pick.role = 'race';
  pick.categoryId = entry.categoryId;
  seat.riderId = pick.id;
  if (cat.teamsManaged) equipRider(s, teamId, pick.id, ids);
  return pick.id;
}

export function clampOffer(o: ContractOffer): ContractOffer {
  return {
    ...o,
    salary: Math.max(0, Math.round(o.salary / 1000) * 1000),
    winBonus: Math.max(0, Math.round(o.winBonus / 1000) * 1000),
    podiumBonus: Math.max(0, Math.round(o.podiumBonus / 1000) * 1000),
    years: clamp(Math.round(o.years), 1, 3) as 1 | 2 | 3,
  };
}
