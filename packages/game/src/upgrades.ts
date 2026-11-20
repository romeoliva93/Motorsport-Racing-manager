/**
 * Upgrade dei componenti della moto.
 *
 * Ogni componente ha un livello da 0 (di serie) a 3. Il livello n costa n × costo base della categoria e si paga
 * all'ordine (voce "Sviluppo"). La fabbrica lo produce in UPGRADE_LEAD_DAYS × fattore fabbrica giorni
 * (fattore = 1,3 − 0,1 × livello medio dei reparti tecnici, fra 0,7 e 1,3); alla consegna viene montato e da lì
 * la somma dei bonus si aggiunge alla qualità della moto usata dal motore di gara (weekend.ts → bikeOf).
 * Un solo ordine alla volta per componente.
 * Le squadre IA investono anche loro: il 1° di ogni mese, se hanno margine (saldo > 4 × costo), comprano un
 * upgrade con probabilità 35%.
 */
import type { IdFactory, Rng } from '@lean-angle/core';
import {
  MAX_PART_LEVEL,
  PARTS,
  PART_KEYS,
  UPGRADE_BASE_COST,
  UPGRADE_LEAD_DAYS,
  rows,
  teamBalance,
  type GameState,
  type PartKey,
  type TeamId,
  type UpgradeOrderId,
} from '@lean-angle/data';
import { addNews } from './news.ts';
import { fitNewParts } from './garage.ts';
import { CONCESSION_COST, teamConcession } from './regulations.ts';
import { supplierPerks } from './suppliers.ts';
import { devFactor } from './preseasonEffects.ts';

export function partLevel(s: GameState, teamId: string, key: PartKey): number {
  return s.upgrades?.[teamId]?.[key] ?? 0;
}

export function pendingOrder(s: GameState, teamId: string, key: PartKey) {
  return rows(s, 'upgradeOrders').find(
    (o) => o.teamId === teamId && o.part === key && o.status === 'production',
  );
}

/** Fattore della fabbrica: reparti tecnici migliori producono più in fretta. */
export function factoryFactor(s: GameState, teamId: string): number {
  const dept = rows(s, 'facilities').filter(
    (f) =>
      f.teamId === teamId && ['engineDept', 'chassisDept', 'aeroDept', 'electronicsDept'].includes(f.type),
  );
  const avg = dept.length ? dept.reduce((t, f) => t + f.level, 0) / dept.length : 3;
  return Math.min(1.3, Math.max(0.7, 1.3 - 0.1 * avg));
}

export function leadDays(s: GameState, teamId: string, key: PartKey, level: number): number {
  const conc = CONCESSION_COST[teamConcession(s, teamId) ?? 'A'];
  return Math.round(
    UPGRADE_LEAD_DAYS[key][level - 1]! *
      factoryFactor(s, teamId) *
      conc *
      supplierPerks(s, teamId).leadTime *
      devFactor(s, teamId).lead,
  );
}

export function upgradeCost(s: GameState, teamId: string, key: PartKey): number | null {
  if (pendingOrder(s, teamId, key)) return null;
  const lvl = partLevel(s, teamId, key);
  if (lvl >= MAX_PART_LEVEL) return null;
  const entry = rows(s, 'teamEntries').find((e) => e.teamId === teamId);
  if (!entry) return null;
  const base = UPGRADE_BASE_COST[s.tables.categories[entry.categoryId]!.tier];
  const conc = CONCESSION_COST[teamConcession(s, teamId) ?? 'A'];
  const deal = supplierPerks(s, teamId).upgradeCost * devFactor(s, teamId).cost;
  return base > 0 ? Math.round((base * (lvl + 1) * conc * deal) / 10_000) * 10_000 : null;
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

/** Ordina il livello successivo: si paga subito, si monta alla consegna. */
export function buyUpgrade(s: GameState, ids: IdFactory, teamId: TeamId, key: PartKey): void {
  const cost = upgradeCost(s, teamId, key)!;
  const part = PARTS.find((p) => p.key === key)!;
  const level = partLevel(s, teamId, key) + 1;
  const id = ids.next('upo') as UpgradeOrderId;
  s.tables.upgradeOrders[id] = {
    id,
    teamId,
    part: key,
    level,
    orderedDay: s.meta.currentDay,
    readyDay: s.meta.currentDay + leadDays(s, teamId, key, level),
    status: 'production',
  };
  const trx = ids.next('trx');
  s.tables.transactions[trx] = {
    id: trx,
    teamId,
    day: s.meta.currentDay,
    amount: -cost,
    category: 'development',
    note: `Ordine ${part.name.toLowerCase()} — livello ${level}`,
  };
}

/** Consegne del giorno: il componente viene montato. Da chiamare ogni giorno. */
export function deliverUpgrades(s: GameState, ids: IdFactory): void {
  for (const o of rows(s, 'upgradeOrders')) {
    if (o.status !== 'production' || o.readyDay > s.meta.currentDay) continue;
    o.status = 'delivered';
    s.upgrades = s.upgrades ?? {};
    s.upgrades[o.teamId] = { ...(s.upgrades[o.teamId] ?? {}), [o.part]: o.level };
    fitNewParts(s, o.teamId, o.part);
    if (o.teamId === s.meta.playerTeamId) {
      const part = PARTS.find((p) => p.key === o.part)!;
      addNews(s, ids, {
        day: s.meta.currentDay,
        tag: 'squadra',
        mine: true,
        title: `${part.name}: consegnato il livello ${o.level}`,
        body: 'La fabbrica ha completato il pezzo: è già montato sulle moto per la prossima sessione.',
      });
    }
  }
}

export function aiUpgrades(s: GameState, ids: IdFactory, rng: Rng): void {
  for (const acc of s.accounts) {
    if (acc.teamId === s.meta.playerTeamId) continue;
    if (!rng.chance(0.35)) continue;
    const options = PART_KEYS.filter((k) => {
      const c = upgradeCost(s, acc.teamId, k);
      return c !== null && teamBalance(s, acc.teamId) > c * 6;
    });
    if (options.length === 0) continue;
    buyUpgrade(s, ids, acc.teamId, rng.pick(options));
  }
}
