/**
 * Esporta l'elenco dei personaggi da fotografare: `node tools/portraits/export.ts`
 * Scrive tools/portraits/roster.json con, per ognuno: chiave del ritratto, nome, sesso, età, nazionalità,
 * ruolo, squadra e colori (per la tuta/abbigliamento). Include i volti di riserva per i personaggi che nascono
 * durante la carriera.
 */
import { writeFileSync } from 'node:fs';
import { GameCalendar } from '../../packages/core/src/index.ts';
import {
  NAMES_CONTENT,
  PORTRAIT_POOL_SIZE,
  generateWorld,
  portraitKey,
  rows,
  type GameState,
  type TeamId,
} from '../../packages/data/src/index.ts';
import { UNIVERSE_SEED } from '../../packages/game/src/engine.ts';

const STAFF_ROLES = new Set(['technicalDirector', 'crewChief', 'trackEngineer', 'sportingDirector']);

const s: GameState = generateWorld({ seed: UNIVERSE_SEED });
const cal = new GameCalendar(s.meta.startYear);
const employer = new Map<string, TeamId>();
for (const c of rows(s, 'contracts'))
  if (c.status === 'active') employer.set(c.counterpartyId, c.employerId as TeamId);

const female = (nat: string, first: string) => NAMES_CONTENT[nat]?.female.includes(first) ?? false;
const teamOf = (id: string) => {
  const t = employer.get(id) ? s.tables.teams[employer.get(id)!] : undefined;
  return t
    ? {
        team: t.name,
        organizer: t.type === 'organizer',
        primary: t.colors.primary,
        secondary: t.colors.secondary,
      }
    : { team: null, organizer: false, primary: '#202124', secondary: '#5f6368' };
};

const out: Record<string, unknown>[] = [];
for (const r of rows(s, 'riders')) {
  out.push({
    key: portraitKey(r),
    kind: 'rider',
    name: `${r.firstName} ${r.lastName}`,
    female: female(r.nationality, r.firstName),
    age: cal.ageOn(r.birthDay, s.meta.currentDay),
    nationality: r.nationality,
    role: r.role,
    ...teamOf(r.id),
  });
}
for (const m of rows(s, 'staff')) {
  if (!STAFF_ROLES.has(m.role)) continue;
  out.push({
    key: portraitKey(m),
    kind: 'staff',
    name: `${m.firstName} ${m.lastName}`,
    female: female(m.nationality, m.firstName),
    age: cal.ageOn(m.birthDay, s.meta.currentDay),
    nationality: m.nationality,
    role: m.role,
    ...teamOf(m.id),
  });
}
// Volti di riserva (personaggi nati durante la carriera).
const NATS = [
  'ITA',
  'ESP',
  'FRA',
  'GBR',
  'GER',
  'JPN',
  'AUS',
  'NED',
  'POR',
  'ARG',
  'BRA',
  'THA',
  'INA',
  'USA',
  'CZE',
];
for (const [band, n] of Object.entries(PORTRAIT_POOL_SIZE)) {
  for (let i = 0; i < n; i++) {
    out.push({
      key: `pool-${band}-${String(i).padStart(3, '0')}`,
      kind: 'pool',
      name: null,
      female: i % 25 === 7,
      age: band === 'youth' ? 13 + (i % 5) : 18 + (i % 7),
      nationality: NATS[(i * 7) % NATS.length],
      role: 'race',
      team: null,
      organizer: band === 'youth',
      primary: '#202124',
      secondary: '#5f6368',
    });
  }
}
writeFileSync(new URL('./roster.json', import.meta.url), JSON.stringify(out, null, 1));
const count = (k: string) => out.filter((x) => x.kind === k).length;
console.log(
  `roster.json: ${count('rider')} piloti, ${count('staff')} staff, ${count('pool')} volti di riserva`,
);
