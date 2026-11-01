/**
 * Passaggio alla stagione successiva (carriera pluriennale).
 *
 *  1. Nuove stagioni e calendari per tutte le categorie (stessi circuiti, anno successivo); le iscrizioni
 *     delle squadre passano alla nuova stagione.
 *  2. Contratti scaduti: i piloti del giocatore senza rinnovo diventano liberi; le squadre IA rinnovano
 *     il 70% dei propri piloti, gli altri diventano liberi. Lo staff viene rinnovato automaticamente
 *     (il mercato dello staff arriverà con la Fase 3).
 *  3. Crescita e declino: i giovani si avvicinano al loro potenziale, i veterani perdono qualcosa;
 *     a fine carriera alcuni si ritirano.
 *  4. Rookies Cup: escono i piloti troppo grandi, entrano nuovi ragazzi dai campionati nazionali.
 *  5. Le squadre IA riempiono i posti vuoti con i migliori piloti liberi; il mercato riapre fino al primo GP.
 */
import { GameCalendar, clamp, type IdFactory, type Rng } from '@lean-angle/core';
import {
  NAMES_CONTENT,
  RIDER_ATTRIBUTES,
  RIDER_NATIONALITY_WEIGHTS,
  isBlockedSurname,
  rows,
  type GameState,
  type Rider,
  type RiderAttribute,
  type RiderId,
  type RoundId,
  type SeasonId,
  type TeamId,
} from '@lean-angle/data';
import { activeRiderContract, aiFillVacancy, marketValue } from './market.ts';
import { addNews } from './news.ts';

const PHYSICAL: RiderAttribute[] = ['speed', 'acceleration', 'fitness', 'braking', 'concentration'];
const rating = (x: number) => Math.round(clamp(x, 1, 99));
const avg = (r: Rider) => RIDER_ATTRIBUTES.reduce((t, a) => t + r.attributes[a], 0) / RIDER_ATTRIBUTES.length;

export function seasonFinished(s: GameState): boolean {
  const teamId = s.meta.playerTeamId;
  const entry = teamId ? rows(s, 'teamEntries').find((e) => e.teamId === teamId) : undefined;
  return !!entry && s.tables.seasons[entry.seasonId]!.status === 'finished';
}

export function startNextSeason(s: GameState, ids: IdFactory, rng: Rng): number {
  const cal = new GameCalendar(s.meta.startYear);
  const year = cal.toDate(s.meta.currentDay).year;
  const next = year + 1;
  // Si riparte dal 1° gennaio dell'anno successivo.
  s.meta.currentDay = Math.max(s.meta.currentDay, cal.fromDate({ year: next, month: 1, day: 1 }));

  // 1. Nuove stagioni.
  const seasonMap = new Map<string, SeasonId>();
  for (const old of rows(s, 'seasons').filter((x) => x.year === year)) {
    old.status = 'finished';
    const oldReg = s.tables.regulations[old.regulationId]!;
    const regId = ids.next('reg');
    s.tables.regulations[regId] = { ...structuredCopy(oldReg), id: regId, season: next };
    const seasonId = ids.next('ssn') as SeasonId;
    const roundIds: RoundId[] = old.roundIds.map((rid, i) => {
      const r = s.tables.rounds[rid]!;
      const d = cal.toDate(r.startDay);
      const id = ids.next('rnd') as RoundId;
      s.tables.rounds[id] = {
        id,
        seasonId,
        number: i + 1,
        circuitId: r.circuitId,
        startDay: cal.fromDate({ year: next, month: d.month, day: Math.min(d.day, 28) }),
      };
      return id;
    });
    s.tables.seasons[seasonId] = {
      id: seasonId,
      year: next,
      categoryId: old.categoryId,
      regulationId: regId,
      roundIds,
      status: 'planned',
    };
    seasonMap.set(old.id, seasonId);
  }
  for (const e of rows(s, 'teamEntries')) {
    const ns = seasonMap.get(e.seasonId);
    if (ns) e.seasonId = ns;
  }

  // 2. Contratti scaduti.
  const endOfYear = cal.fromDate({ year, month: 12, day: 31 });
  const player = s.meta.playerTeamId;
  for (const c of rows(s, 'contracts').filter((x) => x.status === 'active' && x.endDay <= endOfYear)) {
    const team = s.tables.teams[c.employerId];
    if (c.kind === 'staff') {
      c.endDay = cal.fromDate({ year: next + rng.int(0, 1), month: 12, day: 31 });
      continue;
    }
    if (c.kind !== 'rider' && c.kind !== 'substitute') continue;
    const r = s.tables.riders[c.counterpartyId as RiderId];
    if (!r) continue;
    const isOrganizer = team?.type === 'organizer';
    const renew = !isOrganizer && c.employerId !== player && rng.chance(0.7) && c.role !== 'academy';
    if (renew) {
      const entry = rows(s, 'teamEntries').find((e) => e.teamId === c.employerId);
      const tier = entry ? s.tables.categories[entry.categoryId]!.tier : 'premier';
      c.endDay = cal.fromDate({ year: next + rng.int(0, 1), month: 12, day: 31 });
      c.salary = marketValue(s, r, tier);
      continue;
    }
    if (isOrganizer && c.role !== 'reserve') {
      // Seconda stagione Rookies consentita se ha ancora l'età giusta.
      const age = cal.ageOn(r.birthDay, cal.fromDate({ year: next, month: 1, day: 1 }));
      if (age <= 16 && rng.chance(0.6)) {
        c.endDay = cal.fromDate({ year: next, month: 12, day: 31 });
        continue;
      }
    }
    c.status = 'ended';
    leaveTeam(s, c.employerId as TeamId, r);
    if (c.employerId === player) {
      addNews(s, ids, {
        day: s.meta.currentDay,
        tag: 'mercato',
        mine: true,
        title: `${r.firstName} ${r.lastName} lascia la squadra`,
        body: 'Contratto scaduto senza rinnovo: il pilota è ora libero sul mercato.',
      });
    }
  }

  // 3. Crescita, declino, ritiri.
  for (const r of rows(s, 'riders')) {
    if (r.status === 'retired') continue;
    const age = cal.ageOn(r.birthDay, s.meta.currentDay);
    const gap = r.potential - avg(r);
    for (const a of RIDER_ATTRIBUTES) {
      let d: number;
      if (age < 26) d = Math.max(0, gap) * rng.range(0.15, 0.45) + rng.normal(0, 1);
      else if (age <= 30) d = rng.normal(0.2, 1);
      else d = (PHYSICAL.includes(a) ? -rng.range(0.8, 2.6) : -rng.range(0, 1)) * (age > 34 ? 1.6 : 1);
      r.attributes[a] = rating(r.attributes[a] + d);
    }
    if (age >= 35 && (rng.chance(0.35) || (age >= 38 && rng.chance(0.8)))) {
      const c = activeRiderContract(s, r.id);
      if (c && c.employerId === player) continue; // i piloti del giocatore decidono a fine contratto
      if (c) {
        c.status = 'ended';
        leaveTeam(s, c.employerId as TeamId, r);
      }
      r.status = 'retired';
      addNews(s, ids, {
        day: s.meta.currentDay,
        tag: 'mercato',
        mine: false,
        title: `${r.firstName} ${r.lastName} si ritira`,
        body: `A ${age} anni chiude la carriera.`,
      });
    }
  }

  // 4. Rookies Cup: nuovi ragazzi.
  const rookiesEntry = rows(s, 'teamEntries').find((e) => s.tables.teams[e.teamId]!.type === 'organizer');
  if (rookiesEntry) {
    let added = 0;
    for (const seat of rookiesEntry.seats) {
      if (seat.riderId !== null) continue;
      const r = newRider(s, ids, rng, next, rng.int(13, 15), 46);
      const id = ids.next('ctr');
      s.tables.contracts[id] = {
        id,
        kind: 'rider',
        employerId: rookiesEntry.teamId,
        counterpartyId: r.id,
        startDay: s.meta.currentDay,
        endDay: cal.fromDate({ year: next, month: 12, day: 31 }),
        salary: 0,
        bonuses: [],
        role: 'rookie',
        status: 'active',
      };
      r.categoryId = rookiesEntry.categoryId;
      seat.riderId = r.id;
      for (const b of rows(s, 'bikes'))
        if (b.teamId === rookiesEntry.teamId && b.riderId === null) {
          b.riderId = r.id;
          break;
        }
      added++;
    }
    if (added)
      addNews(s, ids, {
        day: s.meta.currentDay,
        tag: 'campionato',
        mine: false,
        title: `Rookies Cup ${next}: ${added} nuovi piloti`,
        body: 'I migliori dei campionati nazionali giovanili entrano nella Rookies Cup.',
      });
  }

  // 5. Le squadre IA riempiono i posti vuoti (prima le categorie più alte).
  const order = ['premier', 'intermediate', 'lightweight'];
  for (const tier of order) {
    for (const e of rows(s, 'teamEntries')) {
      if (e.teamId === player || s.tables.categories[e.categoryId]!.tier !== tier) continue;
      for (let guard = 0; guard < 4 && e.seats.some((x) => x.riderId === null); guard++) {
        if (aiFillVacancy(s, e.teamId, ids, rng)) continue;
        // Nessun pilota libero adatto: arriva un giovane dai campionati nazionali.
        const q = { premier: 66, intermediate: 58, lightweight: 50, rookies: 46 }[tier as 'premier'];
        const p = newRider(s, ids, rng, next, rng.int(19, 23), q);
        p.status = 'free';
      }
    }
  }
  for (const n of rows(s, 'negotiations')) if (n.status === 'open') n.status = 'withdrawn';
  addNews(s, ids, {
    day: s.meta.currentDay,
    tag: 'campionato',
    mine: true,
    title: `Inizia la stagione ${next}`,
    body: 'Il mercato è aperto fino al primo Gran Premio: controlla i contratti in scadenza e i posti liberi.',
  });
  return next;
}

function leaveTeam(s: GameState, teamId: TeamId, r: Rider) {
  for (const e of rows(s, 'teamEntries').filter((x) => x.teamId === teamId))
    for (const seat of e.seats) if (seat.riderId === r.id) seat.riderId = null;
  s.staffAssignments = s.staffAssignments.filter((a) => !(a.teamId === teamId && a.riderId === r.id));
  s.bonds = s.bonds.filter((b) => b.riderId !== r.id);
  for (const b of rows(s, 'bikes')) if (b.teamId === teamId && b.riderId === r.id) b.riderId = null;
  r.categoryId = null;
  if (r.status !== 'retired') r.status = 'free';
}

function newRider(s: GameState, ids: IdFactory, rng: Rng, year: number, age: number, mean: number): Rider {
  const cal = new GameCalendar(s.meta.startYear);
  const keys = Object.keys(RIDER_NATIONALITY_WEIGHTS).sort();
  const used = new Set(rows(s, 'riders').map((r) => `${r.firstName} ${r.lastName}`));
  let nat = 'ITA',
    first = '',
    last = '';
  for (let i = 0; i < 200; i++) {
    nat = rng.weightedPick(
      keys,
      keys.map((k) => RIDER_NATIONALITY_WEIGHTS[k] as number),
    );
    const pool = NAMES_CONTENT[nat]!;
    first = rng.pick(pool.male);
    last = rng.pick(pool.last);
    if (!used.has(`${first} ${last}`) && !isBlockedSurname(last)) break;
  }
  const q = clamp(rng.normal(mean, 7), mean - 14, mean + 18);
  const id = ids.next('rdr') as RiderId;
  const r: Rider = {
    id,
    firstName: first,
    lastName: last,
    nationality: nat,
    birthDay: cal.fromDate({ year: year - age - 1, month: 1, day: 2 }) + rng.int(0, 360),
    reputation: rating(q * 0.6),
    morale: rng.int(60, 85),
    personality: {
      ambition: rng.int(40, 95),
      loyalty: rng.int(25, 90),
      temperament: rng.int(20, 90),
      professionalism: rng.int(40, 95),
      mediaSavvy: rng.int(20, 80),
    },
    status: 'active',
    categoryId: null,
    role: 'race',
    attributes: Object.fromEntries(RIDER_ATTRIBUTES.map((a) => [a, rating(q + rng.normal(0, 4))])) as Record<
      RiderAttribute,
      number
    >,
    potential: rating(q + (28 - age) * rng.range(0.8, 2.2)),
    form: 0,
    fatigue: 0,
  };
  s.tables.riders[id] = r;
  return r;
}

function structuredCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}
