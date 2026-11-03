import { describe, expect, it } from 'vitest';
import { generateTrack } from './track.ts';
import { RaceSim, runRace, type RaceRider, type RaceSetup } from './race.ts';

const track = generateTrack('brennholz', 14);
const rider = (id: string, skill: number, extra: Partial<RaceRider> = {}): RaceRider => ({
  id,
  skill,
  bike: 0.8,
  overtaking: 0.7,
  defending: 0.7,
  consistency: 0.75,
  concentration: 0.8,
  aggression: 0.5,
  tyreManagement: 0.7,
  reliability: 0.95,
  compound: 'medium',
  mode: 'normal',
  ...extra,
});
const setup = (seed: string, grid?: RaceRider[], extra: Partial<RaceSetup> = {}): RaceSetup => ({
  seed,
  track,
  lengthM: 4600,
  laps: 12,
  refLap: 100,
  grid: grid ?? Array.from({ length: 20 }, (_, i) => rider(`r${i}`, 0.9 - i * 0.008)),
  fuel: { capacity: 22, perLap: (22 * 0.94) / 12, start: 22 },
  ...extra,
});

describe('simulazione incrementale', () => {
  it('a passi o tutta insieme dà lo stesso risultato', () => {
    const a = runRace(setup('inc-1'));
    const sim = new RaceSim(setup('inc-1'));
    for (let t = 10; !sim.done; t += 10) sim.advanceTo(t);
    expect(sim.result().results).toEqual(a.results);
    expect(sim.result().frames).toEqual(a.frames);
  });

  it('salvataggio a metà gara: ripresa identica (anche dopo un cambio di strategia)', () => {
    const ref = new RaceSim(setup('inc-2'));
    ref.advanceTo(300);
    ref.setStrategy('r3', { mode: 'maxAttack', fuelMap: 'performance' });
    ref.advanceTo(600);
    const snap = JSON.parse(JSON.stringify(ref.snapshot()));
    ref.runToEnd();
    const resumed = RaceSim.restore(setup('inc-2'), snap);
    resumed.runToEnd();
    expect(resumed.result().results).toEqual(ref.result().results);
    expect(resumed.result().events).toEqual(ref.result().events);
  });

  it('cambiare strategia cambia davvero la gara (dagli istanti successivi)', () => {
    const base = new RaceSim(setup('inc-3'));
    const changed = new RaceSim(setup('inc-3'));
    base.advanceTo(200);
    changed.advanceTo(200);
    expect(changed.result().frames).toEqual(base.result().frames); // fin qui identiche
    changed.setStrategy('r5', { mode: 'maxAttack', tyreMode: 'performance' });
    base.runToEnd();
    changed.runToEnd();
    expect(changed.result().results).not.toEqual(base.result().results);
    expect(changed.result().events.some((e) => e.kind === 'strategy' && e.riderId === 'r5')).toBe(true);
  });

  it('attacco massimo: giri più veloci ma più gomma, carburante e fatica; molto conservativo il contrario', () => {
    const solo = (mode: RaceRider['mode']) => {
      const sim = new RaceSim(setup('inc-4', [rider('x', 0.85, { mode, manual: true })]));
      sim.advanceTo(500);
      const live = sim.live()[0]!;
      const laps = sim.result().laps[0]!.times;
      return { live, avg: laps.reduce((t, v) => t + v, 0) / laps.length };
    };
    const fast = solo('maxAttack'),
      slow = solo('veryConservative');
    expect(fast.avg).toBeLessThan(slow.avg);
    expect(fast.live.tyreWear).toBeGreaterThan(slow.live.tyreWear);
    expect(fast.live.fuel).toBeLessThan(slow.live.fuel);
    expect(fast.live.fatigue).toBeGreaterThan(slow.live.fatigue);
    expect(fast.live.tyreTemp).toBeGreaterThan(slow.live.tyreTemp);
  });

  it('mappa risparmio: consuma meno; con il serbatoio troppo vuoto si resta a secco', () => {
    const fuelAfter = (fuelMap: 'save' | 'performance') => {
      const sim = new RaceSim(setup('inc-5', [rider('x', 0.85, { fuelMap, manual: true })]));
      sim.advanceTo(600);
      return sim.live()[0]!.fuel;
    };
    expect(fuelAfter('save')).toBeGreaterThan(fuelAfter('performance'));
    const dry = runRace(
      setup('inc-6', [rider('x', 0.85, { mode: 'maxAttack', fuelMap: 'performance', manual: true })], {
        fuel: { capacity: 22, perLap: 2, start: 14 },
      }),
    );
    expect(dry.results[0]!.status).toBe('dnf');
    expect(dry.results[0]!.reason).toBe('fuel');
    expect(dry.events.some((e) => e.kind === 'fuelOut')).toBe(true);
  });

  it("l'IA usa le stesse leve (cambia ritmo, carburante o gomme durante la gara)", () => {
    const sim = new RaceSim(setup('inc-7'));
    sim.runToEnd();
    const changed = sim
      .live()
      .filter((x) => x.mode !== 'normal' || x.fuelMap !== 'standard' || x.tyreMode !== 'balanced');
    expect(changed.length).toBeGreaterThan(0);
  });

  it('equilibrio su 120 gare: vincono i più forti, ritiri e distacchi realistici', () => {
    let topWins = 0,
      dnf = 0,
      fuelOut = 0;
    for (let i = 0; i < 120; i++) {
      const o = runRace(setup(`bal-${i}`));
      const w = o.results.find((r) => r.position === 1)!;
      if (['r0', 'r1', 'r2', 'r3', 'r4'].includes(w.riderId)) topWins++;
      dnf += o.results.filter((r) => r.status === 'dnf').length;
      fuelOut += o.results.filter((r) => r.reason === 'fuel').length;
    }
    expect(topWins / 120).toBeGreaterThan(0.5); // vecchio motore 0,66, nuovo 0,62 (200 gare)
    expect(dnf / 120).toBeGreaterThan(0.3);
    expect(dnf / 120).toBeLessThan(4);
    // L'IA gestisce il carburante: restare a secco deve essere raro.
    expect(fuelOut / 120).toBeLessThan(0.1);
  });
});
