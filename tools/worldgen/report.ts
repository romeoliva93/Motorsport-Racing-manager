/**
 * Report testuale del mondo generato: `node tools/worldgen/report.ts [seme]`.
 * Utile per controllare a colpo d'occhio la credibilità dei contenuti (non è usato dal gioco).
 */
import { GameCalendar, formatCredits } from '../../packages/core/src/index.ts';
import {
  generateWorld,
  rows,
  teamBalance,
  validateGameState,
  RIDER_ATTRIBUTES,
} from '../../packages/data/src/index.ts';
import type { Rider } from '../../packages/data/src/index.ts';

const seed = process.argv[2] ?? 'lean-angle';
const t0 = performance.now();
const w = generateWorld({ seed });
const ms = performance.now() - t0;
const cal = new GameCalendar(w.meta.startYear);
const avg = (r: Rider) =>
  Math.round(RIDER_ATTRIBUTES.reduce((s, a) => s + r.attributes[a], 0) / RIDER_ATTRIBUTES.length);
const out: string[] = [];
const p = (s = '') => out.push(s);

p(
  `Seme "${seed}" · generato in ${ms.toFixed(0)} ms · problemi del validatore: ${validateGameState(w).length}`,
);
const count = Object.fromEntries(Object.entries(w.tables).map(([k, v]) => [k, Object.keys(v).length]));
p(
  `Entità: ${Object.entries(count)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')}`,
);
p(
  `Assegnazioni staff ${w.staffAssignments.length} · rapporti pilota-staff ${w.bonds.length} · conti ${w.accounts.length}`,
);
for (const cat of rows(w, 'categories')) {
  const reg = rows(w, 'regulations').find((r) => r.categoryId === cat.id)!;
  const season = rows(w, 'seasons').find((s) => s.categoryId === cat.id)!;
  p();
  p(
    `== ${cat.name} · ${season.roundIds.length} round · moto per pilota: ${reg.bikesPerRider} · flag-to-flag: ${reg.flagToFlag ? 'sì' : 'no'}`,
  );
  const entries = rows(w, 'teamEntries').filter((e) => e.categoryId === cat.id);
  for (const e of entries) {
    const t = w.tables.teams[e.teamId]!;
    const mfr = w.tables.manufacturers[e.manufacturerId]!;
    const riders = e.seats.map((s) => {
      const r = w.tables.riders[s.riderId!]!;
      return `#${s.number} ${r.firstName} ${r.lastName} (${r.nationality}, ${cal.ageOn(r.birthDay, 0)}, ${avg(r)})`;
    });
    const bal = w.accounts.some((a) => a.teamId === t.id) ? formatCredits(teamBalance(w, t.id)) : '—';
    const label = cat.tier === 'rookies' ? `${riders.length} piloti` : riders.join(' · ');
    p(`  ${t.name.padEnd(26)} ${t.type.padEnd(11)} ${mfr.name.padEnd(18)} ${bal.padStart(11)}  ${label}`);
  }
  if (cat.tier === 'rookies') {
    const e = entries[0]!;
    const top = e.seats
      .map((s) => w.tables.riders[s.riderId!]!)
      .sort((a, b) => avg(b) - avg(a))
      .slice(0, 5);
    p(
      `  migliori: ${top.map((r) => `${r.firstName} ${r.lastName} (${r.nationality}, ${cal.ageOn(r.birthDay, 0)}, ${avg(r)}, pot. ${r.potential})`).join(' · ')}`,
    );
  }
}
p();
p(
  `Liberi: ${rows(w, 'riders').filter((r) => r.status === 'free').length} piloti, ${rows(w, 'staff').filter((s) => s.status === 'free').length} membri dello staff`,
);
console.log(out.join('\n'));
