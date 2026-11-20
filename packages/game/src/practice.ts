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
  Debrief,
  DebriefSuggestion,
  GameState,
  PracticeProgram,
  PracticeRider,
  Rider,
  Round,
  StaffMember,
} from '@lean-angle/data';
import { SETUP_KEYS, idealSetup, setupOf } from './setup.ts';
import { bikeBase, trackBonus } from './preseasonEffects.ts';
import { mechanicsFactor } from './staffMarket.ts';
import { managerSkill } from './managerSkills.ts';

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
export function defaultConfidence(r: Rider, done: string[], matchPct = 75, startBike = 50, trackPlus = 0) {
  let track = baseTrackConf(r) + trackPlus,
    bike = startBike;
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
    trackConf: baseTrackConf(r) + trackBonus(s, r.id, true),
    bikeConf: bikeBase(s, r.id, true),
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
  /** Uscita di una sessione a uscite: giri dell'uscita ed etichetta. */
  opts: { laps?: number; label?: string } = {},
) {
  const pr = practiceRider(s, round, r);
  const laps = opts.laps ?? PRACTICE_LAPS[kind] ?? 10;
  pr.laps += laps;
  pr.trackConf = Math.round(grownTrackConf(pr.trackConf, laps, program, wet) * 10) / 10;
  pr.bikeConf = Math.round(grownBikeConf(pr.bikeConf, matchPct, program) * 10) / 10;
  if (program === 'longRun') pr.longRun = true;
  pr.minutesUsed = 0;
  pr.log.push({
    session: opts.label ?? SESSION_SHORT[kind] ?? kind,
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
  // Meccanici in squadra e corso di gestione tecnica del manager (−8% per livello).
  const teamId = s.staffAssignments.find((x) => x.riderId === riderId)?.teamId;
  const crew = teamId ? mechanicsFactor(s, teamId) : 1;
  const mgr = teamId === s.meta.playerTeamId ? 1 - 0.08 * managerSkill(s, 'technical') : 1;
  return Math.ceil(steps * (1.25 - 0.5 * speed) * crew * mgr);
}

/**
 * Pausa di lavoro in corso (fra due sessioni dello stesso weekend): minuti rimasti per il pilota, oppure null
 * se non c'è un limite (prima del weekend, prima della prima sessione o a weekend concluso).
 */
export function workMinutesLeft(s: GameState, round: Round | undefined, riderId: string): number | null {
  // Rientro ai box durante una sessione a uscite: tempo breve per le modifiche.
  const stintOn = !!round && s.stint?.roundId === round.id && s.stint.kind !== 'test';
  if (!round || (!round.stage && !stintOn)) return null;
  const pr = practiceRiderOf(s, round.id, riderId);
  return (stintOn ? PIT_MINUTES : BREAK_MINUTES) - (pr?.minutesUsed ?? 0);
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

// ---------------------------------------------------------------------------------------------
/** Uscite in pista di ogni sessione (rientro ai box fra un'uscita e l'altra). */
export const RUNS_PER_SESSION: Record<string, number> = { fp1: 3, fp2: 3, practice: 3, warmup: 2, test: 3 };
/** Minuti di lavoro a ogni rientro ai box durante una sessione. */
export const PIT_MINUTES = 15;

/** Soglie dell'umore (punteggio dei problemi: più alto = peggio). */
const MOOD_GOOD = 4;
const MOOD_OK = 7.5;
/** Frasi d'apertura del pilota al rientro ai box, per umore. */
const OPENERS: Record<Debrief['mood'], string[]> = {
  good: [
    'La moto mi piace, riesco a spingere.',
    'Buone sensazioni, la moto fa quello che le chiedo.',
    'Siamo sulla strada giusta, mi sento a mio agio.',
  ],
  ok: [
    'Va abbastanza bene, ma perdo qualcosa.',
    'Non è male, però non riesco a spingere come vorrei.',
    'Così così: in alcuni punti va, in altri no.',
    'Ci manca ancora qualcosa per essere veloci.',
  ],
  bad: [
    'Questa moto non mi piace per niente.',
    'Faccio fatica, la moto non mi segue.',
    'Non ho fiducia, così non posso spingere.',
    'È difficilissima da guidare, così perdiamo tanto.',
    'Non ci siamo: ogni giro è una lotta con la moto.',
  ],
};
/** Lamentela per regolazione: [quando andrebbe abbassata, quando andrebbe alzata]. */
const COMPLAINT: Record<string, [string, string]> = {
  forkPreload: [
    'L’anteriore è troppo rigido, in ingresso curva non sento la gomma.',
    'In frenata l’anteriore affonda troppo e la moto si scompone.',
  ],
  shock: [
    'Il posteriore è troppo duro, in uscita la gomma scivola.',
    'Il posteriore è troppo morbido, la moto si siede in accelerazione.',
  ],
  rideHeight: [
    'In uscita di curva pattino, mi serve più trazione.',
    'Nei cambi di direzione la moto è pigra, mi serve più agilità.',
  ],
  gearing: [
    'I rapporti sono troppo lunghi, in uscita dalle curve lente non spinge.',
    'I rapporti sono troppo corti, sul dritto vado subito in limitatore.',
  ],
  engineBrake: [
    'Troppo freno motore, in staccata il posteriore saltella.',
    'Poco freno motore, in ingresso la moto non si ferma.',
  ],
  traction: [
    'Il controllo di trazione interviene troppo, mi taglia la potenza.',
    'Il controllo di trazione è troppo basso, il posteriore parte in uscita.',
  ],
};
const VAGUE = [
  'Qualcosa non mi convince, ma non saprei dire cosa.',
  'Non riesco a capire dove perdo, forse dietro.',
  'Sento che qualcosa non va, ma non so spiegarlo bene.',
];

/** Numero da 0 a 1 fisso per una stringa (per scelte deterministiche senza consumare il generatore). */
function unitHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/**
 * Rientro ai box: il pilota racconta come va la moto e il capotecnico propone fino a tre modifiche. Con un
 * pilota dal feedback vago e un capotecnico poco esperto qualche proposta può essere sbagliata: sta al
 * manager decidere quali applicare.
 */
export function debriefFor(
  s: GameState,
  r: Rider,
  tier: CategoryTier,
  turns: number,
  wet: boolean,
  info: { run: number; runs: number; best: number | null; position: number; laps: number; tag: string },
): Debrief {
  const cc = crewChiefOf(s, r.id);
  const chiefName = cc ? `${cc.firstName} ${cc.lastName}` : 'Il capotecnico';
  const cur = setupOf(s, r.id, wet);
  const ideal = idealSetup(r, turns, wet);
  const keys = SETUP_KEYS[tier];
  const gaps = keys.map((k) => ({ k, d: (ideal[k.key] ?? 0) - (cur[k.key] ?? 0) }));
  const err = gaps.reduce((t, g) => t + Math.abs(g.d), 0) / Math.max(1, keys.length);
  const match = Math.round(Math.max(0, 100 - err * 12));
  const pr = s.practice?.riders[r.id] ?? null;
  const clear = r.attributes.technicalFeedback >= 70 || (!!pr && (pr.bikeConf >= 72 || pr.laps >= 30));
  const skill = (sk(cc, 'suspensionSetup') + sk(cc, 'chassisSetup') + sk(cc, 'feedbackInterpretation')) / 300;
  const worst = gaps.filter((g) => Math.abs(g.d) >= 1).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const suggestions: DebriefSuggestion[] = worst.slice(0, 3).map((g, i) => {
    const big = Math.abs(g.d) >= 4;
    const riderText =
      Math.abs(g.d) <= 1
        ? 'Qui quasi ci siamo.'
        : !clear
          ? big
            ? 'Qui qualcosa non mi convince.'
            : 'Non saprei, forse si può fare meglio.'
          : `Vorrei ${g.d > 0 ? g.k.high : g.k.low}${big ? ', decisamente' : ''}.`;
    // Precisione della proposta: capotecnico bravo e pilota chiaro = valore giusto; altrimenti un passo prudente,
    // e dalla seconda proposta in poi può anche sbagliare direzione.
    let step = skill >= 0.65 && clear ? g.d : Math.sign(g.d) * Math.min(2, Math.abs(g.d));
    const wrongChance = i === 0 ? 0 : Math.max(0, (0.75 - skill) * (clear ? 0.3 : 0.9));
    const wrong = unitHash(`${info.tag}:${r.id}:${g.k.key}`) < wrongChance;
    if (wrong) step = -Math.sign(g.d);
    const to = Math.max(-5, Math.min(5, (cur[g.k.key] ?? 0) + step));
    const sure = !wrong && skill >= 0.6 && (clear || i === 0);
    return {
      key: g.k.key,
      name: g.k.name,
      from: cur[g.k.key] ?? 0,
      to,
      minutes: changeMinutes(s, r.id, cur, { ...cur, [g.k.key]: to }),
      rider: riderText,
      chief: `${g.k.name} ${to > (cur[g.k.key] ?? 0) ? '+' : '−'}${Math.abs(to - (cur[g.k.key] ?? 0))} (${to > (cur[g.k.key] ?? 0) ? g.k.high : g.k.low})${sure ? '' : ': proviamo e vediamo'}.`,
      sure,
    };
  });
  // Umore del pilota: conta il problema più grosso, quante regolazioni sono lontane e la sua confidenza.
  const worstGap = Math.abs(worst[0]?.d ?? 0);
  const far = gaps.filter((g) => Math.abs(g.d) >= 2).length;
  const bikeConf = pr?.bikeConf ?? 50;
  const score = worstGap * 1.4 + far * 0.9 + (bikeConf < 55 ? 1.2 : bikeConf > 72 ? -0.8 : 0);
  const mood: Debrief['mood'] = score <= MOOD_GOOD ? 'good' : score <= MOOD_OK ? 'ok' : 'bad';
  const pick = (list: string[], salt: string) =>
    list[Math.floor(unitHash(`${s.meta.seed}:${info.tag}:${r.id}:${salt}`) * list.length)]!;
  const opener = pick(OPENERS[mood], 'o');
  // Lamentela concreta sul punto peggiore (chiara solo se il pilota sa spiegarsi).
  const w = worst[0];
  const detail = !w
    ? ' Non toccherei niente.'
    : clear
      ? ` ${COMPLAINT[w.k.key]?.[w.d > 0 ? 1 : 0] ?? `${w.k.name}: vorrei ${w.d > 0 ? w.k.high : w.k.low}.`}`
      : ` ${pick(VAGUE, 'v')}`;
  return {
    riderId: r.id,
    run: info.run,
    runs: info.runs,
    best: info.best,
    position: info.position,
    match: clear ? match : null,
    quote: `${opener}${detail}`,
    mood,
    chiefName,
    suggestions,
  };
}
