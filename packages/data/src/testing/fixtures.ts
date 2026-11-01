/**
 * Mini-mondo valido per i test: Premier (2 moto per pilota) + Lightweight (1 moto per pilota).
 * Non è il contenuto del gioco (quello arriverà con il generatore del mondo, M1.4).
 */
import { GameCalendar, IdFactory } from '@lean-angle/core';
import { createEmptyGameState, type GameState } from '../schema/state.ts';
import type { Regulation, CategoryTier } from '../schema/world.ts';
import type { Rider, RiderAttribute, StaffMember, StaffRole } from '../schema/people.ts';
import { RIDER_ATTRIBUTES } from '../schema/people.ts';
import type { TeamId } from '../schema/org.ts';
import type { Bike } from '../schema/tech.ts';
import { insert } from '../tables.ts';

export function buildMiniWorld(): GameState {
  const ids = new IdFactory();
  const cal = new GameCalendar(2027);
  const s = createEmptyGameState({
    saveName: 'test',
    seed: 'test-seed',
    startYear: 2027,
    currentDay: 0,
    playerTeamId: null,
    difficulty: 'normal',
  });
  const day = (y: number, m: number, d: number) => cal.fromDate({ year: y, month: m, day: d });
  const personality = { ambition: 60, loyalty: 60, temperament: 50, professionalism: 70, mediaSavvy: 50 };
  const attrs = (v: number) =>
    Object.fromEntries(RIDER_ATTRIBUTES.map((a) => [a, v])) as Record<RiderAttribute, number>;

  insert(s, 'federations', {
    id: ids.next('fed'),
    name: 'International Velocity Federation',
    acronym: 'IVF',
  });
  const circuit = ids.next('cir');
  insert(s, 'circuits', {
    id: circuit,
    name: 'Brennholz-Ring',
    country: 'GER',
    lengthM: 4620,
    turns: 14,
    abrasiveness: 0.5,
    overtaking: 0.7,
  });

  const mfr = ids.next('mfr');
  insert(s, 'manufacturers', {
    id: mfr,
    name: 'Ardena',
    country: 'ITA',
    categories: [],
    engineeringStrength: 80,
    philosophy: 'potenza',
  });

  function category(tier: CategoryTier, bikes: 1 | 2, ageMin: number, ageMax: number | null) {
    const cat = ids.next('cat');
    insert(s, 'categories', { id: cat, tier, name: tier, maxGrid: 30, teamsManaged: tier !== 'rookies' });
    const reg: Regulation = {
      id: ids.next('reg'),
      categoryId: cat,
      season: 2027,
      points: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
      sprintPoints: [12, 9, 7, 6, 5, 4, 3, 2, 1],
      weekendFormat: [
        { type: 'FP', minutes: 45 },
        { type: 'RACE', laps: 27 },
      ],
      bikesPerRider: bikes,
      flagToFlag: bikes === 2,
      enginesPerSeason: bikes === 2 ? 7 : 6,
      testBikesPerTeam: bikes === 2 ? 2 : 1,
      riderAge: { min: ageMin, max: ageMax },
      radioPolicy: 'dashboard',
      substitution: {
        allowed: 'yes',
        vacancyAllowed: true,
        participationFeeReductionPerRound: bikes === 2 ? 45_000 : null,
        entryDeadlineDaysBefore: 3,
      },
      inSeasonTests: { everyRounds: bikes === 2 ? 5 : null, sessions: 2 },
    };
    insert(s, 'regulations', reg);
    const season = ids.next('ssn');
    const round = ids.next('rnd');
    insert(s, 'rounds', {
      id: round,
      seasonId: season,
      number: 1,
      circuitId: circuit,
      startDay: day(2027, 3, 4),
    });
    insert(s, 'seasons', {
      id: season,
      year: 2027,
      categoryId: cat,
      regulationId: reg.id,
      roundIds: [round],
      status: 'planned',
    });
    s.tables.manufacturers[mfr]!.categories.push(cat);
    return { cat, reg, season };
  }

  function person<T extends 'rdr' | 'stf'>(prefix: T, first: string, last: string, birthYear: number) {
    return {
      id: ids.next(prefix),
      firstName: first,
      lastName: last,
      nationality: 'ITA',
      birthDay: day(birthYear, 5, 10),
      reputation: 50,
      morale: 70,
      personality,
      status: 'active' as const,
    };
  }

  function team(
    name: string,
    catInfo: ReturnType<typeof category>,
    riderSpecs: [string, string, number, number][],
  ) {
    const teamId = ids.next('tem') as TeamId;
    insert(s, 'teams', {
      id: teamId,
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      nationality: 'ITA',
      baseCity: 'Bologna',
      founded: 1998,
      type: 'factory',
      colors: { primary: '#2a6cf0', secondary: '#0d1530' },
      reputation: 70,
      owner: { kind: 'manufacturer', manufacturerId: mfr },
    });
    s.accounts.push({ teamId, openingBalance: 20_000_000, creditLimit: 5_000_000 });
    const seats = [];
    for (const [first, last, birthYear, number] of riderSpecs) {
      const rider: Rider = {
        ...person('rdr', first, last, birthYear),
        categoryId: catInfo.cat,
        role: 'race',
        attributes: attrs(75),
        potential: 85,
        form: 0,
        fatigue: 0,
      } as Rider;
      insert(s, 'riders', rider);
      insert(s, 'contracts', {
        id: ids.next('ctr'),
        kind: 'rider',
        employerId: teamId,
        counterpartyId: rider.id,
        startDay: 0,
        endDay: day(2028, 12, 31),
        salary: 1_000_000,
        bonuses: [{ condition: 'podium', amount: 50_000 }],
        role: 'race',
        status: 'active',
      });
      const staffOf = (role: StaffRole, lastName: string): StaffMember => {
        const m = {
          ...person('stf', 'Staff', lastName, 1980),
          role,
          specialization: 'trackside',
          skills: { diagnosis: 70 },
          experienceYears: 10,
          potential: 75,
        } as StaffMember;
        insert(s, 'staff', m);
        insert(s, 'contracts', {
          id: ids.next('ctr'),
          kind: 'staff',
          employerId: teamId,
          counterpartyId: m.id,
          startDay: 0,
          endDay: day(2028, 12, 31),
          salary: 300_000,
          bonuses: [],
          role,
          status: 'active',
        });
        return m;
      };
      const cc = staffOf('crewChief', `CC-${last}`);
      const te = staffOf('trackEngineer', `TE-${last}`);
      s.staffAssignments.push({ teamId, riderId: rider.id, crewChiefId: cc.id, trackEngineerId: te.id });
      s.bonds.push({
        riderId: rider.id,
        staffId: te.id,
        trust: 60,
        communication: 60,
        compatibility: 60,
        sharedSessions: 0,
        styleUnderstanding: 40,
        satisfaction: 60,
      });
      for (const slot of catInfo.reg.bikesPerRider === 2 ? (['A', 'B'] as const) : (['A'] as const)) {
        const bike: Bike = {
          id: ids.next('bik'),
          teamId,
          riderId: rider.id,
          categoryId: catInfo.cat,
          slot,
          label: slot === 'A' ? 'reference' : 'experimental',
          components: {},
          mileageKm: 0,
          wear: 0,
          readiness: 1,
          availability: 'ready',
        };
        insert(s, 'bikes', bike);
      }
      seats.push({ number, riderId: rider.id });
    }
    insert(s, 'teamEntries', {
      id: ids.next('ent'),
      teamId,
      categoryId: catInfo.cat,
      seasonId: catInfo.season,
      manufacturerId: mfr,
      seats,
    });
    return teamId;
  }

  const premier = category('premier', 2, 18, null);
  const light = category('lightweight', 1, 16, 28);
  team('Scuderia Lupo Blu', premier, [
    ['Teo', 'Varriale', 2003, 27],
    ['Rafa', 'Oyarzún', 2006, 61],
  ]);
  team('Lupo Blu Junior', light, [
    ['Fabrizio', 'Vitellino', 2010, 44],
    ['Noa', 'Lindgren', 2009, 9],
  ]);

  s.idCounters = ids.snapshot();
  return s;
}
