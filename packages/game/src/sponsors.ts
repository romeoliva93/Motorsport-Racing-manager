/**
 * Sponsor con obiettivo stagionale.
 *
 * Prima del primo Gran Premio il giocatore sceglie una fra tre offerte. L'obiettivo è la posizione nella
 * classifica squadre a fine stagione, calcolata dalla posizione attesa (classifica per reputazione nella
 * categoria):
 *   Prudente     obiettivo = attesa + 2   rata = 15% della rata sponsor base   premio = 1,0 × rata base
 *   Equilibrata  obiettivo = attesa       rata = 30%                            premio = 2,5 ×
 *   Ambiziosa    obiettivo = attesa − 2   rata = 55%                            premio = 5,0 ×
 * La rata si incassa ogni mese per tutta la stagione; il premio solo se l'obiettivo è raggiunto.
 */
import { cyrb128, type IdFactory } from '@lean-angle/core';
import {
  SPONSORS,
  SPONSOR_DEAL_RISK,
  rows,
  type GameState,
  type SeasonId,
  type SponsorDealId,
  type SponsorRisk,
  type TeamId,
} from '@lean-angle/data';
import { sponsorMonthly } from './economy.ts';
import { addNews } from './news.ts';

export interface SponsorOffer {
  risk: SponsorRisk;
  label: string;
  sponsorName: string;
  industry: string;
  targetPosition: number;
  monthly: number;
  bonus: number;
}

const round10k = (x: number) => Math.round(x / 10_000) * 10_000;

function playerEntry(s: GameState) {
  const t = s.meta.playerTeamId;
  return t ? rows(s, 'teamEntries').find((e) => e.teamId === t) : undefined;
}

export function currentDeal(s: GameState) {
  const e = playerEntry(s);
  return e
    ? rows(s, 'sponsorDeals').find((d) => d.teamId === e.teamId && d.seasonId === e.seasonId)
    : undefined;
}

/** Si firma prima del primo GP della stagione, una sola volta. */
export function dealWindowOpen(s: GameState): boolean {
  const e = playerEntry(s);
  if (!e || currentDeal(s)) return false;
  const season = s.tables.seasons[e.seasonId]!;
  const first = Math.min(...season.roundIds.map((id) => s.tables.rounds[id]!.startDay));
  return s.meta.currentDay < first;
}

export function expectedPosition(s: GameState, teamId: string): { position: number; of: number } {
  const e = rows(s, 'teamEntries').find((x) => x.teamId === teamId)!;
  const rivals = rows(s, 'teamEntries')
    .filter((x) => x.seasonId === e.seasonId)
    .map((x) => s.tables.teams[x.teamId]!)
    .sort((a, b) => b.reputation - a.reputation);
  return { position: rivals.findIndex((t) => t.id === teamId) + 1, of: rivals.length };
}

export function sponsorOffers(s: GameState): SponsorOffer[] {
  const e = playerEntry(s);
  if (!e) return [];
  const base = sponsorMonthly(s, e.teamId);
  const { position, of } = expectedPosition(s, e.teamId);
  const h = cyrb128(`${s.meta.seed}::sponsor::${e.seasonId}`)[0]! >>> 0;
  const risks: SponsorRisk[] = ['safe', 'balanced', 'ambitious'];
  return risks.map((risk, i) => {
    const r = SPONSOR_DEAL_RISK[risk];
    const sp = SPONSORS[(h + i * 7) % SPONSORS.length]!;
    return {
      risk,
      label: r.label,
      sponsorName: sp.name,
      industry: sp.industry,
      targetPosition: Math.max(1, Math.min(of, position + r.slack)),
      monthly: round10k(base * r.monthly),
      bonus: round10k(base * r.bonus),
    };
  });
}

export function signDeal(s: GameState, ids: IdFactory, risk: SponsorRisk): void {
  const e = playerEntry(s)!;
  const o = sponsorOffers(s).find((x) => x.risk === risk)!;
  const id = ids.next('spd') as SponsorDealId;
  s.tables.sponsorDeals[id] = {
    id,
    teamId: e.teamId,
    seasonId: e.seasonId as SeasonId,
    sponsorName: o.sponsorName,
    risk,
    targetPosition: o.targetPosition,
    monthly: o.monthly,
    bonus: o.bonus,
    signedDay: s.meta.currentDay,
    status: 'active',
  };
  addNews(s, ids, {
    day: s.meta.currentDay,
    tag: 'finanze',
    mine: true,
    title: `${o.sponsorName} è il nuovo sponsor della squadra`,
    body: `Obiettivo: chiudere almeno ${o.targetPosition}ª nella classifica squadre. Premio in caso di successo.`,
  });
}

/** Rate mensili degli sponsor con obiettivo (chiamata il 1° del mese). */
export function dealMonthly(s: GameState, teamId: TeamId): number {
  return rows(s, 'sponsorDeals')
    .filter((d) => d.teamId === teamId && d.status === 'active')
    .reduce((t, d) => t + d.monthly, 0);
}

/** A fine stagione: obiettivo raggiunto o mancato, premio pagato. */
export function settleDeals(s: GameState, ids: IdFactory, seasonId: string, teamOrder: string[]): void {
  for (const d of rows(s, 'sponsorDeals').filter((x) => x.seasonId === seasonId && x.status === 'active')) {
    const pos = teamOrder.indexOf(d.teamId) + 1;
    const met = pos > 0 && pos <= d.targetPosition;
    d.status = met ? 'met' : 'missed';
    if (met) {
      const id = ids.next('trx');
      s.tables.transactions[id] = {
        id,
        teamId: d.teamId,
        day: s.meta.currentDay,
        amount: d.bonus,
        category: 'sponsor',
        note: `Premio obiettivo ${d.sponsorName}`,
      };
    }
    addNews(s, ids, {
      day: s.meta.currentDay,
      tag: 'finanze',
      mine: d.teamId === s.meta.playerTeamId,
      title: met ? `Obiettivo raggiunto: ${d.sponsorName} paga il premio` : `Obiettivo sponsor mancato`,
      body: met
        ? `La squadra ha chiuso ${pos}ª (obiettivo: ${d.targetPosition}ª).`
        : `La squadra ha chiuso ${pos}ª, l'obiettivo era la ${d.targetPosition}ª posizione: niente premio.`,
    });
  }
}
