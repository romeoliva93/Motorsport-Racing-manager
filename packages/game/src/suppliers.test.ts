import { describe, expect, it } from 'vitest';
import { rows, type ManufacturerId, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { supplierOffers, supplierPerks, supplyFeeYearly } from './suppliers.ts';
import { bikeOf } from './weekend.ts';
import { upgradeCost, leadDays } from './upgrades.ts';
import { financeView } from './views.ts';

const SEED = 'fornitori-1';
const pick = (e: GameEngine, name: string) =>
  rows(e.state, 'teams').find((t) => t.name === name)!.id as TeamId;
const mfr = (e: GameEngine, name: string) =>
  rows(e.state, 'manufacturers').find((m) => m.name === name)!.id as ManufacturerId;

describe('costruttori, squadre ufficiali e clienti', () => {
  it('non si può partire da una squadra ufficiale', () => {
    const e = GameEngine.newCareer({ seed: SEED, saveName: 'x' });
    const r = e.dispatch({ type: 'SetPlayerTeam', teamId: pick(e, 'Ardena Corse') });
    expect(r.ok).toBe(false);
  });

  it('ogni costruttore della MotoGP ha la sua squadra ufficiale e un’offerta con agevolazioni', () => {
    const e = GameEngine.newCareer({ seed: SEED, saveName: 'x' });
    const cat = rows(e.state, 'categories').find((c) => c.tier === 'premier')!;
    const offers = supplierOffers(e.state, cat.id);
    expect(offers.length).toBe(5);
    for (const o of offers) {
      expect(o.factoryTeam).not.toBeNull();
      expect(o.perks.length).toBeGreaterThan(0);
      expect(o.feeYearly).toBeGreaterThan(0);
    }
  });

  it('scegliere il costruttore cambia moto, agevolazioni, canone e incassa il contributo', () => {
    const e = GameEngine.newCareer({ seed: SEED, saveName: 'x' });
    const lupo = pick(e, 'Scuderia Lupo Blu');
    const before = financeView(e.state as never);
    const corvane = mfr(e, 'Corvane');
    expect(e.dispatch({ type: 'SetPlayerTeam', teamId: lupo, manufacturerId: corvane }).ok).toBe(true);
    const entry = rows(e.state, 'teamEntries').find((x) => x.teamId === lupo)!;
    expect(entry.manufacturerId).toBe(corvane);
    expect(supplierPerks(e.state, lupo).signingBonus).toBe(1_500_000);
    expect(rows(e.state, 'transactions').some((t) => t.teamId === lupo && t.amount === 1_500_000)).toBe(true);
    expect(supplyFeeYearly(e.state, lupo)).toBe(1_200_000);
    expect(before).toBeNull(); // prima della scelta non c'è una squadra del giocatore
    expect(financeView(e.state as never)!.monthly.supply).toBe(100_000);
    expect(rows(e.state, 'news').some((n) => n.mine && n.title.includes('Corvane'))).toBe(true);
  });

  it('le agevolazioni hanno effetti reali; le squadre ufficiali non ne hanno', () => {
    const e = GameEngine.newCareer({ seed: SEED, saveName: 'x' });
    const lupo = pick(e, 'Scuderia Lupo Blu');
    const ardena = mfr(e, 'Ardena');
    const base = { ...supplierPerks(e.state, lupo, ardena) };
    expect(base.bike).toBeGreaterThan(0);
    expect(supplierPerks(e.state, pick(e, 'Ardena Corse')).bike).toBe(0);
    // Vohrmann: upgrade scontati e consegne più rapide.
    const vohr = mfr(e, 'Vohrmann');
    const costA = upgradeCost(e.state, lupo, 'engine')!;
    const daysA = leadDays(e.state, lupo, 'engine', 1);
    const bikeA = bikeOf(e.state, lupo, ardena).bike;
    e.dispatch({ type: 'SetPlayerTeam', teamId: lupo, manufacturerId: vohr });
    expect(upgradeCost(e.state, lupo, 'engine')!).toBeLessThan(costA);
    expect(leadDays(e.state, lupo, 'engine', 1)).toBeLessThan(daysA);
    expect(bikeOf(e.state, lupo, vohr).bike).not.toBe(bikeA);
  });
});
