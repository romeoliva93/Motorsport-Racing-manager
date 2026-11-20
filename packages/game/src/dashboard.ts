/**
 * Home (dashboard): riassunto di dati reali presi dalle viste del gioco, senza duplicarne la logica.
 * Prossimo GP con meteo previsto, piloti (valutazione, morale, classifica, ultimo risultato), stato della moto,
 * finanze del mese, attività da completare e classifica (o preparazione prima della prima gara).
 */
import { GameCalendar } from '@lean-angle/core';
import { rows, type GameState, type TeamId } from '@lean-angle/data';
import { bikeView, championship, financeView, sponsorView, weekendView } from './views.ts';
import { marketOpen } from './market.ts';
import { teamRiders } from './queries.ts';

export interface DashboardTask {
  text: string;
  section: 'market' | 'sponsors' | 'bike' | 'riders' | 'weekend';
  tone: 'warn' | 'info' | 'bad';
}

export interface DashboardView {
  nextGp: {
    number: number;
    total: number;
    circuit: string;
    country: string;
    date: string;
    inDays: number;
    laps: number;
    lengthKm: number;
    turns: number;
    track: [number, number][] | null;
    /** Previsione per la gara (ultima sessione del weekend). */
    forecast: { sky: string; airTemp: number; trackTemp: number; rainChance: number } | null;
    today: boolean;
  } | null;
  riders: {
    id: string;
    name: string;
    number: number | null;
    nationality: string;
    portrait: { key: string; pool: string };
    rating: number;
    morale: number;
    position: number | null;
    points: number;
    lastResult: { circuit: string; position: number | null; status: string } | null;
  }[];
  bike: {
    reliability: number;
    critical: { name: string; rider: string; slot: string; condition: number }[];
    inProduction: { part: string; level: number; ready: string; daysLeft: number }[];
    decisions: number;
  } | null;
  finance: { balance: number; income: number; expenses: number; net: number; sponsor: string | null } | null;
  tasks: DashboardTask[];
  standings: { position: number; name: string; color: string; points: number; mine: boolean }[] | null;
  /** Prima della prima gara: preparazione della squadra (voce, fatto?). */
  preparation: { text: string; done: boolean }[] | null;
}

export function dashboardView(s: GameState): DashboardView | null {
  const teamId = s.meta.playerTeamId as TeamId | null;
  if (!teamId) return null;
  const cal = new GameCalendar(s.meta.startYear);
  const w = weekendView(s);
  const ch = championship(s);
  const f = financeView(s);
  const b = bikeView(s);
  const sp = sponsorView(s);
  const riders = teamRiders(s, teamId).filter((r) => r.role === 'race');
  const raced = !!ch && ch.riders.some((r) => r.points > 0 || r.wins > 0);

  // Ultimo risultato in gara di ogni pilota (dal più recente).
  const races = rows(s, 'sessionResults')
    .filter((r) => r.kind === 'race')
    .sort((a, b2) => b2.day - a.day);
  const lastOf = (id: string) => {
    for (const r of races) {
      const row = r.rows.find((x) => x.riderId === id);
      if (row) {
        const round = s.tables.rounds[r.roundId as never] as { circuitId: string } | undefined;
        return {
          circuit: round ? s.tables.circuits[round.circuitId as never]!.name : '',
          position: row.status === 'finished' ? row.position : null,
          status: row.status,
        };
      }
    }
    return null;
  };

  const race = w.sessions.at(-1)?.weather;
  const tasks: DashboardTask[] = [];
  if (riders.length < 2)
    tasks.push({
      text: `Manca ${2 - riders.length === 1 ? 'un pilota' : 'due piloti'}: ingaggiali`,
      section: 'market',
      tone: 'bad',
    });
  if (sp?.windowOpen && !sp.deal)
    tasks.push({ text: 'Scegli lo sponsor della stagione', section: 'sponsors', tone: 'warn' });
  if (b?.decisions.length)
    tasks.push({
      text: `${b.decisions.length} sostituzioni importanti da approvare`,
      section: 'bike',
      tone: 'warn',
    });
  const critical = (b?.garage ?? []).flatMap((g) =>
    g.bikes.flatMap((bk) =>
      bk.groups
        .filter((x) => x.condition < 30)
        .map((x) => ({ name: x.name, rider: g.rider, slot: bk.slot, condition: x.condition })),
    ),
  );
  if (critical.length && b?.garageMode !== 'auto')
    tasks.push({ text: `${critical.length} gruppi tecnici da revisionare`, section: 'bike', tone: 'warn' });
  const soon = s.meta.currentDay + 60;
  for (const k of rows(s, 'contracts'))
    if (k.employerId === teamId && k.status === 'active' && k.kind === 'rider' && k.endDay <= soon) {
      const r = s.tables.riders[k.counterpartyId as never] as
        { firstName: string; lastName: string } | undefined;
      if (r)
        tasks.push({
          text: `Contratto di ${r.firstName} ${r.lastName} in scadenza (${cal.format(k.endDay)})`,
          section: 'riders',
          tone: 'info',
        });
    }
  if (marketOpen(s) && !raced)
    tasks.push({ text: 'Mercato piloti aperto fino al primo GP', section: 'market', tone: 'info' });
  const weakSetup = (b?.setups ?? []).filter((x) => x.dry.match < 60);
  if (weakSetup.length)
    tasks.push({
      text: `Assetto da rivedere: ${weakSetup.map((x) => x.rider.split(' ').at(-1)).join(', ')}`,
      section: 'bike',
      tone: 'info',
    });
  if (w.state === 'today')
    tasks.unshift({ text: 'Oggi si corre: vai al weekend', section: 'weekend', tone: 'warn' });

  return {
    nextGp: w.round
      ? {
          number: w.round.number,
          total: w.round.total,
          circuit: w.round.circuit,
          country: w.round.country,
          date: w.round.date,
          inDays: w.round.inDays,
          laps: w.round.laps,
          lengthKm: w.round.lengthKm,
          turns: w.round.turns,
          track: w.track,
          forecast: race
            ? { sky: race.sky, airTemp: race.airTemp, trackTemp: race.trackTemp, rainChance: race.rainChance }
            : null,
          today: w.state === 'today',
        }
      : null,
    riders: riders.map((r) => {
      const idx = ch ? ch.riders.findIndex((x) => x.riderId === r.id) : -1;
      return {
        id: r.id,
        name: r.name,
        number: r.number,
        nationality: r.nationality,
        portrait: r.portrait,
        rating: r.rating,
        morale: r.morale,
        position: raced && idx >= 0 ? idx + 1 : null,
        points: idx >= 0 ? ch!.riders[idx]!.points : 0,
        lastResult: lastOf(r.id),
      };
    }),
    bike: b
      ? {
          reliability:
            Math.round(
              (b.garage
                .flatMap((g) => g.bikes.filter((x) => x.slot === 'A').map((x) => x.reliability))
                .reduce((t, v) => t + v, 0) /
                Math.max(1, b.garage.length)) *
                10,
            ) / 10,
          critical,
          inProduction: b.parts
            .filter((p) => p.inProduction)
            .map((p) => ({
              part: p.name,
              level: p.inProduction!.level,
              ready: p.inProduction!.ready,
              daysLeft: p.inProduction!.daysLeft,
            }))
            .sort((x, y) => x.daysLeft - y.daysLeft),
          decisions: b.decisions.length,
        }
      : null,
    finance: f
      ? {
          balance: f.balance,
          income: f.monthly.sponsor,
          expenses: f.monthly.salaries + f.monthly.running + f.monthly.supply,
          net: f.monthly.net,
          sponsor: sp?.deal?.sponsorName ?? null,
        }
      : null,
    tasks,
    standings:
      raced && ch
        ? ch.riders
            .map((r, i) => ({
              position: i + 1,
              name: r.name,
              color: r.color,
              points: r.points,
              mine: r.teamId === ch.myTeamId,
            }))
            .filter((r) => r.position <= 5 || r.mine)
        : null,
    preparation: raced
      ? null
      : [
          { text: 'Due piloti titolari sotto contratto', done: riders.length >= 2 },
          { text: 'Sponsor della stagione firmato', done: !!sp?.deal },
          {
            text: 'Almeno un aggiornamento ordinato in fabbrica',
            done: (b?.parts ?? []).some((p) => p.level > 0 || p.inProduction),
          },
          {
            text: 'Assetto dei piloti per il primo GP (intesa ≥ 60%)',
            done: (b?.setups ?? []).length > 0 && weakSetup.length === 0,
          },
          {
            text: 'Manutenzione affidata o pianificata',
            done: !!b && (b.garageMode !== 'manual' || critical.length === 0),
          },
        ],
  };
}
