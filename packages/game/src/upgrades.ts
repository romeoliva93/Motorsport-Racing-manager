/**
 * Upgrade dei componenti della moto.
 *
 * Ogni componente ha un livello da 0 (di serie) a 3. Il livello n costa n × costo base della categoria e si paga
 * subito (voce "Sviluppo"). L'effetto è immediato dalla gara successiva: la somma dei bonus si aggiunge alla
 * qualità della moto usata dal motore di gara (weekend.ts → bikeOf).
 * Le squadre IA investono anche loro: il 1° di ogni mese, se hanno margine (saldo > 4 × costo), comprano un
 * upgrade con probabilità 35%.
 */
import type { IdFactory, Rng } from '@lean-angle/core';
import {
  MAX_PART_LEVEL,
  PARTS,
  PART_KEYS,
  UPGRADE_BASE_COST,
  rows,
  teamBalance,
  type GameState,
  type PartKey,
  type TeamId,
} from '@lean-angle/data';

export function partLevel(s: GameState, teamId: string, key: PartKey): number {
  return s.upgrades?.[teamId]?.[key] ?? 0;
}

export function upgradeCost(s: GameState, teamId: string, key: PartKey): number | null {
  const lvl = partLevel(s, teamId, key);
  if (lvl >= MAX_PART_LEVEL) return null;
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  if (!entry) return null;
  const base = UPGRADE_BASE_COST[s.tables.categories[entry.categoryId]!.tier];
  return base > 0 ? base * (lvl + 1) : null;
}

/** Bonus complessivo degli upgrade montati. */
export function upgradeBonus(
  s: GameState,
  teamId: string,
): { bike: number; reliability: number; tyreCare: number } {
  const out = { bike: 0, reliability: 0, tyreCare: 0 };
  for (const p of PARTS) {
    const l = partLevel(s, teamId, p.key);
    out.bike += p.bike * l;
    out.reliability += (p.reliability ?? 0) * l;
    out.tyreCare += (p.tyreCare ?? 0) * l;
  }
  return out;
}

export function buyUpgrade(s: GameState, ids: IdFactory, teamId: TeamId, key: PartKey): void {
  const cost = upgradeCost(s, teamId, key)!;
  const part = PARTS.find((p) => p.key === key)!;
  const lvl = partLevel(s, teamId, key) + 1;
  s.upgrades = s.upgrades ?? {};
  s.upgrades[teamId] = { ...(s.upgrades[teamId] ?? {}), [key]: lvl };
  const id = ids.next('trx');
  s.tables.transactions[id] = {
    id,
    teamId,
    day: s.meta.currentDay,
    amount: -cost,
    category: 'development',
    note: `Upgrade ${part.name.toLowerCase()} — livello ${lvl}`,
  };
}

export function aiUpgrades(s: GameState, ids: IdFactory, rng: Rng): void {
  for (const acc of s.accounts) {
    if (acc.teamId === s.meta.playerTeamId) continue;
    if (!rng.chance(0.35)) continue;
    const options = PART_KEYS.filter((k) => {
      const c = upgradeCost(s, acc.teamId, k);
      return c !== null && teamBalance(s, acc.teamId) > c * 4;
    });
    if (options.length === 0) continue;
    buyUpgrade(s, ids, acc.teamId, rng.pick(options));
  }
}
