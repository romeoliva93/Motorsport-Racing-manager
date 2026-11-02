/**
 * Assetto della moto, separato da componenti e upgrade: sono regolazioni che adattano la moto al pilota e al
 * circuito, una per pilota (i due piloti della stessa squadra hanno assetti indipendenti), su asciutto e bagnato.
 *
 * Ogni regolazione va da −5 a +5. Esiste un valore ideale nascosto, ricavato dallo stile del pilota (attributi)
 * e dal circuito (numero di curve), con correzioni sul bagnato. L'intesa (0–1) è quanto l'assetto si avvicina
 * all'ideale e vale in pista: il ritmo del pilota è moltiplicato per 0,985 + 0,03 × intesa (±1,5%).
 * Il giocatore non vede l'ideale: vede i commenti del pilota, tanto più precisi quanto migliore è il suo feedback
 * tecnico. Le squadre IA hanno un'intesa fissa di 0,75.
 */
import type { CategoryTier, GameState, Rider, Round } from '@lean-angle/data';

export interface SetupKey {
  key: string;
  name: string;
  low: string;
  high: string;
}
const ALL: Record<string, SetupKey> = {
  forkPreload: {
    key: 'forkPreload',
    name: 'Precarico forcella',
    low: 'avantreno morbido',
    high: 'avantreno rigido',
  },
  shock: { key: 'shock', name: 'Rigidità mono', low: 'posteriore morbido', high: 'posteriore rigido' },
  rideHeight: { key: 'rideHeight', name: 'Altezza posteriore', low: 'più trazione', high: 'più agilità' },
  gearing: { key: 'gearing', name: 'Rapporti', low: 'corti (accelerazione)', high: 'lunghi (velocità)' },
  engineBrake: { key: 'engineBrake', name: 'Freno motore', low: 'poco', high: 'molto' },
  traction: { key: 'traction', name: 'Controllo di trazione', low: 'basso', high: 'alto' },
};
/** Regolazioni consentite per categoria (Rookies: solo quelle autorizzate sulla moto monomarca). */
export const SETUP_KEYS: Record<CategoryTier, SetupKey[]> = {
  premier: [ALL.forkPreload!, ALL.shock!, ALL.rideHeight!, ALL.gearing!, ALL.engineBrake!, ALL.traction!],
  intermediate: [ALL.forkPreload!, ALL.shock!, ALL.rideHeight!, ALL.gearing!, ALL.traction!],
  lightweight: [ALL.forkPreload!, ALL.shock!, ALL.rideHeight!, ALL.gearing!],
  rookies: [ALL.forkPreload!, ALL.shock!],
};

const clamp = (v: number) => Math.max(-5, Math.min(5, Math.round(v)));

/** Ideale (nascosto) per pilota, circuito e condizione. */
export function idealSetup(r: Rider, turns: number, wet: boolean): Record<string, number> {
  const a = r.attributes;
  const style = (a.cornerEntry - a.acceleration) / 4; // + agile, − stop and go
  return {
    forkPreload: clamp((a.braking - 70) / 4 - (wet ? 2 : 0)),
    shock: clamp(-style - (wet ? 2 : 0)),
    rideHeight: clamp(style),
    gearing: clamp((14 - turns) / 2),
    engineBrake: clamp((70 - a.aggression) / 6),
    traction: clamp((60 - a.aggression) / 5 + (wet ? 2 : 0)),
  };
}

export function setupOf(s: GameState, riderId: string, wet: boolean): Record<string, number> {
  const st = s.setups?.[riderId];
  return { ...((wet ? st?.wet : st?.dry) ?? {}) };
}

/** Intesa assetto 0–1 per un pilota della squadra del giocatore (le IA: 0,75). */
export function setupMatch(
  s: GameState,
  r: Rider,
  tier: CategoryTier,
  turns: number,
  wet: boolean,
  mine: boolean,
) {
  if (!mine) return 0.75;
  const keys = SETUP_KEYS[tier];
  const ideal = idealSetup(r, turns, wet);
  const cur = setupOf(s, r.id, wet);
  const err = keys.reduce((t, k) => t + Math.abs((cur[k.key] ?? 0) - ideal[k.key]!), 0) / keys.length;
  return Math.max(0, 1 - err / 6);
}

/** Moltiplicatore del ritmo dovuto all'assetto. */
export const setupFactor = (match: number) => 0.985 + 0.03 * match;

/**
 * Commento del pilota su ogni regolazione: con feedback tecnico alto indica la direzione giusta, con feedback
 * basso è vago. Nessun numero esatto: l'assetto si trova provando.
 */
export function setupFeedback(
  r: Rider,
  tier: CategoryTier,
  turns: number,
  wet: boolean,
  cur: Record<string, number>,
) {
  const ideal = idealSetup(r, turns, wet);
  const precise = r.attributes.technicalFeedback >= 70;
  return SETUP_KEYS[tier].map((k) => {
    const d = ideal[k.key]! - (cur[k.key] ?? 0);
    const text =
      Math.abs(d) <= 1
        ? 'Così va bene.'
        : !precise
          ? Math.abs(d) >= 4
            ? 'Qui qualcosa non mi convince.'
            : 'Non saprei, forse si può migliorare.'
          : `Vorrei ${d > 0 ? k.high : k.low}${Math.abs(d) >= 4 ? ', decisamente' : ''}.`;
    return { key: k.key, text, ok: Math.abs(d) <= 1 };
  });
}

export function turnsOf(s: GameState, round: Round | undefined): number {
  return round ? (s.tables.circuits[round.circuitId]?.turns ?? 14) : 14;
}
