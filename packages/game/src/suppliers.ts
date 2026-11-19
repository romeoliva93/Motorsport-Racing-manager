/**
 * Costruttori e accordi di fornitura (stile MotoGP): ogni costruttore ha la sua squadra ufficiale e fornisce le
 * moto alle squadre clienti (satellite, indipendenti, private). La carriera parte da una squadra cliente e il
 * giocatore sceglie il costruttore: ognuno offre agevolazioni diverse, con effetti reali in gara e in bilancio.
 *
 * Le agevolazioni valgono per tutte le squadre clienti di quel costruttore (anche dell'IA); le squadre ufficiali
 * non ne hanno bisogno (moto e sviluppo sono già loro) e non pagano il canone.
 */
import type { IdFactory } from '@lean-angle/core';
import {
  rows,
  type NewsId,
  type TransactionId,
  type CategoryId,
  type CategoryTier,
  type GameState,
  type ManufacturerId,
  type Team,
  type TeamId,
} from '@lean-angle/data';

export interface SupplierPerks {
  /** Prestazione della moto (si somma al livello del costruttore, 0–1). */
  bike: number;
  reliability: number;
  /** Gestione gomme del pilota. */
  tyreCare: number;
  /** Moltiplicatori di costo e tempi di consegna degli upgrade. */
  upgradeCost: number;
  leadTime: number;
  /** Contributo una tantum alla firma (euro, solo all'inizio della carriera). */
  signingBonus: number;
}

interface Deal {
  headline: string;
  perks: Partial<SupplierPerks>;
  /** Canone annuo di fornitura in MotoGP (euro); nelle altre categorie si scala. */
  fee: number;
}

const NONE: SupplierPerks = {
  bike: 0,
  reliability: 0,
  tyreCare: 0,
  upgradeCost: 1,
  leadTime: 1,
  signingBonus: 0,
};

/** Accordi per costruttore (per nome: il mondo di partenza è fisso). */
const DEALS: Record<string, Deal> = {
  Ardena: {
    headline: 'Moto dell’anno anche ai clienti',
    perks: { bike: 0.012 },
    fee: 4_800_000,
  },
  Hoshiro: {
    headline: 'Affidabilità e pezzi in fretta',
    perks: { reliability: 0.015, leadTime: 0.7 },
    fee: 3_600_000,
  },
  Takaido: {
    headline: 'Moto facile, gomme che durano',
    perks: { tyreCare: 0.05, reliability: 0.005 },
    fee: 3_000_000,
  },
  Vohrmann: {
    headline: 'Sviluppo condiviso a prezzo di favore',
    perks: { upgradeCost: 0.75, leadTime: 0.85 },
    fee: 3_000_000,
  },
  Corvane: {
    headline: 'Contratto economico e contributo alla firma',
    perks: { bike: 0.004, signingBonus: 1_500_000 },
    fee: 1_200_000,
  },
  Lysander: {
    headline: 'Fornitura economica e robusta',
    perks: { reliability: 0.01 },
    fee: 1_000_000,
  },
  'Navarra Chassis': {
    headline: 'Telaio più efficace',
    perks: { bike: 0.006 },
    fee: 3_000_000,
  },
  'Bertoldi Telai': {
    headline: 'Telaio dolce con le gomme',
    perks: { tyreCare: 0.04 },
    fee: 2_600_000,
  },
  'Hollis Engineering': {
    headline: 'Aggiornamenti a basso costo',
    perks: { upgradeCost: 0.8 },
    fee: 1_800_000,
  },
};

/** Canone nelle altre categorie, in proporzione ai budget. */
const FEE_SCALE: Record<CategoryTier, number> = {
  premier: 1,
  intermediate: 0.25,
  lightweight: 0.12,
  rookies: 0,
};

const isCustomer = (t: Team | undefined) =>
  !!t && t.type !== 'factory' && t.type !== 'organizer' && t.type !== 'newManufacturer';

function entryOf(s: GameState, teamId: string) {
  return rows(s, 'teamEntries').find((e) => e.teamId === teamId);
}

export function dealOf(s: GameState, manufacturerId: ManufacturerId): Deal | undefined {
  const m = s.tables.manufacturers[manufacturerId];
  return m ? DEALS[m.name] : undefined;
}

/** Agevolazioni in vigore per la squadra (nessuna per le ufficiali). */
export function supplierPerks(s: GameState, teamId: string, manufacturerId?: ManufacturerId): SupplierPerks {
  const team = s.tables.teams[teamId as TeamId];
  if (!isCustomer(team)) return NONE;
  const mid = manufacturerId ?? entryOf(s, teamId)?.manufacturerId;
  const d = mid ? dealOf(s, mid) : undefined;
  return d ? { ...NONE, ...d.perks } : NONE;
}

/** Canone annuo di fornitura della squadra (0 per le ufficiali). */
export function supplyFeeYearly(s: GameState, teamId: string, manufacturerId?: ManufacturerId): number {
  const team = s.tables.teams[teamId as TeamId];
  const entry = entryOf(s, teamId);
  if (!isCustomer(team) || !entry) return 0;
  const d = dealOf(s, manufacturerId ?? entry.manufacturerId);
  const tier = s.tables.categories[entry.categoryId]!.tier;
  return d ? Math.round((d.fee * FEE_SCALE[tier]) / 10_000) * 10_000 : 0;
}

export interface SupplierOffer {
  manufacturerId: string;
  name: string;
  country: string;
  strength: number;
  headline: string;
  /** Agevolazioni in parole, con i numeri. */
  perks: string[];
  feeYearly: number;
  /** Squadra ufficiale del costruttore nella categoria. */
  factoryTeam: string | null;
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}`.replace('.', ',');

/** Offerte dei costruttori di una categoria, per una squadra cliente. */
export function supplierOffers(s: GameState, categoryId: string): SupplierOffer[] {
  const cat = s.tables.categories[categoryId as CategoryId];
  if (!cat) return [];
  const season = rows(s, 'seasons').find((x) => x.categoryId === cat.id);
  return rows(s, 'manufacturers')
    .filter((m) => m.categories.includes(cat.id))
    .map((m) => {
      const d = DEALS[m.name];
      const p = { ...NONE, ...(d?.perks ?? {}) };
      const perks: string[] = [];
      if (p.bike) perks.push(`Prestazione della moto +${pct(p.bike)}%`);
      if (p.reliability) perks.push(`Affidabilità +${pct(p.reliability)}%`);
      if (p.tyreCare) perks.push(`Gestione gomme dei piloti +${Math.round(p.tyreCare * 100)}%`);
      if (p.upgradeCost !== 1) perks.push(`Upgrade scontati del ${Math.round((1 - p.upgradeCost) * 100)}%`);
      if (p.leadTime !== 1)
        perks.push(`Consegna degli upgrade ${Math.round((1 - p.leadTime) * 100)}% più rapida`);
      if (p.signingBonus)
        perks.push(`Contributo alla firma di € ${(p.signingBonus / 1e6).toFixed(1).replace('.', ',')} mln`);
      const factory = season
        ? rows(s, 'teamEntries').find(
            (e) =>
              e.seasonId === season.id &&
              e.manufacturerId === m.id &&
              s.tables.teams[e.teamId]?.type === 'factory',
          )
        : undefined;
      return {
        manufacturerId: m.id,
        name: m.name,
        country: m.country,
        strength: m.engineeringStrength,
        headline: d?.headline ?? 'Fornitura standard',
        perks,
        feeYearly: d ? Math.round((d.fee * FEE_SCALE[cat.tier]) / 10_000) * 10_000 : 0,
        factoryTeam: factory ? s.tables.teams[factory.teamId]!.name : null,
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

/**
 * Il giocatore sceglie il costruttore che fornisce le moto (all'inizio della carriera): l'iscrizione della
 * stagione passa al nuovo costruttore, si incassa l'eventuale contributo alla firma e la notizia esce in Home.
 */
export function chooseSupplier(
  s: GameState,
  ids: IdFactory,
  teamId: TeamId,
  manufacturerId: ManufacturerId,
): void {
  const m = s.tables.manufacturers[manufacturerId];
  if (!m) return;
  for (const e of rows(s, 'teamEntries')) if (e.teamId === teamId) e.manufacturerId = manufacturerId;
  const perks = supplierPerks(s, teamId, manufacturerId);
  if (perks.signingBonus > 0) {
    const id = ids.next('trx') as TransactionId;
    s.tables.transactions[id] = {
      id,
      teamId,
      day: s.meta.currentDay,
      amount: perks.signingBonus,
      category: 'supply',
      note: `Contributo alla firma di ${m.name}`,
    };
  }
  const d = DEALS[m.name];
  const nid = ids.next('nws') as NewsId;
  s.tables.news[nid] = {
    id: nid,
    day: s.meta.currentDay,
    tag: 'squadra',
    title: `Moto ${m.name} per ${s.tables.teams[teamId]!.name}`,
    body: `Firmato l'accordo di fornitura con ${m.name}: ${d?.headline.toLowerCase() ?? 'fornitura standard'}. Canone annuo € ${(supplyFeeYearly(s, teamId) / 1e6).toFixed(2).replace('.', ',')} mln.`,
    mine: true,
  };
}
