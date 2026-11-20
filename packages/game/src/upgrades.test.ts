import { seatRiders } from './upgrades.ts';
import { skipPreseason } from './preseason.ts';
import { describe, expect, it } from 'vitest';
import { rows, teamBalance, validateGameState, type TeamId } from '@lean-angle/data';
import { GameEngine } from './engine.ts';
import { bikeView, sponsorView } from './views.ts';
import { upgradeBonus } from './upgrades.ts';

function career(seed: string) {
  const tmp = GameEngine.newCareer({ seed, saveName: 'x' });
  const team = rows(tmp.state, 'teams').find((t) => t.name === 'Scuderia Lupo Blu')!.id as TeamId;
  return skipPreseason(GameEngine.newCareer({ seed, saveName: 'x', teamId: team }));
}

describe('upgrade dei componenti', () => {
  it("si pagano all'ordine e si montano solo sulla moto del pilota scelto", () => {
    const e = career('up1');
    const team = e.state.meta.playerTeamId!;
    const [a, b] = seatRiders(e.state, team) as [string, string];
    const before = teamBalance(e.state, team);
    const part = (rid: string) =>
      bikeView(e.state)!.parts.find((p) => p.key === 'brakes' && p.riderId === rid)!;
    const cost = part(a).nextCost!;
    expect(e.dispatch({ type: 'BuyUpgrade', part: 'brakes', riderId: a }).ok).toBe(true);
    expect(teamBalance(e.state, team)).toBe(before - cost);
    expect(part(a).level).toBe(0);
    expect(part(a).inProduction!.level).toBe(1);
    expect(part(b).inProduction).toBeNull();
    expect(upgradeBonus(e.state, team, a).bike).toBe(0);
    // Un solo ordine alla volta per componente e pilota; il compagno può ordinare il suo.
    expect(e.dispatch({ type: 'BuyUpgrade', part: 'brakes', riderId: a }).ok).toBe(false);
    expect(e.dispatch({ type: 'BuyUpgrade', part: 'brakes', riderId: 'nessuno' }).ok).toBe(false);
    const days = part(a).inProduction!.daysLeft;
    expect(days).toBeGreaterThanOrEqual(7);
    e.dispatch({ type: 'AdvanceDays', days });
    expect(part(a).level).toBe(1);
    expect(part(a).inProduction).toBeNull();
    // Il compagno di squadra non riceve l'upgrade.
    expect(part(b).level).toBe(0);
    expect(upgradeBonus(e.state, team, a).bike).toBeGreaterThan(0);
    expect(upgradeBonus(e.state, team, b).bike).toBe(0);
    const g = bikeView(e.state)!.garage;
    expect(g.find((x) => x.riderId === a)!.rating).toBeGreaterThan(g.find((x) => x.riderId === b)!.rating);
    expect(validateGameState(e.state)).toEqual([]);
  });

  it('senza soldi non si compra', () => {
    const e = career('up2');
    let guard = 0;
    while (
      e.dispatch({
        type: 'BuyUpgrade',
        part: 'engine',
        riderId: seatRiders(e.state, e.state.meta.playerTeamId!)[0]!,
      }).ok &&
      guard++ < 10
    );
    for (const k of ['brakes', 'suspension', 'chassis', 'aero', 'electronics', 'exhaust'] as const)
      for (let i = 0; i < 3; i++)
        e.dispatch({
          type: 'BuyUpgrade',
          part: k,
          riderId: seatRiders(e.state, e.state.meta.playerTeamId!)[0]!,
        });
    expect(teamBalance(e.state, e.state.meta.playerTeamId!)).toBeGreaterThanOrEqual(0);
  });

  it('le squadre IA investono durante la stagione', () => {
    const e = career('up3');
    for (let i = 0; i < 4; i++) {
      e.dispatch({ type: 'ContinueToNextEvent' });
      e.dispatch({ type: 'RunRace', strategies: {} });
    }
    const ai = Object.keys(e.state.riderUpgrades ?? {}).filter((t) => t !== e.state.meta.playerTeamId);
    expect(ai.length).toBeGreaterThan(0);
  });
});

describe('sponsor con obiettivo', () => {
  it('tre offerte crescenti, firma una sola volta prima del primo GP', () => {
    const e = career('sp1');
    const v = sponsorView(e.state)!;
    expect(v.windowOpen).toBe(true);
    const [safe, bal, amb] = v.offers;
    expect(safe!.targetPosition).toBeGreaterThanOrEqual(bal!.targetPosition);
    expect(amb!.targetPosition).toBeLessThanOrEqual(bal!.targetPosition);
    expect(amb!.bonus).toBeGreaterThan(safe!.bonus);
    expect(e.dispatch({ type: 'SignSponsorDeal', risk: 'balanced' }).ok).toBe(true);
    expect(e.dispatch({ type: 'SignSponsorDeal', risk: 'ambitious' }).ok).toBe(false);
    expect(sponsorView(e.state)!.deal!.label).toBe('Equilibrata');
  });

  it('paga la rata ogni mese e a fine stagione decide il premio', () => {
    const e = career('sp2');
    e.dispatch({ type: 'SignSponsorDeal', risk: 'safe' });
    let guard = 0;
    while (!e.availableCommands().includes('StartNextSeason') && guard++ < 200) {
      if (e.availableCommands().includes('RunRace')) e.dispatch({ type: 'RunRace', strategies: {} });
      else e.dispatch({ type: 'ContinueToNextEvent' });
    }
    const team = e.state.meta.playerTeamId!;
    const rates = rows(e.state, 'transactions').filter(
      (t) => t.teamId === team && t.note === 'Rata dello sponsor con obiettivo',
    );
    expect(rates.length).toBeGreaterThan(5);
    const deal = sponsorView(e.state)!.deal!;
    expect(['met', 'missed']).toContain(deal.status);
    const prize = rows(e.state, 'transactions').some((t) => t.note.startsWith('Premio obiettivo'));
    expect(prize).toBe(deal.status === 'met');
    expect(validateGameState(e.state)).toEqual([]);
  });

  it('dopo il primo GP non si firma più', () => {
    const e = career('sp3');
    e.dispatch({ type: 'ContinueToNextEvent' });
    expect(e.dispatch({ type: 'SignSponsorDeal', risk: 'safe' }).ok).toBe(false);
  });
});
