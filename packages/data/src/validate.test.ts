import { describe, expect, it } from 'vitest';
import { buildMiniWorld } from './testing/fixtures.ts';
import { validateGameState, teamBalance } from './validate.ts';
import { insert, rows, update } from './tables.ts';
import type { GameState } from './schema/state.ts';

const codes = (s: GameState) => validateGameState(s).map((i) => i.code);
const premierTeam = (s: GameState) => rows(s, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!;
const lightCategory = (s: GameState) => rows(s, 'categories').find((c) => c.tier === 'lightweight')!;
const riderNamed = (s: GameState, last: string) => rows(s, 'riders').find((r) => r.lastName === last)!;

describe('validateGameState', () => {
  it('il mini-mondo di prova è valido', () => {
    expect(validateGameState(buildMiniWorld())).toEqual([]);
  });

  it('Premier ha Moto A e B per pilota, Lightweight una sola moto', () => {
    const s = buildMiniWorld();
    const bikesOf = (last: string) =>
      rows(s, 'bikes')
        .filter((b) => b.riderId === riderNamed(s, last).id)
        .map((b) => b.slot);
    expect(bikesOf('Varriale')).toEqual(['A', 'B']);
    expect(bikesOf('Vitellino')).toEqual(['A']);
  });

  it('rifiuta una Moto B in una categoria con una moto per pilota', () => {
    const s = buildMiniWorld();
    const v = riderNamed(s, 'Vitellino');
    const a = rows(s, 'bikes').find((b) => b.riderId === v.id)!;
    insert(s, 'bikes', { ...a, id: 'bik_000999', slot: 'B' });
    expect(codes(s)).toEqual(expect.arrayContaining(['bike.secondBikeNotAllowed', 'bike.tooMany']));
  });

  it('rifiuta il flag-to-flag senza seconda moto', () => {
    const s = buildMiniWorld();
    const reg = rows(s, 'regulations').find((r) => r.categoryId === lightCategory(s).id)!;
    update(s, 'regulations', reg.id, { flagToFlag: true });
    expect(codes(s)).toContain('reg.flagToFlag');
  });

  it('ogni pilota deve avere capotecnico e ingegnere di pista', () => {
    const s = buildMiniWorld();
    const v = riderNamed(s, 'Varriale');
    s.staffAssignments = s.staffAssignments.filter((a) => a.riderId !== v.id);
    expect(codes(s)).toEqual(expect.arrayContaining(['seat.noCrewChief', 'seat.noTrackEngineer']));
  });

  it('segnala contratti duplicati per la stessa persona', () => {
    const s = buildMiniWorld();
    const v = riderNamed(s, 'Varriale');
    const c = rows(s, 'contracts').find((x) => x.counterpartyId === v.id)!;
    insert(s, 'contracts', { ...c, id: 'ctr_000999' });
    expect(codes(s)).toContain('contract.duplicate');
  });

  it('segnala riferimenti a entità inesistenti', () => {
    const s = buildMiniWorld();
    const entry = rows(s, 'teamEntries')[0]!;
    entry.seats[0]!.riderId = 'rdr_999999';
    expect(codes(s)).toContain('ref.seat.rider');
  });

  it('un posto vacante è ammesso solo se il regolamento lo consente', () => {
    const s = buildMiniWorld();
    const entry = rows(s, 'teamEntries').find((e) => e.teamId === premierTeam(s).id)!;
    entry.seats[0]!.riderId = null;
    expect(validateGameState(s)).toEqual([]);
    const reg = rows(s, 'regulations').find((r) => r.categoryId === entry.categoryId)!;
    update(s, 'regulations', reg.id, { substitution: { ...reg.substitution, vacancyAllowed: false } });
    expect(codes(s)).toContain('entry.vacancyNotAllowed');
  });

  it('controlla l’età rispetto ai limiti della categoria', () => {
    const s = buildMiniWorld();
    const reg = rows(s, 'regulations').find((r) => r.categoryId === lightCategory(s).id)!;
    update(s, 'regulations', reg.id, { riderAge: { min: 17, max: 28 } });
    expect(codes(s)).toContain('seat.age'); // Vitellino ha 16 anni al 1° gennaio 2027
  });

  it('un pilota non può essere iscritto due volte nella stessa stagione', () => {
    const s = buildMiniWorld();
    const entry = rows(s, 'teamEntries').find((e) => e.teamId === premierTeam(s).id)!;
    entry.seats[1]!.riderId = entry.seats[0]!.riderId;
    expect(codes(s)).toContain('entry.riderTwice');
  });

  it('rifiuta importi non interi', () => {
    const s = buildMiniWorld();
    insert(s, 'transactions', {
      id: 'trx_000001',
      teamId: premierTeam(s).id,
      day: 3,
      amount: 10.5,
      category: 'travel',
      note: 'x',
    });
    expect(codes(s)).toContain('money.notInteger');
  });
});

describe('teamBalance', () => {
  it('saldo = apertura + somma delle transazioni', () => {
    const s = buildMiniWorld();
    const id = premierTeam(s).id;
    insert(s, 'transactions', {
      id: 'trx_000001',
      teamId: id,
      day: 1,
      amount: -250_000,
      category: 'travel',
      note: 'trasferta',
    });
    insert(s, 'transactions', {
      id: 'trx_000002',
      teamId: id,
      day: 2,
      amount: 1_000_000,
      category: 'sponsor',
      note: 'rata',
    });
    expect(teamBalance(s, id)).toBe(20_750_000);
  });
});
