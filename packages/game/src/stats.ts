/**
 * Statistiche e storico dei piloti, ricavati sempre dai risultati delle sessioni salvati (`sessionResults`):
 * nessun contatore separato da tenere allineato, quindi niente duplicazioni e valori identici dopo il
 * caricamento di un salvataggio.
 *
 *   pole        = 1° nella griglia ufficiale (kind 'qualifying')
 *   giro veloce = miglior giro della gara della domenica (statistica, non dà punti come da regolamento)
 *   vittorie e podi = solo gara della domenica; i punti comprendono la Sprint
 */
import { GameCalendar } from '@lean-angle/core';
import { rows, type GameState, type Rider, type SessionResult } from '@lean-angle/data';
import { standings } from './weekend.ts';

export interface RoundResult {
  roundNumber: number;
  circuit: string;
  country: string;
  date: string;
  category: string;
  team: string;
  grid: number | null;
  pole: boolean;
  sprint: { position: number | null; points: number; status: 'finished' | 'dnf' } | null;
  race: { position: number | null; points: number; status: 'finished' | 'dnf'; reason?: string } | null;
  fastestLap: boolean;
  points: number;
}

export interface SeasonStats {
  seasonId: string;
  year: number;
  category: string;
  team: string;
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  dnf: number;
  bestFinish: number | null;
  /** Posizione nella classifica piloti della stagione. */
  position: number | null;
  /** Stagione conclusa (la posizione è definitiva). */
  finished: boolean;
  results: RoundResult[];
}

/** Risultati di un pilota, raggruppati per stagione (dalla più recente). */
export function riderHistory(s: GameState, riderId: string): SeasonStats[] {
  const c = new GameCalendar(s.meta.startYear);
  const mine = rows(s, 'sessionResults').filter((r) => r.rows.some((x) => x.riderId === riderId));
  const bySeason = new Map<string, SessionResult[]>();
  for (const r of mine) bySeason.set(r.seasonId, [...(bySeason.get(r.seasonId) ?? []), r]);
  const out: SeasonStats[] = [];
  for (const [seasonId, list] of bySeason) {
    const season = s.tables.seasons[seasonId as never]!;
    const cat = s.tables.categories[season.categoryId]!;
    const roundIds = [...new Set(list.map((r) => r.roundId))]
      .map((id) => s.tables.rounds[id as never]!)
      .sort((a, b) => a.startDay - b.startDay);
    const results: RoundResult[] = [];
    for (const round of roundIds) {
      const of = (kind: SessionResult['kind']) => list.find((r) => r.roundId === round.id && r.kind === kind);
      const row = (res: SessionResult | undefined) => res?.rows.find((x) => x.riderId === riderId);
      const q = row(of('qualifying'));
      const sp = row(of('sprint'));
      const raceRes = of('race');
      const ra = row(raceRes);
      if (!q && !ra && !sp) continue; // solo prove libere (es. weekend in corso)
      const circuit = s.tables.circuits[round.circuitId]!;
      const teamId = (ra ?? sp ?? q)!.teamId;
      results.push({
        roundNumber: round.number,
        circuit: circuit.name,
        country: circuit.country,
        date: c.format(round.startDay),
        category: cat.name,
        team: s.tables.teams[teamId]?.name ?? '—',
        grid: q?.position ?? null,
        pole: q?.position === 1,
        sprint: sp ? { position: sp.position, points: sp.points, status: sp.status } : null,
        race: ra
          ? {
              position: ra.position,
              points: ra.points,
              status: ra.status,
              ...(ra.reason ? { reason: ra.reason } : {}),
            }
          : null,
        fastestLap: raceRes?.fastestLap?.riderId === riderId,
        points: (sp?.points ?? 0) + (ra?.points ?? 0),
      });
    }
    const st = standings(s, seasonId);
    const pos = st.riders.findIndex((x) => x.riderId === riderId);
    const finishes = results
      .map((r) => r.race?.position)
      .filter((p): p is number => p !== null && p !== undefined);
    const lastTeam = results.at(-1)?.team ?? '—';
    out.push({
      seasonId,
      year: season.year,
      category: cat.name,
      team: lastTeam,
      starts: results.filter((r) => r.race).length,
      wins: results.filter((r) => r.race?.position === 1).length,
      podiums: results.filter((r) => r.race?.position !== null && (r.race?.position ?? 99) <= 3).length,
      poles: results.filter((r) => r.pole).length,
      fastestLaps: results.filter((r) => r.fastestLap).length,
      points: results.reduce((t, r) => t + r.points, 0),
      dnf: results.filter((r) => r.race?.status === 'dnf').length,
      bestFinish: finishes.length ? Math.min(...finishes) : null,
      position: pos >= 0 ? pos + 1 : null,
      finished: season.status === 'finished',
      results,
    });
  }
  return out.sort((a, b) => b.year - a.year);
}

/** Totali di carriera (solo stagioni giocate nella partita). */
export function careerTotals(history: SeasonStats[]) {
  const sum = (k: 'starts' | 'wins' | 'podiums' | 'poles' | 'fastestLaps' | 'points' | 'dnf') =>
    history.reduce((t, h) => t + h[k], 0);
  return {
    seasons: history.length,
    starts: sum('starts'),
    wins: sum('wins'),
    podiums: sum('podiums'),
    poles: sum('poles'),
    fastestLaps: sum('fastestLaps'),
    points: sum('points'),
    titles: history.filter((h) => h.position === 1 && h.finished).length,
  };
}

/**
 * Preferenze tecniche ricavate dagli attributi di guida (non sono dati inventati: cambiano se cambiano gli
 * attributi). Servono all'ingegnere per impostare moto e strategia.
 */
export function technicalPreferences(r: Rider): { label: string; value: string; why: string }[] {
  const a = r.attributes;
  const style =
    a.cornerEntry >= a.acceleration + 5
      ? ['Velocità in curva', 'porta molta velocità in percorrenza, ama una moto agile']
      : a.acceleration >= a.cornerEntry + 5
        ? ['Stop and go', 'frena tardi, chiude la curva e riparte forte: vuole trazione in uscita']
        : ['Equilibrato', 'nessuna preferenza netta fra ingresso e uscita di curva'];
  return [
    { label: 'Stile di guida', value: style[0]!, why: style[1]! },
    {
      label: 'Avantreno',
      value: a.braking >= 78 ? 'Rigido' : a.braking <= 60 ? 'Morbido' : 'Intermedio',
      why: `frenata ${a.braking}/99: ${a.braking >= 78 ? 'stacca fortissimo, vuole sostegno davanti' : a.braking <= 60 ? 'cerca feeling e progressività' : 'regolazione standard'}`,
    },
    {
      label: 'Gomma preferita',
      value: a.tyreManagement >= 70 ? 'Morbida' : a.tyreManagement <= 45 ? 'Dura' : 'Media',
      why: `gestione gomme ${a.tyreManagement}/99`,
    },
    {
      label: 'Controllo di trazione',
      value: a.aggression >= 80 ? 'Basso' : a.aggression <= 55 ? 'Alto' : 'Medio',
      why: `aggressività ${a.aggression}/99: ${a.aggression >= 80 ? 'vuole sentire la moto scivolare' : 'preferisce un aiuto elettronico'}`,
    },
    {
      label: 'Sul bagnato',
      value: a.wet >= 78 ? 'Specialista' : a.wet <= 55 ? 'In difficoltà' : 'Nella media',
      why: `bagnato ${a.wet}/99`,
    },
    {
      label: 'Feedback ai tecnici',
      value: a.technicalFeedback >= 78 ? 'Preciso' : a.technicalFeedback <= 55 ? 'Vago' : 'Buono',
      why: `feedback tecnico ${a.technicalFeedback}/99: ${a.technicalFeedback >= 78 ? 'i tecnici trovano presto l’assetto' : 'serve più tempo per capire i problemi'}`,
    },
  ];
}
