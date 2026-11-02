/**
 * Garage: usura dei 14 componenti di ogni moto (vedi content/garage.ts).
 *
 * - Ogni sessione aggiunge chilometri: le prove (FP, Prove, Warm Up) si dividono fra moto A e B quando il
 *   regolamento ne concede due; qualifiche, Sprint e gara si corrono sulla moto A.
 * - Usura = km / (vita × GARAGE_WEEKEND_KM). Fino al 50% il pezzo è perfetto; oltre perde affidabilità
 *   (1 − 0,16 × (usura − 0,5)), quindi a fine vita vale 0,92 e continua a scendere se non si revisiona.
 * - L'affidabilità della moto in gara è quella di base × prodotto dei componenti^0,2: un pezzo trascurato pesa
 *   poco, molti pezzi trascurati aumentano parecchio il rischio di guasto.
 * - MotoGP: il motore segue il regolamento (un motore nuovo ogni ENGINE_LIFE weekend, dalla dotazione), non si
 *   revisiona a mano.
 * - Le squadre IA revisionano da sole i pezzi oltre il 90% prima di ogni weekend, pagando.
 */
import type { IdFactory } from '@lean-angle/core';
import {
  GARAGE_PARTS,
  GARAGE_WEEKEND_KM,
  SESSION_KM_LAPS,
  UPGRADE_BASE_COST,
  rows,
  teamBalance,
  type Bike,
  type GameState,
  type GarageKey,
  type Round,
} from '@lean-angle/data';
import { ENGINE_LIFE } from './regulations.ts';

export const partDef = (key: GarageKey) => GARAGE_PARTS.find((p) => p.key === key)!;

const tierOfBike = (s: GameState, b: Bike) => s.tables.categories[b.categoryId]!.tier;

export function partWear(b: Bike, key: GarageKey): number {
  return (b.parts?.[key]?.km ?? 0) / (partDef(key).life * GARAGE_WEEKEND_KM);
}

export function partReliability(wear: number): number {
  return Math.max(0.6, 1 - 0.16 * Math.max(0, wear - 0.5));
}

/** Fattore (0–1) che moltiplica l'affidabilità della moto in gara. */
export function bikeReliabilityFactor(b: Bike | undefined): number {
  if (!b) return 1;
  return GARAGE_PARTS.reduce((t, p) => t * Math.pow(partReliability(partWear(b, p.key)), 0.2), 1);
}

export function serviceCost(s: GameState, b: Bike, key: GarageKey): number {
  const base = UPGRADE_BASE_COST[tierOfBike(s, b)];
  return Math.round((base * partDef(key).cost) / 1000) * 1000;
}

export function canService(s: GameState, b: Bike, key: GarageKey): boolean {
  return !(key === 'engine' && tierOfBike(s, b) === 'premier');
}

export function mainBike(s: GameState, riderId: string): Bike | undefined {
  const own = rows(s, 'bikes').filter((b) => b.riderId === riderId);
  return own.find((b) => b.slot === 'A') ?? own[0];
}

function addKm(b: Bike, km: number) {
  b.parts = b.parts ?? {};
  for (const p of GARAGE_PARTS) {
    const cur = b.parts[p.key] ?? { km: 0, services: 0 };
    b.parts[p.key] = { km: Math.round((cur.km + km) * 10) / 10, services: cur.services };
  }
  b.mileageKm = Math.round(((b.mileageKm ?? 0) + km) * 10) / 10;
}

/** Chilometri della sessione appena corsa (laps = giri effettivi per Sprint/gara). */
export function addSessionMileage(
  s: GameState,
  round: Round,
  kind: string,
  riderIds: string[],
  laps?: number,
) {
  const c = s.tables.circuits[round.circuitId]!;
  const n = laps ?? SESSION_KM_LAPS[kind] ?? 0;
  const km = (n * c.lengthM) / 1000;
  if (km <= 0) return;
  const split = kind === 'fp1' || kind === 'fp2' || kind === 'practice' || kind === 'warmup';
  for (const id of riderIds) {
    const own = rows(s, 'bikes').filter((b) => b.riderId === id);
    const a = own.find((b) => b.slot === 'A') ?? own[0];
    const bb = own.find((b) => b.slot === 'B');
    if (!a) continue;
    if (split && bb) {
      addKm(a, km / 2);
      addKm(bb, km / 2);
    } else addKm(a, km);
  }
}

/** Inizio weekend MotoGP: se il motore montato ha finito la sua vita regolamentare, ne entra uno nuovo. */
export function fitNewEnginesIfDue(s: GameState, round: Round) {
  const races = rows(s, 'sessionResults').filter((r) => r.seasonId === round.seasonId && r.kind === 'race');
  for (const b of rows(s, 'bikes')) {
    if (
      b.categoryId !== s.tables.seasons[round.seasonId]!.categoryId ||
      !b.riderId ||
      tierOfBike(s, b) !== 'premier'
    )
      continue;
    const done = races.filter((r) => r.rows.some((x) => x.riderId === b.riderId)).length;
    if (done % ENGINE_LIFE === 0 && (b.parts?.engine?.km ?? 0) > 0) {
      const cur = b.parts!.engine!;
      b.parts!.engine = { km: 0, services: cur.services + 1 };
    }
  }
}

/** Revisione: il pezzo torna nuovo, si paga alla voce Riparazioni. */
export function servicePart(s: GameState, ids: IdFactory, b: Bike, key: GarageKey): number {
  const cost = serviceCost(s, b, key);
  b.parts = b.parts ?? {};
  const cur = b.parts[key] ?? { km: 0, services: 0 };
  b.parts[key] = { km: 0, services: cur.services + 1 };
  if (cost > 0) {
    const trx = ids.next('trx');
    s.tables.transactions[trx] = {
      id: trx,
      teamId: b.teamId,
      day: s.meta.currentDay,
      amount: -cost,
      category: 'repairs',
      note: `Revisione ${partDef(key).name.toLowerCase()} — moto ${b.slot}`,
    };
  }
  return cost;
}

/** Squadre IA: revisionano i pezzi oltre il 90% prima del weekend, se hanno i soldi. */
export function aiMaintenance(s: GameState, ids: IdFactory, round: Round) {
  for (const b of rows(s, 'bikes')) {
    if (b.categoryId !== s.tables.seasons[round.seasonId]!.categoryId || b.teamId === s.meta.playerTeamId)
      continue;
    for (const p of GARAGE_PARTS) {
      if (!canService(s, b, p.key) || partWear(b, p.key) < 0.9) continue;
      const cost = serviceCost(s, b, p.key);
      if (cost > 0 && (!s.accounts.some((a) => a.teamId === b.teamId) || teamBalance(s, b.teamId) < cost))
        continue;
      servicePart(s, ids, b, p.key);
    }
  }
}
