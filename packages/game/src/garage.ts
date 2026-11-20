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
  AUTO_SERVICE_AT,
  MAJOR_PARTS,
  TECH_GROUPS,
  type TechGroup,
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
import { addNews } from './news.ts';

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

export const groupsFor = (s: GameState, b: Bike): TechGroup[] => TECH_GROUPS[tierOfBike(s, b)];

/** Componente "di fornitura" (non in un gruppo della categoria, es. motore unico Moto2): lo cura il fornitore. */
export const isSupplierPart = (s: GameState, b: Bike, key: GarageKey) =>
  !groupsFor(s, b).some((g) => g.parts.includes(key));

/**
 * Stato di un gruppo tecnico, con definizioni distinte (mostrate al giocatore):
 * - condizione   100 − usura del componente più consumato del gruppo
 * - usura        media dei componenti
 * - affidabilità probabilità relativa di arrivare in fondo senza guasti (scende solo oltre metà vita)
 * - vita residua chilometri prima che il componente più consumato arrivi a fine vita
 */
export function groupStatus(b: Bike, g: TechGroup) {
  const wears = g.parts.map((k) => partWear(b, k));
  const rel = g.parts.reduce((t, k) => t * partReliability(partWear(b, k)), 1);
  const left = Math.min(...g.parts.map((k) => partDef(k).life * GARAGE_WEEKEND_KM - (b.parts?.[k]?.km ?? 0)));
  return {
    condition: Math.max(0, Math.round(100 - Math.max(...wears) * 100)),
    wear: Math.round((wears.reduce((t, w) => t + w, 0) / wears.length) * 100),
    reliability: Math.round(rel * 1000) / 10,
    lifeLeftKm: Math.round(left),
    lifeLeftWeekends: Math.round((left / GARAGE_WEEKEND_KM) * 10) / 10,
  };
}

/** Sostituzioni importanti in attesa del sì del manager (telaio, forcellone oltre l'80%). */
export function pendingDecisions(s: GameState, teamId: string) {
  return rows(s, 'bikes')
    .filter((b) => b.teamId === teamId && b.riderId)
    .flatMap((b) =>
      MAJOR_PARTS.filter((k) => !isSupplierPart(s, b, k) && partWear(b, k) >= 0.8).map((k) => ({
        bikeId: b.id,
        riderId: b.riderId!,
        slot: b.slot,
        part: k,
        name: partDef(k).name,
        wear: Math.round(partWear(b, k) * 100),
        cost: serviceCost(s, b, k),
      })),
    );
}

export function serviceCost(s: GameState, b: Bike, key: GarageKey): number {
  if (isSupplierPart(s, b, key)) return 0;
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

/**
 * Capotecnico della squadra del giocatore (manutenzione delegata, attiva salvo scelta diversa): prima del weekend
 * revisiona i componenti ordinari oltre il 70% e quelli di fornitura; telaio e forcellone restano una decisione del
 * manager. Lascia una notizia con il riepilogo.
 */
export function crewChiefMaintenance(s: GameState, ids: IdFactory, round: Round) {
  const teamId = s.meta.playerTeamId;
  if (!teamId) return;
  const mode = garageModeOf(s, teamId);
  const cat = s.tables.seasons[round.seasonId]!.categoryId;
  if (mode !== 'auto') {
    if (mode === 'assisted') assistedWarnings(s, ids, teamId, cat);
    return;
  }
  let n = 0,
    spent = 0,
    skipped = 0;
  for (const b of rows(s, 'bikes')) {
    if (b.teamId !== teamId || b.categoryId !== cat || !b.riderId) continue;
    for (const p of GARAGE_PARTS) {
      if (!canService(s, b, p.key) || MAJOR_PARTS.includes(p.key) || partWear(b, p.key) < AUTO_SERVICE_AT)
        continue;
      const cost = serviceCost(s, b, p.key);
      if (cost > 0 && teamBalance(s, teamId) < cost) {
        skipped++;
        continue;
      }
      spent += servicePart(s, ids, b, p.key);
      n++;
    }
  }
  const major = pendingDecisions(s, teamId);
  if (n === 0 && skipped === 0 && major.length === 0) return;
  const money = (v: number) => `€ ${Math.round(v).toLocaleString('it-IT')}`;
  addNews(s, ids, {
    day: s.meta.currentDay,
    tag: 'squadra',
    mine: true,
    title: n ? `Capotecnico: ${n} revisioni prima del weekend` : 'Capotecnico: serve una tua decisione',
    body:
      (n ? `Revisionati ${n} componenti ordinari consumati oltre il 70% (spesa ${money(spent)}). ` : '') +
      (skipped ? `${skipped} revisioni rimandate: non ci sono abbastanza soldi in cassa. ` : '') +
      (major.length
        ? `Da decidere nel garage: ${major.map((m) => `${m.name.toLowerCase()} moto ${m.slot} (${m.wear}%)`).join(', ')}.`
        : ''),
  });
}

export const garageModeOf = (s: GameState, teamId: string) => s.garageMode?.[teamId] ?? 'auto';

/**
 * Manutenzione assistita: il capotecnico non interviene ma avvisa, gruppo per gruppo, quando un gruppo tecnico
 * scende sotto il 30% di condizione ("revisione consigliata prima del prossimo Gran Premio").
 */
function assistedWarnings(s: GameState, ids: IdFactory, teamId: string, categoryId: string) {
  const lines: string[] = [];
  for (const b of rows(s, 'bikes')) {
    if (b.teamId !== teamId || b.categoryId !== categoryId || !b.riderId) continue;
    const r = s.tables.riders[b.riderId];
    for (const g of groupsFor(s, b)) {
      const st = groupStatus(b, g);
      if (st.condition < 30)
        lines.push(`${g.name} (moto ${b.slot} di ${r ? r.lastName : ''}: condizione ${st.condition}%)`);
    }
  }
  if (!lines.length) return;
  addNews(s, ids, {
    day: s.meta.currentDay,
    tag: 'squadra',
    mine: true,
    title: 'Capotecnico: revisioni consigliate',
    body: `Usura elevata: ${lines.join('; ')}. Consigliata una revisione prima del prossimo Gran Premio (Moto e upgrade → Componenti).`,
  });
}

/** Ricambi: un gruppo completo nuovo in magazzino costa il 120% della revisione del gruppo. */
export function spareCost(s: GameState, teamId: string, groupKey: string): number | null {
  const b = rows(s, 'bikes').find((x) => x.teamId === teamId && x.riderId);
  const g = b && groupsFor(s, b).find((x) => x.key === groupKey);
  if (!b || !g) return null;
  const cost = g.parts.filter((k) => canService(s, b, k)).reduce((t, k) => t + serviceCost(s, b, k), 0);
  return Math.round((cost * 1.2) / 1000) * 1000;
}
export const sparesOf = (s: GameState, teamId: string, groupKey: string) =>
  s.spares?.[teamId]?.[groupKey] ?? 0;

export function buySpare(s: GameState, ids: IdFactory, teamId: string, groupKey: string): number {
  const cost = spareCost(s, teamId, groupKey)!;
  s.spares = s.spares ?? {};
  s.spares[teamId] = { ...(s.spares[teamId] ?? {}), [groupKey]: sparesOf(s, teamId, groupKey) + 1 };
  if (cost > 0) {
    const trx = ids.next('trx');
    s.tables.transactions[trx] = {
      id: trx,
      teamId: teamId as Bike['teamId'],
      day: s.meta.currentDay,
      amount: -cost,
      category: 'repairs',
      note: `Ricambio: gruppo ${groupKey}`,
    };
  }
  return cost;
}

/** Sostituzione con un ricambio dal magazzino: i componenti del gruppo tornano nuovi, senza altre spese. */
export function replaceGroup(s: GameState, b: Bike, groupKey: string) {
  const g = groupsFor(s, b).find((x) => x.key === groupKey)!;
  b.parts = b.parts ?? {};
  for (const k of g.parts) {
    if (!canService(s, b, k)) continue;
    const cur = b.parts[k] ?? { km: 0, services: 0 };
    b.parts[k] = { km: 0, services: cur.services + 1 };
  }
  s.spares![b.teamId]![groupKey] = sparesOf(s, b.teamId, groupKey) - 1;
}

/** Upgrade consegnato dalla fabbrica: i componenti nuovi montati partono da zero chilometri. */
export function fitNewParts(s: GameState, teamId: string, upgrade: string, riderId?: string) {
  for (const b of rows(s, 'bikes')) {
    if (b.teamId !== teamId || (riderId && b.riderId !== riderId)) continue;
    for (const p of GARAGE_PARTS) {
      if (p.upgrade !== upgrade || !b.parts?.[p.key]) continue;
      b.parts[p.key] = { km: 0, services: b.parts[p.key]!.services };
    }
  }
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
