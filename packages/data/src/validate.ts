/**
 * Validatore dello stato di gioco: integrità referenziale e regole del mondo
 * (REGULATIONS.md §6, ROADMAP M1.3/M1.4). Restituisce tutti i problemi trovati, non si ferma al primo.
 */
import { GameCalendar } from '@lean-angle/core';
import type { GameState } from './schema/state.ts';
import type { Regulation } from './schema/world.ts';
import { rows } from './tables.ts';

export interface ValidationIssue {
  code: string;
  message: string;
  ref?: string;
}

export function validateGameState(state: GameState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const t = state.tables;
  const add = (code: string, message: string, ref?: string) =>
    issues.push(ref ? { code, message, ref } : { code, message });
  const exists = (table: keyof GameState['tables'], id: string | null | undefined) =>
    id !== null && id !== undefined && (t[table] as Record<string, unknown>)[id] !== undefined;
  const cal = new GameCalendar(state.meta.startYear);
  const isInt = (x: number) => Number.isSafeInteger(x);

  // --- Regolamenti -----------------------------------------------------------
  for (const r of rows(state, 'regulations')) {
    if (!exists('categories', r.categoryId)) add('ref.regulation.category', 'Categoria inesistente', r.id);
    if (r.bikesPerRider !== 1 && r.bikesPerRider !== 2)
      add('reg.bikesPerRider', 'bikesPerRider deve essere 1 o 2', r.id);
    if (r.flagToFlag && r.bikesPerRider !== 2)
      add('reg.flagToFlag', 'flag-to-flag richiede 2 moto per pilota', r.id);
    if (r.points.some((p, i) => !isInt(p) || p < 0 || (i > 0 && p > (r.points[i - 1] as number)))) {
      add('reg.points', 'Punteggi non validi (interi ≥ 0, non crescenti)', r.id);
    }
  }
  const regulationFor = (categoryId: string, year: number): Regulation | undefined =>
    rows(state, 'regulations').find((r) => r.categoryId === categoryId && r.season === year);

  // --- Stagioni, round, circuiti ---------------------------------------------
  for (const s of rows(state, 'seasons')) {
    if (!exists('categories', s.categoryId)) add('ref.season.category', 'Categoria inesistente', s.id);
    if (!exists('regulations', s.regulationId)) add('ref.season.regulation', 'Regolamento inesistente', s.id);
    for (const rid of s.roundIds)
      if (!exists('rounds', rid)) add('ref.season.round', `Round ${rid} inesistente`, s.id);
  }
  for (const r of rows(state, 'rounds')) {
    if (!exists('seasons', r.seasonId)) add('ref.round.season', 'Stagione inesistente', r.id);
    if (!exists('circuits', r.circuitId)) add('ref.round.circuit', 'Circuito inesistente', r.id);
  }

  // --- Squadre e iscrizioni --------------------------------------------------
  for (const team of rows(state, 'teams')) {
    if (team.owner.kind === 'manufacturer' && !exists('manufacturers', team.owner.manufacturerId)) {
      add('ref.team.owner', 'Costruttore proprietario inesistente', team.id);
    }
    if (team.type === 'factory' && team.owner.kind !== 'manufacturer') {
      add('team.factoryOwner', 'Una squadra ufficiale deve appartenere a un costruttore', team.id);
    }
  }

  const activeContracts = rows(state, 'contracts').filter((c) => c.status === 'active');
  const seatedBySeason = new Map<string, Set<string>>();
  const numbersBySeason = new Map<string, Set<number>>();

  for (const e of rows(state, 'teamEntries')) {
    if (!exists('teams', e.teamId)) add('ref.entry.team', 'Squadra inesistente', e.id);
    if (!exists('categories', e.categoryId)) add('ref.entry.category', 'Categoria inesistente', e.id);
    if (!exists('manufacturers', e.manufacturerId))
      add('ref.entry.manufacturer', 'Costruttore inesistente', e.id);
    const season = t.seasons[e.seasonId];
    if (!season) {
      add('ref.entry.season', 'Stagione inesistente', e.id);
      continue;
    }
    const mfr = t.manufacturers[e.manufacturerId];
    if (mfr && !mfr.categories.includes(e.categoryId)) {
      add('entry.manufacturerCategory', `${mfr.name} non fornisce moto per questa categoria`, e.id);
    }
    const team = t.teams[e.teamId];
    if (
      team?.type === 'factory' &&
      team.owner.kind === 'manufacturer' &&
      team.owner.manufacturerId !== e.manufacturerId
    ) {
      add(
        'entry.factoryManufacturer',
        'La squadra ufficiale deve usare le moto del proprio costruttore',
        e.id,
      );
    }
    const reg = t.regulations[season.regulationId];
    const seated = seatedBySeason.get(e.seasonId) ?? new Set<string>();
    seatedBySeason.set(e.seasonId, seated);
    const numbers = numbersBySeason.get(e.seasonId) ?? new Set<number>();
    numbersBySeason.set(e.seasonId, numbers);
    for (const seat of e.seats) {
      if (numbers.has(seat.number))
        add('entry.duplicateNumber', `Numero ${seat.number} già usato nella categoria`, e.id);
      numbers.add(seat.number);
      if (seat.riderId === null) {
        if (reg && !reg.substitution.vacancyAllowed)
          add('entry.vacancyNotAllowed', 'Posto vacante non ammesso dal regolamento', e.id);
        continue;
      }
      const rider = t.riders[seat.riderId];
      if (!rider) {
        add('ref.seat.rider', `Pilota ${seat.riderId} inesistente`, e.id);
        continue;
      }
      if (seated.has(rider.id))
        add('entry.riderTwice', `${rider.lastName} iscritto due volte nella stessa stagione`, rider.id);
      seated.add(rider.id);
      const hasContract = activeContracts.some(
        (c) =>
          c.counterpartyId === rider.id &&
          c.employerId === e.teamId &&
          (c.kind === 'rider' || c.kind === 'substitute'),
      );
      if (!hasContract)
        add('seat.noContract', `${rider.lastName} non ha un contratto attivo con la squadra`, rider.id);
      if (reg) {
        const age = cal.ageOn(rider.birthDay, cal.fromDate({ year: season.year, month: 1, day: 1 }));
        if (age < reg.riderAge.min || (reg.riderAge.max !== null && age > reg.riderAge.max)) {
          add('seat.age', `${rider.lastName}: età ${age} fuori dai limiti della categoria`, rider.id);
        }
      }
      const cat = t.categories[e.categoryId];
      if (cat?.teamsManaged) {
        const a = state.staffAssignments.find((x) => x.riderId === rider.id && x.teamId === e.teamId);
        const cc = a && t.staff[a.crewChiefId];
        const te = a && t.staff[a.trackEngineerId];
        if (!cc || cc.role !== 'crewChief')
          add('seat.noCrewChief', `${rider.lastName} non ha un capotecnico assegnato`, rider.id);
        if (!te || te.role !== 'trackEngineer')
          add('seat.noTrackEngineer', `${rider.lastName} non ha un ingegnere di pista assegnato`, rider.id);
      }
    }
  }

  // --- Contratti -------------------------------------------------------------
  const exclusive = new Map<string, string>();
  for (const c of rows(state, 'contracts')) {
    if (!exists('teams', c.employerId)) add('ref.contract.employer', 'Squadra inesistente', c.id);
    const cp = c.counterpartyId as string;
    if (!exists('riders', cp) && !exists('staff', cp) && !exists('sponsors', cp))
      add('ref.contract.counterparty', 'Controparte inesistente', c.id);
    if (c.endDay < c.startDay) add('contract.dates', 'La fine precede l’inizio', c.id);
    if (!isInt(c.salary) || c.bonuses.some((b) => !isInt(b.amount)))
      add('money.notInteger', 'Importi non interi', c.id);
    if (c.status === 'active' && (c.kind === 'rider' || c.kind === 'staff')) {
      const prev = exclusive.get(cp);
      if (prev)
        add('contract.duplicate', `Due contratti attivi per la stessa persona (${prev}, ${c.id})`, cp);
      else exclusive.set(cp, c.id);
    }
  }

  // --- Staff, rapporti -------------------------------------------------------
  for (const a of state.staffAssignments) {
    if (!exists('teams', a.teamId)) add('ref.assignment.team', 'Squadra inesistente', a.riderId);
    if (!exists('riders', a.riderId)) add('ref.assignment.rider', 'Pilota inesistente', a.riderId);
    for (const sid of [a.crewChiefId, a.trackEngineerId]) {
      if (!exists('staff', sid))
        add('ref.assignment.staff', `Membro dello staff ${sid} inesistente`, a.riderId);
      else if (!activeContracts.some((c) => c.counterpartyId === sid && c.employerId === a.teamId)) {
        add('assignment.staffNotEmployed', `${sid} non è sotto contratto con la squadra`, a.riderId);
      }
    }
  }
  for (const b of state.bonds) {
    if (!exists('riders', b.riderId) || !exists('staff', b.staffId))
      add('ref.bond', 'Rapporto con persona inesistente', `${b.riderId}/${b.staffId}`);
  }

  // --- Moto ------------------------------------------------------------------
  const year = cal.toDate(state.meta.currentDay).year;
  const raceBikesPerRider = new Map<string, number>();
  for (const bike of rows(state, 'bikes')) {
    if (!exists('teams', bike.teamId)) add('ref.bike.team', 'Squadra inesistente', bike.id);
    if (!exists('categories', bike.categoryId)) add('ref.bike.category', 'Categoria inesistente', bike.id);
    if (bike.riderId !== null && !exists('riders', bike.riderId))
      add('ref.bike.rider', 'Pilota inesistente', bike.id);
    for (const cid of Object.values(bike.components))
      if (!exists('components', cid)) add('ref.bike.component', `Componente ${cid} inesistente`, bike.id);
    const reg = regulationFor(bike.categoryId, year);
    if (bike.slot === 'B' && reg && reg.bikesPerRider < 2) {
      add('bike.secondBikeNotAllowed', 'Moto B non prevista dal regolamento della categoria', bike.id);
    }
    if (bike.riderId && bike.label !== 'test') {
      const n = (raceBikesPerRider.get(bike.riderId) ?? 0) + 1;
      raceBikesPerRider.set(bike.riderId, n);
      if (reg && n > reg.bikesPerRider)
        add('bike.tooMany', `Più moto di quelle consentite (${reg.bikesPerRider})`, bike.riderId);
    }
  }
  for (const c of rows(state, 'components')) {
    if (!exists('manufacturers', c.manufacturerId))
      add('ref.component.manufacturer', 'Costruttore inesistente', c.id);
  }

  // --- Altro -----------------------------------------------------------------
  for (const f of rows(state, 'facilities'))
    if (!exists('teams', f.teamId)) add('ref.facility.team', 'Squadra inesistente', f.id);
  for (const i of rows(state, 'injuries'))
    if (!exists('riders', i.riderId)) add('ref.injury.rider', 'Pilota inesistente', i.id);
  for (const tx of rows(state, 'transactions')) {
    if (!exists('teams', tx.teamId)) add('ref.transaction.team', 'Squadra inesistente', tx.id);
    if (!isInt(tx.amount)) add('money.notInteger', 'Importo non intero', tx.id);
  }
  for (const acc of state.accounts) {
    if (!exists('teams', acc.teamId)) add('ref.account.team', 'Squadra inesistente', acc.teamId);
    if (!isInt(acc.openingBalance) || !isInt(acc.creditLimit))
      add('money.notInteger', 'Importo non intero', acc.teamId);
  }

  return issues;
}

/** Saldo corrente di una squadra: apertura + somma delle transazioni (mai salvato a parte). */
export function teamBalance(state: GameState, teamId: string): number {
  const acc = state.accounts.find((a) => a.teamId === teamId);
  if (!acc) throw new Error(`Conto della squadra ${teamId} inesistente`);
  return rows(state, 'transactions')
    .filter((tx) => tx.teamId === teamId)
    .reduce((s, tx) => s + tx.amount, acc.openingBalance);
}
