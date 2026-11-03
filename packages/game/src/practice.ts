/**
 * Prove del weekend (Milestone C, primo passo): programma di lavoro, confidenza, briefing, tempi di lavoro.
 *
 * - Ogni sessione di prove il giocatore sceglie per ciascun pilota un **programma**: conoscere il circuito,
 *   lavorare sull'assetto o fare un passo gara (long run).
 * - **Confidenza col circuito** (cresce con i giri, rendimenti decrescenti; più lenta sul bagnato) e
 *   **confidenza con la moto** (insegue l'intesa con l'assetto). Valgono in pista per tutti, IA comprese:
 *   ritmo × (0,99 + 0,02 × media delle due confidenze) → ±1%.
 * - Il passo gara dà dati sulle gomme: in gara la gestione gomme del pilota sale del 4%.
 * - **Briefing**: commenti del pilota (più chiari con più giri e più confidenza) e consiglio del capotecnico
 *   (preciso secondo le sue competenze).
 * - **Tempi di lavoro**: fra una sessione e l'altra ci sono 45 minuti; ogni scatto di una regolazione costa
 *   minuti (le sospensioni poco, i rapporti molto), meno con un capotecnico rapido.
 */
import type {
  CategoryTier,
  GameState,
  PracticeProgram,
  PracticeRider,
  Rider,
  Round,
  StaffMember,
} from '@lean-angle/data';
import { SETUP_KEYS, idealSetup } from './setup.ts';

export const PRACTICE_KINDS = ['fp1', 'fp2', 'practice', 'warmup'] as const;
export const PRACTICE_LAPS: Record<string, number> = { fp1: 16, fp2: 16, practice: 18, warmup: 6 };
export const SESSION_SHORT: Record<string, string> = {
  fp1: 'FP1',
  practice: 'Prove',
  fp2: 'FP2',
  q1: 'Q1',
  q2: 'Q2',
  qualifying: 'Qualifiche',
  sprint: 'Sprint',
  warmup: 'Warm Up',
  race: 'Gara',
};
export const PROGRAMS: Record<PracticeProgram, { label: string; text: string }> = {
  track: {
    label: 'Circuito',
    text: 'Tanti giri per imparare traiettorie e punti di frenata: cresce soprattutto la confidenza col circuito.',
  },
  setup: {
    label: 'Assetto',
    text: 'Uscite brevi e prove di regolazioni: la confidenza con la moto si avvicina all’intesa con l’assetto e i commenti del pilota diventano più chiari.',
  },
  longRun: {
    label: 'Passo gara',
    text: 'Una simulazione di gara con gomme usate: dati sul consumo, in gara gestione gomme migliore del 4%.',
  },
};
/** Minuti fra una sessione e l'altra per le modifiche d'assetto. */
export const BREAK_MINUTES = 45;
/** Minuti per uno scatto di ogni regolazione. */
const STEP_MINUTES: Record<string, number> = {
  forkPreload: 4,
  shock: 6,
  rideHeight: 8,
  gearing: 12,
  engineBrake: 3,
  traction: 2,
};

const u = (x: number) => Math.max(0, Math.min(1, (x - 1) / 99));

/** Confidenza col circuito a inizio weekend: piloti costanti ed esperti partono meglio. */
export function baseTrackConf(r: Rider): number {
  return Math.round(30 + 20 * u(r.attributes.consistency) + 10 * u(r.attributes.technicalFeedback));
}

const TRACK_RATE: Record<PracticeProgram, number> = { track: 0.05, setup: 0.025, longRun: 0.035 };
const BIKE_RATE: Record<PracticeProgram, number> = { track: 0.3, setup: 0.65, longRun: 0.4 };

/** Nuova confidenza col circuito dopo `laps` giri con il programma indicato. */
export function grownTrackConf(conf: number, laps: number, program: PracticeProgram, wet: boolean): number {
  const k = 1 - Math.exp(-laps * TRACK_RATE[program] * (wet ? 0.7 : 1));
  return Math.min(100, conf + (100 - conf) * k);
}
export function grownBikeConf(conf: number, matchPct: number, program: PracticeProgram): number {
  return conf + (matchPct - conf) * BIKE_RATE[program];
}

/** Moltiplicatore del ritmo dovuto alla confidenza (±1%). */
export const confidenceFactor = (trackConf: number, bikeConf: number) =>
  0.99 + 0.02 * ((trackConf + bikeConf) / 200);

/** Prove già disputate in questo weekend (prima della sessione `round.stage`). */
export function practicesDone(sessions: readonly string[], stage: number): string[] {
  return sessions.slice(0, stage).filter((k) => (PRACTICE_KINDS as readonly string[]).includes(k));
}

/**
 * Confidenza "di serie" (IA, o piloti del giocatore senza dati): programma Circuito in ogni prova, e confidenza
 * con la moto che insegue l'intesa media delle squadre IA (75%).
 */
export function defaultConfidence(r: Rider, done: string[], matchPct = 75) {
  let track = baseTrackConf(r),
    bike = 50;
  for (const k of done) {
    track = grownTrackConf(track, PRACTICE_LAPS[k] ?? 10, 'track', false);
    bike = grownBikeConf(bike, matchPct, 'track');
  }
  return { trackConf: track, bikeConf: bike };
}

/** Stato delle prove del weekend del giocatore (creato o azzerato quando cambia il round). */
export function ensurePractice(s: GameState, round: Round) {
  if (!s.practice || s.practice.roundId !== round.id) s.practice = { roundId: round.id, riders: {} };
  return s.practice;
}
export function practiceRider(s: GameState, round: Round, r: Rider): PracticeRider {
  const p = ensurePractice(s, round);
  return (p.riders[r.id] ??= {
    laps: 0,
    trackConf: baseTrackConf(r),
    bikeConf: 50,
    minutesUsed: 0,
    longRun: false,
    log: [],
  });
}
/** Dati delle prove di un pilota, senza modificare lo stato (null = nessun dato per questo round). */
export function practiceRiderOf(s: GameState, roundId: string, riderId: string): PracticeRider | null {
  return s.practice?.roundId === roundId ? (s.practice.riders[riderId] ?? null) : null;
}

/** Registra un'uscita di prove del giocatore: giri, confidenze, cronologia; apre una nuova pausa di lavoro. */
export function recordPracticeRun(
  s: GameState,
  round: Round,
  kind: string,
  r: Rider,
  program: PracticeProgram,
  wet: boolean,
  matchPct: number,
  best: number | null,
) {
  const pr = practiceRider(s, round, r);
  const laps = PRACTICE_LAPS[kind] ?? 10;
  pr.laps += laps;
  pr.trackConf = Math.round(grownTrackConf(pr.trackConf, laps, program, wet) * 10) / 10;
  pr.bikeConf = Math.round(grownBikeConf(pr.bikeConf, matchPct, program) * 10) / 10;
  if (program === 'longRun') pr.longRun = true;
  pr.minutesUsed = 0;
  pr.log.push({
    session: SESSION_SHORT[kind] ?? kind,
    kind: 'run',
    text: `${laps} giri · programma ${PROGRAMS[program].label.toLowerCase()}${wet ? ' · pista bagnata' : ''}`,
    laps,
    ...(best !== null ? { best } : {}),
    match: Math.round(matchPct),
  });
}

function crewChiefOf(s: GameState, riderId: string): StaffMember | null {
  const a = s.staffAssignments.find((x) => x.riderId === riderId);
  return a ? (s.tables.staff[a.crewChiefId] ?? null) : null;
}
const sk = (m: StaffMember | null, k: string) => m?.skills[k] ?? 50;

/** Minuti necessari per passare dall'assetto `from` a `to` (capotecnico rapido = meno tempo). */
export function changeMinutes(
  s: GameState,
  riderId: string,
  from: Record<string, number>,
  to: Record<string, number>,
): number {
  const steps = Object.entries(to).reduce(
    (t, [k, v]) => t + Math.abs(v - (from[k] ?? 0)) * (STEP_MINUTES[k] ?? 5),
    0,
  );
  const cc = crewChiefOf(s, riderId);
  const speed = (sk(cc, 'timeManagement') + sk(cc, 'mechanicsCoordination')) / 200;
  return Math.ceil(steps * (1.25 - 0.5 * speed));
}

/**
 * Pausa di lavoro in corso (fra due sessioni dello stesso weekend): minuti rimasti per il pilota, oppure null
 * se non c'è un limite (prima del weekend, prima della prima sessione o a weekend concluso).
 */
export function workMinutesLeft(s: GameState, round: Round | undefined, riderId: string): number | null {
  if (!round || !round.stage) return null;
  const pr = practiceRiderOf(s, round.id, riderId);
  return BREAK_MINUTES - (pr?.minutesUsed ?? 0);
}

/** Consiglio del capotecnico: la regolazione più lontana dall'ideale, precisa secondo le sue competenze. */
export function crewChiefAdvice(
  s: GameState,
  r: Rider,
  tier: CategoryTier,
  turns: number,
  wet: boolean,
  cur: Record<string, number>,
): { name: string; text: string; key: string | null; delta: number } {
  const cc = crewChiefOf(s, r.id);
  const name = cc ? `${cc.firstName} ${cc.lastName}` : 'Il capotecnico';
  const ideal = idealSetup(r, turns, wet);
  const skill = (sk(cc, 'suspensionSetup') + sk(cc, 'chassisSetup') + sk(cc, 'feedbackInterpretation')) / 300;
  const worst = SETUP_KEYS[tier]
    .map((k) => ({ k, d: ideal[k.key]! - (cur[k.key] ?? 0) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  if (!worst || Math.abs(worst.d) <= 1)
    return {
      name,
      key: null,
      delta: 0,
      text: 'L’assetto è vicino all’ideale: lavorerei sul ritmo e sulle gomme.',
    };
  // Capotecnico bravo: indica quanto; meno bravo: un passo prudente nella direzione giusta.
  const step = skill >= 0.65 ? worst.d : Math.sign(worst.d) * Math.min(2, Math.abs(worst.d));
  const dir = worst.d > 0 ? worst.k.high : worst.k.low;
  return {
    name,
    key: worst.k.key,
    delta: step,
    text: `${worst.k.name}: ${step > 0 ? '+' : '−'}${Math.abs(step)} (${dir}).${skill >= 0.65 ? '' : ' Proviamo così e vediamo.'}`,
  };
}

/** I commenti del pilota sono chiari se ha buon feedback tecnico, o dopo abbastanza giri e confidenza. */
export function feedbackIsClear(r: Rider, pr: PracticeRider | null): boolean {
  return r.attributes.technicalFeedback >= 70 || (!!pr && (pr.bikeConf >= 72 || pr.laps >= 30));
}
