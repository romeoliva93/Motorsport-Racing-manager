import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ReplayData } from '@lean-angle/game';
import type { FuelMap, LiveRider, PaceMode, TyreMode } from '@lean-angle/sim';
import { engine } from '../../engine/engine.ts';
import { Flag } from '../../design-system/Flag.tsx';
import { lapTime, raceTime } from '../../design-system/components.tsx';
import { Portrait } from '../../design-system/Portrait.tsx';
import { Helmet } from '../../design-system/Helmet.tsx';
import { NumberPlate } from '../../design-system/NumberPlate.tsx';
import { buildScene, drawDynamic, drawStatic, fitView, type View } from '../../race/circuitScene.ts';
import { INTRO, duration, lastDistances, raceFrame, teamsOf } from '../../race/raceState.ts';
import { usePrefs, webglAvailable } from '../../prefs.ts';
import type { Cam3D } from '../../race/Race3D.tsx';
import { RaceTiming } from '../../race/timing.ts';
import { TimingTower } from '../../race/TimingTower.tsx';

const SPEEDS = [0, 1, 2, 4, 8, 16] as const;
/** Vista 3D caricata solo quando richiesta (Three.js). */
const Race3D = lazy(() => import('../../race/Race3D.tsx'));
type Cam = 'all' | 'mine' | 'leader';
const CAMS: { id: Cam; label: string }[] = [
  { id: 'all', label: 'Tutto il circuito' },
  { id: 'mine', label: 'Pilota selezionato' },
  { id: 'leader', label: 'Il leader' },
];
const CAMS3D: { id: Cam3D; label: string }[] = [
  { id: 'auto', label: 'Regia' },
  { id: 'tv', label: 'TV' },
  { id: 'chase', label: 'Inseguimento' },
  { id: 'trackside', label: 'Bordo pista' },
  { id: 'box', label: 'Box' },
  { id: 'all', label: 'Panoramica' },
];

/** Se il 3D non si carica (niente WebGL, errore del driver) si torna al 2D senza toccare la gara. */
class Fallback3D extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Vista 2D dall'alto della gara. Riproduce i fotogrammi registrati dalla simulazione (la gara è già stata
 * calcolata dal motore: qui la si guarda, alla velocità scelta). Fra due fotogrammi la posizione è interpolata.
 * Prima del via le moto escono dai box, percorrono la corsia box e il giro di ricognizione e si fermano nella
 * casella di griglia calcolata dalla simulazione.
 */
/** Livelli delle tre leve di strategia in gara (stessi nomi del motore). */
const PACE: { id: PaceMode; label: string; full: string }[] = [
  { id: 'veryConservative', label: '−−', full: 'Molto conservativo' },
  { id: 'conservative', label: '−', full: 'Conservativo' },
  { id: 'normal', label: 'Norm.', full: 'Normale' },
  { id: 'attack', label: '+', full: 'Aggressivo' },
  { id: 'maxAttack', label: '++', full: 'Attacco massimo' },
];
const FUEL: { id: FuelMap; label: string }[] = [
  { id: 'save', label: 'Risparmio' },
  { id: 'standard', label: 'Standard' },
  { id: 'performance', label: 'Prestazione' },
];
const TYRE: { id: TyreMode; label: string }[] = [
  { id: 'conservative', label: 'Conserv.' },
  { id: 'balanced', label: 'Bilanciata' },
  { id: 'performance', label: 'Prestaz.' },
];

/**
 * Vista di gara. Due modi:
 *  - rivedere una gara già simulata (`data` completo);
 *  - gara in diretta (`live`): la simulazione avanza nel motore a pezzi, pochi secondi davanti a quello che si vede,
 *    e le strategie dei propri piloti (ritmo, carburante, gomme) si cambiano in corsa con effetto reale.
 */
export function RaceViewer({
  data: initial,
  onDone,
  live = false,
  startT,
}: {
  data: ReplayData;
  onDone: (final?: ReplayData | null) => void;
  live?: boolean;
  startT?: number;
}) {
  const [data, setData] = useState(initial);
  // Gara in diretta: fotogrammi ed eventi che arrivano dal motore, dati live dei piloti.
  const liveRef = useRef({
    frames: [...initial.frames],
    events: [...initial.events],
    riders: null as LiveRider[] | null,
    done: !live,
    pending: false,
  });
  const lv0 = liveRef.current;
  const vd: ReplayData = live && !lv0.done ? { ...data, frames: lv0.frames, events: lv0.events } : data;
  const fg = useRef<HTMLCanvasElement>(null);
  const prefs = usePrefs();
  const [cam, setCam] = useState<Cam>('mine');
  const [cam3d, setCam3d] = useState<Cam3D>('auto');
  const [no3d, setNo3d] = useState(() => !webglAvailable());
  const [mode3d, setMode3d] = useState(() => prefs.raceView === '3d' && webglAvailable());
  /** Schermata tempi al posto della pista (stesso istante di gara). */
  const [timingView, setTimingView] = useState(false);
  const rtRef = useRef<RaceTiming | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.riders.find((r) => r.mine)?.id ?? null,
  );
  const camRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const offRef = useRef<{ canvas: HTMLCanvasElement; view: View; w: number; h: number } | null>(null);
  // Zoom e spostamento manuali della mappa 2D (null = segue la telecamera scelta).
  const [manual, setManual] = useState<{ x: number; y: number; z: number } | null>(null);
  const viewRef = useRef<View | null>(null);
  const [speed, setSpeed] = useState<number>(8);
  const [t, setT] = useState(startT ?? -INTRO);
  const [, setTick] = useState(0);
  const tRef = useRef(startT ?? -INTRO);
  // In diretta la riproduzione non supera i fotogrammi già calcolati.
  const dur = live && !lv0.done ? Math.max(0, (lv0.frames.length - 1) * data.frameEvery - 0.5) : duration(vd);
  const L = data.lengthM;

  const teams = useMemo(() => teamsOf(data), [data]);
  const scene = useMemo(
    () =>
      buildScene(
        data.circuit,
        data.country,
        data.track.points,
        data.track.sectors,
        teams,
        data.track.longLap,
      ),
    [data, teams],
  );
  const lastDist = useMemo(() => lastDistances(vd), [data, Math.floor(vd.frames.length / 20)]);

  /** Chiede al motore i prossimi secondi di gara (pochi secondi davanti a quello che si vede). */
  const pull = (ahead: number) => {
    const L0 = liveRef.current;
    if (!live || L0.done || L0.pending) return;
    L0.pending = true;
    engine
      .liveAdvance(Math.max(0, tRef.current) + ahead, L0.frames.length, L0.events.length, tRef.current)
      .then(
        (c) => {
          L0.pending = false;
          if (!c) return;
          L0.frames.push(...c.frames);
          L0.events.push(...c.events);
          L0.riders = c.live;
          if (c.done) {
            L0.done = true;
            if (c.replay) setData(c.replay);
          }
          setTick((x) => (x + 1) % 1000);
        },
        () => {
          L0.pending = false;
        },
      );
  };

  // Ciclo di riproduzione (pubblico e bandiere si muovono anche in pausa). È lo stesso per 2D e 3D: cambiare
  // vista non lo ferma e non lo riavvia.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (live && !liveRef.current.done) {
        const avail = (liveRef.current.frames.length - 1) * data.frameEvery;
        if (avail - Math.max(0, tRef.current) < Math.max(4, speed * 1.5)) pull(Math.max(6, speed * 3));
      }
      const end =
        live && !liveRef.current.done
          ? Math.max(0, (liveRef.current.frames.length - 1) * data.frameEvery - 0.5)
          : dur;
      if (speed > 0 && tRef.current < end) {
        tRef.current = Math.min(end, tRef.current + dt * speed);
        setT(tRef.current);
      } else setTick((x) => (x + 1) % 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, dur]);

  // Gara in diretta: ogni secondo il motore riceve il punto che si sta guardando (per salvare e riprendere da lì).
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const L0 = liveRef.current;
      if (L0.done || L0.pending) return;
      L0.pending = true;
      engine.liveAdvance(Math.max(0, tRef.current), L0.frames.length, L0.events.length, tRef.current).then(
        (c) => {
          L0.pending = false;
          if (c && !c.done) {
            L0.frames.push(...c.frames);
            L0.events.push(...c.events);
            L0.riders = c.live;
          }
        },
        () => {
          L0.pending = false;
        },
      );
    }, 1000);
    return () => clearInterval(id);
  }, [live]);

  // Stato della gara in questo istante: una sola funzione per entrambe le viste.
  const f = raceFrame(vd, scene, teams, lastDist, t, selectedId);
  const { racing, dists, order, lap, avgSpeed, finished, phase, bikes, crashes, rain } = f;
  const leader = order[0]!;
  // Cronometraggio ai checkpoint, aggiornato con i fotogrammi arrivati (anche in diretta).
  if (!rtRef.current) rtRef.current = new RaceTiming(data);
  const rt = rtRef.current.update(vd.frames);
  const towerRows = timingView
    ? rt.rows(
        t,
        order.map((o) => o.i),
        new Set(order.filter((o) => racing && o.d < 0).map((o) => o.i)),
        new Set(
          vd.results
            .filter((x) => x.status === 'finished' && x.time !== null && t >= x.time)
            .map((x) => vd.riders.findIndex((r) => r.id === x.riderId)),
        ),
      )
    : [];

  // Autodromo disegnato una volta in alta risoluzione (fuori schermo): ogni fotogramma ne inquadra una parte.
  useEffect(() => {
    offRef.current = null;
  }, [scene]);

  // Elementi animati (vista 2D).
  useEffect(() => {
    if (mode3d) return;
    const c = fg.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth,
      h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ZMAX = 2.6;
    if (!offRef.current || offRef.current.w !== w || offRef.current.h !== h) {
      const oc = document.createElement('canvas');
      const ow = Math.round(w * ZMAX),
        oh = Math.round(h * ZMAX);
      oc.width = ow;
      oc.height = oh;
      const octx = oc.getContext('2d')!;
      const ov = fitView(scene, ow, oh);
      drawStatic(octx, scene, ov, ow, oh);
      offRef.current = { canvas: oc, view: ov, w, h };
    }
    const off = offRef.current;

    // Telecamera: zoom manuale, oppure tutto il circuito / pilota selezionato / leader, con movimento morbido.
    const full = fitView(scene, w, h);
    const fullC = { x: (w / 2 - full.ox) / full.scale, y: (h / 2 - full.oy) / full.scale, z: 1 };
    const targetBike =
      cam === 'mine'
        ? (bikes.find((x) => x.selected) ?? bikes.filter((x) => x.mine).at(-1))
        : cam === 'leader'
          ? bikes.find((x) => x.number === leader.r.number)
          : undefined;
    const goal = manual ?? (targetBike ? { x: targetBike.pos[0], y: targetBike.pos[1], z: 2.4 } : fullC);
    const c0 = camRef.current ?? goal;
    const k = manual ? 0.5 : 0.18;
    const camNow = {
      x: c0.x + (goal.x - c0.x) * k,
      y: c0.y + (goal.y - c0.y) * k,
      z: c0.z + (goal.z - c0.z) * k,
    };
    camRef.current = camNow;
    let view: View = {
      scale: full.scale * camNow.z,
      ox: w / 2 - camNow.x * full.scale * camNow.z,
      oy: h / 2 - camNow.y * full.scale * camNow.z,
    };
    // Porzione dell'autodromo inquadrata, tenuta dentro l'immagine (niente bordi vuoti).
    const ow = off.canvas.width,
      oh = off.canvas.height;
    const sw = Math.min(ow, (w / view.scale) * off.view.scale),
      sh = Math.min(oh, (h / view.scale) * off.view.scale);
    let sx = off.view.ox + (-view.ox / view.scale) * off.view.scale,
      sy = off.view.oy + (-view.oy / view.scale) * off.view.scale;
    sx = Math.max(0, Math.min(ow - sw, sx));
    sy = Math.max(0, Math.min(oh - sh, sy));
    view = {
      scale: view.scale,
      ox: -((sx - off.view.ox) / off.view.scale) * view.scale,
      oy: -((sy - off.view.oy) / off.view.scale) * view.scale,
    };
    viewRef.current = view;
    ctx.fillStyle = '#2c3a24';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(off.canvas, sx, sy, sw, sh, 0, 0, w, h);
    drawDynamic(ctx, scene, view, w, h, performance.now() / 1000, bikes, {
      rain,
      leaderNumber: racing ? leader.r.number : null,
      lap: racing ? `${lap}/${data.laps}` : 'GRID',
      crashes,
      chequered: f.chequered,
      yellow: f.yellow,
      red: f.redActive,
    });
  });

  // Interazioni sulla mappa 2D: rotella = zoom, trascina = sposta, clic = seleziona il pilota più vicino.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const toWorld = (ev: { clientX: number; clientY: number }) => {
    const c = fg.current!,
      v = viewRef.current!;
    const r = c.getBoundingClientRect();
    return [(ev.clientX - r.left - v.ox) / v.scale, (ev.clientY - r.top - v.oy) / v.scale] as const;
  };
  const cur = () => manual ?? camRef.current ?? { x: 0.5, y: 0.5, z: 1 };
  const onWheel = (ev: React.WheelEvent) => {
    if (!viewRef.current) return;
    const [wx, wy] = toWorld(ev);
    const c0 = cur();
    const z = Math.max(1, Math.min(2.6, c0.z * (ev.deltaY < 0 ? 1.2 : 1 / 1.2)));
    // Zoom verso il punto indicato dal mouse.
    const kz = 1 - c0.z / z;
    setManual({ x: c0.x + (wx - c0.x) * kz, y: c0.y + (wy - c0.y) * kz, z });
  };
  const onDown = (ev: React.PointerEvent) => {
    drag.current = { x: ev.clientX, y: ev.clientY, moved: false };
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !viewRef.current) return;
    const dx = ev.clientX - d.x,
      dy = ev.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    d.x = ev.clientX;
    d.y = ev.clientY;
    const c0 = cur();
    const sc = viewRef.current.scale;
    setManual({ x: c0.x - dx / sc, y: c0.y - dy / sc, z: c0.z });
  };
  const onUp = (ev: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !viewRef.current) return;
    const [wx, wy] = toWorld(ev);
    let best: { id: string; d: number } | null = null;
    for (const b of bikes) {
      const dd = Math.hypot(b.pos[0] - wx, b.pos[1] - wy) * viewRef.current.scale;
      if (dd < 22 && (!best || dd < best.d)) best = { id: b.id, d: dd };
    }
    if (best) setSelectedId(best.id);
  };
  const resetView = () => {
    setManual(null);
    setCam('all');
  };

  const pendingLL = (id: string) =>
    !racing
      ? 0
      : vd.events
          .filter((e) => e.riderId === id && e.t <= t)
          .reduce(
            (n, e) => n + (e.kind === 'longLapPenalty' ? (e.count ?? 1) : e.kind === 'longLap' ? -1 : 0),
            0,
          );
  const events = vd.events
    .filter((e) => racing && e.t <= t && e.kind !== 'fastestLap')
    .filter((e) => {
      const a = data.riders.find((r) => r.id === e.riderId);
      const b = data.riders.find((r) => r.id === e.otherId);
      if (e.kind === 'overtake') return a?.mine || b?.mine;
      if (e.kind === 'trackLimits') return a?.mine || (e.count ?? 0) >= (data.kind === 'sprint' ? 2 : 3);
      return true;
    })
    .slice(-6)
    .reverse();
  const name = (id: string | undefined) => data.riders.find((r) => r.id === id)?.name ?? '';
  const evText = (e: ReplayData['events'][number]) =>
    e.kind === 'overtake'
      ? `${name(e.riderId)} supera ${name(e.otherId)}`
      : e.kind === 'crash'
        ? `Caduta! ${name(e.riderId)} è fuori`
        : e.kind === 'remount'
          ? `${name(e.riderId)} scivola ma riparte`
          : e.kind === 'mechanical'
            ? `Guasto: ${name(e.riderId)} si ritira`
            : e.kind === 'trackLimits'
              ? `Limiti della pista: ${name(e.riderId)}, infrazione n. ${e.count}${
                  e.count === (data.kind === 'sprint' ? 2 : 3) ? ' (avviso)' : ''
                }`
              : e.kind === 'longLapPenalty'
                ? `${e.count === 2 ? 'Doppia Long Lap' : 'Long Lap'} Penalty per ${name(e.riderId)} (${
                    e.reason === 'jumpStart'
                      ? 'partenza anticipata'
                      : e.reason === 'contact'
                        ? 'contatto in sorpasso'
                        : 'limiti della pista'
                  }): va scontata entro 3 giri`
                : e.kind === 'longLap'
                  ? `${name(e.riderId)} sconta la Long Lap`
                  : e.kind === 'jumpStart'
                    ? `Partenza anticipata di ${name(e.riderId)}`
                    : e.kind === 'contact'
                      ? `Contatto: ${name(e.riderId)} tocca ${name(e.otherId)}`
                      : e.kind === 'positionDrop'
                        ? `${name(e.riderId)} oltre i limiti all'ultimo giro: perde una posizione`
                        : e.kind === 'yellowFlag'
                          ? `Bandiera gialla: vietato sorpassare nel tratto della caduta di ${name(e.riderId)}`
                          : e.kind === 'redFlag'
                            ? e.final
                              ? 'Bandiera rossa: gara conclusa, vale la classifica al momento dello stop'
                              : 'Bandiera rossa: gara interrotta, si riparte dalla griglia per i giri rimanenti'
                            : e.kind === 'restart'
                              ? 'Nuova partenza!'
                              : `Bandiera a scacchi: vince ${name(e.riderId)}`;

  // Dati live di un pilota in questo istante (tutti derivati dalla simulazione).
  const lapsDone = (n: number) => (racing ? Math.max(0, Math.floor(Math.max(0, dists[n]!) / L)) : 0);
  const liveOf = (id: string) => liveRef.current.riders?.find((x) => x.id === id) ?? null;
  const liveData = (n: number) => {
    const r = data.riders[n]!;
    const sim = liveOf(r.id);
    const done = Math.min(r.lapTimes.length, lapsDone(n));
    const progress = racing ? Math.min(1, Math.max(0, dists[n]!) / (data.laps * L)) : 0;
    const startFuel = data.fuelCapacity * (data.kind === 'sprint' ? 0.55 : 0.95);
    return {
      // In diretta: valori della simulazione; rivedendo una gara: dai giri registrati (carburante stimato).
      wear: sim ? sim.tyreWear : done > 0 ? r.wear[done - 1]! : 0,
      last: sim ? sim.lastLap : done > 0 ? r.lapTimes[done - 1]! : null,
      best: sim ? sim.bestLap : done > 1 ? Math.min(...r.lapTimes.slice(1, done)) : null,
      fuel: sim ? sim.fuel : Math.max(0.3, startFuel * (1 - progress) + 0.3 * progress),
      fuelLaps: sim ? sim.fuelLapsLeft : null,
      tyreTemp: sim ? sim.tyreTemp : null,
      fatigue: sim ? sim.fatigue : null,
      strategy: sim ? { mode: sim.mode, fuelMap: sim.fuelMap, tyreMode: sim.tyreMode } : null,
      pos: order.findIndex((o) => o.r.id === r.id) + 1,
    };
  };
  const setStrategy = async (
    riderId: string,
    change: { mode?: PaceMode; fuelMap?: FuelMap; tyreMode?: TyreMode },
  ) => {
    const L0 = liveRef.current;
    const cur = L0.riders?.find((x) => x.id === riderId);
    if (cur) Object.assign(cur, change); // subito visibile; il motore conferma col prossimo pezzo di gara
    setTick((x) => (x + 1) % 1000);
    try {
      await engine.dispatch({ type: 'SetRaceStrategy', riderId, ...change });
    } catch {
      /* gara finita nel frattempo */
    }
  };
  const lapsLeft = Math.max(0, data.laps - lap + 1);
  const TYRE_LETTER: Record<string, string> = { soft: 'S', medium: 'M', hard: 'H', wet: 'W' };
  const lastDirection = [...events].find((e) =>
    ['longLapPenalty', 'redFlag', 'yellowFlag', 'jumpStart', 'positionDrop', 'restart'].includes(e.kind),
  );
  const mineIdx = data.riders.map((r, i) => (r.mine ? i : -1)).filter((i) => i >= 0);

  return (
    <div className="race-viewer rv2">
      <aside className="rv-left">
        <div className="rv-left-head">
          <small>{data.categoryName}</small>
          <b>{data.circuit}</b>
          <span className="muted">
            Aria {data.weather.airTemp}° · asfalto {data.weather.trackTemp}°
            {data.weather.grip !== 'dry'
              ? ` · pista ${data.weather.grip === 'wet' ? 'bagnata' : 'umida'}`
              : ''}
          </span>
        </div>
        <ol className="rv-board">
          {order.map(({ r, d, i: n }, i) => {
            const out = racing && d < 0;
            const gap = i === 0 || out ? null : (leader.d - d) / avgSpeed;
            const lv = liveData(n);
            return (
              <li
                key={r.id}
                className={`${r.mine ? 'mine' : ''} ${out ? 'out' : ''} ${r.id === selectedId ? 'sel' : ''}`}
                onClick={() => setSelectedId(r.id)}
                title="Seleziona: le telecamere lo seguono"
              >
                <span className="p">{out ? '–' : i + 1}</span>
                <span className="c" style={{ background: r.color }} />
                <span className="num">{r.number}</span>
                <span className="n">
                  <Flag code={r.nationality} size={0.75} /> {r.name.split(' ').slice(-1)[0]}
                  {pendingLL(r.id) > 0 && (
                    <em className="llp" title="Long Lap Penalty da scontare">
                      LLP{pendingLL(r.id) > 1 ? `×${pendingLL(r.id)}` : ''}
                    </em>
                  )}
                  <small className="team">{r.team}</small>
                </span>
                <span className={`tyre-chip ${r.compound}`} title={`Gomma ${r.compound}`}>
                  {TYRE_LETTER[r.compound] ?? '?'}
                </span>
                <span className="g">
                  {!racing
                    ? 'griglia'
                    : out
                      ? 'rit.'
                      : i === 0
                        ? 'leader'
                        : leader.d - d > L
                          ? `+${Math.floor((leader.d - d) / L)} g`
                          : `+${gap!.toFixed(1)}`}
                  <small>{lv.last ? lapTime(lv.last) : ''}</small>
                </span>
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="rv-center">
        <div className={`rv-stage ${timingView ? 'timing' : ''}`}>
          {timingView ? (
            <TimingTower
              rows={towerRows}
              mode="race"
              totalLaps={data.laps}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : mode3d ? (
            <Fallback3D
              onFail={() => {
                setMode3d(false);
                setNo3d(true);
              }}
            >
              <Suspense fallback={<div className="loading">Preparo la vista 3D… la gara continua</div>}>
                <Race3D
                  scene={scene}
                  frame={f}
                  tier={data.tier}
                  cam={cam3d}
                  leaderNumber={racing ? leader.r.number : null}
                  quality={prefs.quality}
                />
              </Suspense>
            </Fallback3D>
          ) : (
            <>
              <canvas
                ref={fg}
                className="rv-canvas rv-top"
                aria-label="Circuito con le moto in pista: rotella per lo zoom, trascina per spostare, clic su una moto per selezionarla"
                onWheel={onWheel}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              />
              {manual && (
                <button className="btn rv-reset" onClick={resetView}>
                  Vista completa
                </button>
              )}
            </>
          )}
          <div className="rv-phase">
            <b className="display">{phase}</b>
            {lastDirection && (
              <span className={`rv-direction ${lastDirection.kind}`}>
                Direzione gara: {evText(lastDirection)}
              </span>
            )}
          </div>
        </div>
        <div className="rv-bar">
          <div className="rv-lap">
            <small>Giro</small>
            <b>
              {racing ? Math.min(lap, data.laps) : 0}
              <span>/{data.laps}</span>
            </b>
          </div>
          <div className="rv-speeds" role="group" aria-label="Velocità di riproduzione">
            {SPEEDS.map((v) => (
              <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>
                {v === 0 ? '❚❚' : `${v}×`}
              </button>
            ))}
          </div>
          <div className="rv-speeds" role="group" aria-label="Vista">
            <button
              className={!mode3d && !timingView ? 'on' : ''}
              onClick={() => {
                setMode3d(false);
                setTimingView(false);
              }}
            >
              2D
            </button>
            <button
              className={mode3d && !timingView ? 'on' : ''}
              disabled={no3d}
              title={no3d ? 'Il 3D non è disponibile su questo dispositivo: resta la vista 2D' : undefined}
              onClick={() => {
                setMode3d(true);
                setTimingView(false);
              }}
            >
              3D
            </button>
            <button className={timingView ? 'on' : ''} onClick={() => setTimingView(true)}>
              Tempi
            </button>
          </div>
          <div className="rv-speeds" role="group" aria-label="Inquadratura">
            {mode3d
              ? CAMS3D.map((c) => (
                  <button key={c.id} className={cam3d === c.id ? 'on' : ''} onClick={() => setCam3d(c.id)}>
                    {c.label}
                  </button>
                ))
              : CAMS.map((c) => (
                  <button
                    key={c.id}
                    className={cam === c.id && !manual ? 'on' : ''}
                    onClick={() => {
                      setManual(null);
                      setCam(c.id);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
          </div>
          <span className="muted rv-clock">{racing ? raceTime(t) : 'pre-gara'}</span>
          <span className="spacer" />
          {!racing && (
            <button
              className="btn"
              onClick={() => {
                tRef.current = 0;
                setT(0);
              }}
            >
              Vai al via
            </button>
          )}
          <button
            className="btn primary"
            onClick={async () => {
              if (live && !liveRef.current.done) {
                // Il resto della gara lo simula il motore con le strategie attuali (IA per gli avversari).
                await engine.dispatch({ type: 'FinishLiveRace' });
                onDone(await engine.replay());
              } else onDone(data);
            }}
          >
            {finished ? 'Vedi i risultati' : 'Salta alla fine'}
          </button>
        </div>
        <ul className="rv-feed" aria-live="polite">
          {!racing && <li className="muted">I piloti escono dai box per il giro di ricognizione.</li>}
          {racing && events.length === 0 && <li className="muted">Semaforo verde: si parte!</li>}
          {events.slice(0, 3).map((e, i) => (
            <li key={`${e.t}-${i}`} className={e.kind}>
              <span className="muted">Giro {Math.max(1, e.lap)}</span> {evText(e)}
            </li>
          ))}
        </ul>
      </div>

      <aside className="rv-right">
        {mineIdx.map((n) => {
          const r = data.riders[n]!;
          const lv = liveData(n);
          const out = racing && dists[n]! < 0;
          return (
            <div key={r.id} className="rv-rider" style={{ ['--team' as string]: r.color }}>
              <div className="rv-rider-head">
                <Portrait
                  portrait={r.portrait}
                  name={r.name}
                  size={3.6}
                  round
                  fallback={
                    <Helmet team={r.team} colors={{ primary: r.color, secondary: r.color2 }} size={3.8} />
                  }
                />
                <NumberPlate
                  number={r.number}
                  colors={{ primary: r.color, secondary: r.color2 }}
                  size={2.6}
                />
                <div className="rv-rider-name">
                  <small>
                    <Flag code={r.nationality} size={0.75} /> {r.name.split(' ')[0]}
                  </small>
                  <b>{r.name.split(' ').slice(1).join(' ')}</b>
                </div>
                <div className="rv-rider-pos">
                  <small>Pos.</small>
                  <b>{out ? 'rit.' : racing ? lv.pos : '–'}</b>
                </div>
              </div>
              <div className="rv-gauges">
                <Gauge
                  label="Gomma"
                  value={100 - lv.wear}
                  text={`${100 - lv.wear}%`}
                  sub={`${TYRE_LETTER[r.compound]} · usura ${lv.wear}%`}
                  tone={lv.wear >= 75 ? 'bad' : lv.wear >= 50 ? 'warn' : 'ok'}
                />
                <Gauge
                  label="Carburante"
                  value={(lv.fuel / data.fuelCapacity) * 100}
                  text={`${lv.fuel.toFixed(1).replace('.', ',')} L`}
                  sub={`su ${data.fuelCapacity} L`}
                  tone="info"
                />
              </div>
              <div className="rv-stat">
                <span>Affidabilità moto</span>
                <div className="bar">
                  <span
                    style={{
                      width: `${r.reliability}%`,
                      background: r.reliability >= 85 ? 'var(--ok)' : 'var(--warn)',
                    }}
                  />
                </div>
                <b>{r.reliability}%</b>
              </div>
              {lv.fuelLaps !== null && (
                <div className="rv-stat">
                  <span>Carburante per</span>
                  <b
                    className={lv.fuelLaps < lapsLeft ? 'bad' : lv.fuelLaps < lapsLeft + 0.6 ? 'warn' : 'ok'}
                  >
                    {lv.fuelLaps.toString().replace('.', ',')} giri
                    <small className="muted"> · ne mancano {lapsLeft}</small>
                  </b>
                </div>
              )}
              {lv.tyreTemp !== null && (
                <div className="rv-stat">
                  <span>Temperatura gomma</span>
                  <b className={lv.tyreTemp > 105 ? 'bad' : lv.tyreTemp < 85 ? 'info' : 'ok'}>
                    {lv.tyreTemp}°
                  </b>
                </div>
              )}
              {lv.fatigue !== null && (
                <div className="rv-stat">
                  <span>Fatica</span>
                  <b className={lv.fatigue > 70 ? 'bad' : lv.fatigue > 45 ? 'warn' : ''}>{lv.fatigue}%</b>
                </div>
              )}
              {lv.strategy && !out && !finished ? (
                <div className="rv-strategy" aria-label={`Strategia di ${r.name}`}>
                  {(
                    [
                      [`Ritmo · ${PACE.find((x) => x.id === lv.strategy!.mode)?.full}`, 'mode', PACE],
                      ['Carburante', 'fuelMap', FUEL],
                      ['Gomme', 'tyreMode', TYRE],
                    ] as const
                  ).map(([label, key, opts]) => (
                    <div key={key} className="rv-lever">
                      <small>{label}</small>
                      <div className="rv-speeds" role="group" aria-label={`${label} di ${r.name}`}>
                        {opts.map((o) => (
                          <button
                            key={o.id}
                            title={'full' in o ? o.full : o.label}
                            aria-label={'full' in o ? o.full : o.label}
                            className={lv.strategy![key] === o.id ? 'on' : ''}
                            onClick={() => setStrategy(r.id, { [key]: o.id })}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rv-stat">
                  <span>Ritmo</span>
                  <b className="rv-mode">{PACE.find((x) => x.id === (lv.strategy?.mode ?? r.mode))?.full}</b>
                </div>
              )}
              <div className="rv-stat">
                <span>Ultimo giro</span>
                <b>{lv.last ? lapTime(lv.last) : '—'}</b>
              </div>
              <div className="rv-stat">
                <span>Miglior giro</span>
                <b>{lv.best ? lapTime(lv.best) : '—'}</b>
              </div>
            </div>
          );
        })}
        {mineIdx.length === 0 && <p className="muted">Nessun tuo pilota in questa gara.</p>}
        <p className="muted rv-note">
          {live && !liveRef.current.done
            ? 'Gara in diretta: ogni cambio di ritmo, carburante o gomme vale dai metri successivi.'
            : 'Gara conclusa: qui la stai rivedendo.'}
        </p>
      </aside>
    </div>
  );
}

function Gauge({
  label,
  value,
  text,
  sub,
  tone,
}: {
  label: string;
  value: number;
  text: string;
  sub: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
}) {
  const r = 26,
    c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="gauge">
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={`var(--${tone})`}
          strokeWidth="7"
          strokeDasharray={`${(c * v) / 100} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div>
        <small>{label}</small>
        <b>{text}</b>
        <span>{sub}</span>
      </div>
    </div>
  );
}
