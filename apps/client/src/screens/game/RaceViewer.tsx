import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { ReplayData } from '@lean-angle/game';
import { Flag } from '../../design-system/Flag.tsx';
import { lapTime, raceTime } from '../../design-system/components.tsx';
import { Portrait } from '../../design-system/Portrait.tsx';
import { Helmet } from '../../design-system/Helmet.tsx';
import { NumberPlate } from '../../design-system/NumberPlate.tsx';
import {
  buildScene,
  drawDynamic,
  drawStatic,
  fitView,
  type View,
  onLongLap,
  onPitLane,
  onTrack,
  type BikeDraw,
  type V,
} from '../../race/circuitScene.ts';

const SPEEDS = [0, 1, 2, 4, 8, 16] as const;
/** Vista 3D caricata solo quando richiesta (Three.js). */
const Race3D = lazy(() => import('../../race/Race3D.tsx'));
type Cam = 'all' | 'mine' | 'leader';
const CAMS: { id: Cam; label: string }[] = [
  { id: 'all', label: 'Tutto il circuito' },
  { id: 'mine', label: 'Il mio pilota' },
  { id: 'leader', label: 'Il leader' },
];
/** Secondi (tempo di gara) della fase box: uscita dai garage, corsia box, giro di ricognizione, griglia. */
const INTRO = 45;

/**
 * Vista 2D dall'alto della gara. Riproduce i fotogrammi registrati dalla simulazione (la gara è già stata
 * calcolata dal motore: qui la si guarda, alla velocità scelta). Fra due fotogrammi la posizione è interpolata.
 * Prima del via le moto escono dai box, percorrono la corsia box e il giro di ricognizione e si fermano nella
 * casella di griglia calcolata dalla simulazione.
 */
export function RaceViewer({ data, onDone }: { data: ReplayData; onDone: () => void }) {
  const fg = useRef<HTMLCanvasElement>(null);
  const [cam, setCam] = useState<Cam>('mine');
  const [mode3d, setMode3d] = useState(false);
  const camRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const offRef = useRef<{ canvas: HTMLCanvasElement; view: View; w: number; h: number } | null>(null);
  const [speed, setSpeed] = useState<number>(8);
  const [t, setT] = useState(-INTRO);
  const [, setTick] = useState(0);
  const tRef = useRef(-INTRO);
  const duration = (data.frames.length - 1) * data.frameEvery;
  const L = data.lengthM;

  const teams = useMemo(() => {
    const seen = new Map<string, { team: string; color: string; color2: string }>();
    for (const r of data.riders)
      if (!seen.has(r.team)) seen.set(r.team, { team: r.team, color: r.color, color2: r.color2 });
    return [...seen.values()];
  }, [data]);
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

  const distAt = (time: number): number[] => {
    const f = Math.max(0, time) / data.frameEvery;
    const i = Math.max(0, Math.min(data.frames.length - 1, Math.floor(f)));
    const j = Math.min(data.frames.length - 1, i + 1);
    const a = data.frames[i]!,
      b = data.frames[j]!;
    const k = f - i;
    return a.map((d, n) => (d < 0 || b[n]! < 0 ? (d < 0 ? -1 : d) : d + (b[n]! - d) * k));
  };
  // Ultima distanza nota di ogni pilota prima del ritiro (per la moto caduta nella ghiaia).
  const lastDist = useMemo(
    () =>
      data.riders.map((_, n) => {
        let last = 0;
        for (const fr of data.frames) {
          if (fr[n]! < 0) break;
          last = fr[n]!;
        }
        return last;
      }),
    [data],
  );

  // Ciclo di riproduzione (pubblico e bandiere si muovono anche in pausa).
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (speed > 0 && tRef.current < duration) {
        tRef.current = Math.min(duration, tRef.current + dt * speed);
        setT(tRef.current);
      } else setTick((x) => (x + 1) % 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed, duration]);

  const racing = t >= 0;
  const dists = distAt(t);
  const order = data.riders
    .map((r, i) => ({ r, d: racing ? dists[i]! : data.frames[0]![i]!, i }))
    .sort((a, b) => (racing && a.d < 0 ? 1 : racing && b.d < 0 ? -1 : b.d - a.d));
  const leader = order[0]!;
  const lap = Math.min(data.laps, Math.floor(Math.max(0, leader.d) / L) + 1);
  const avgSpeed = L / ((data.results[0]?.time ?? duration) / data.laps);
  const finished = t >= duration;
  const winnerEvent = data.events.find((e) => e.kind === 'finish');
  const redEvent = data.events.find((e) => e.kind === 'redFlag');
  const restartEvent = data.events.find((e) => e.kind === 'restart');
  const redActive =
    racing &&
    !!redEvent &&
    t >= redEvent.t &&
    (redEvent.final ? t < redEvent.t + 8 : !!restartEvent && t < restartEvent.t);
  const phase = !racing
    ? t < -INTRO + 14
      ? 'Uscita dai box'
      : t < -3
        ? 'Giro di ricognizione'
        : 'Semaforo rosso…'
    : redActive
      ? 'Bandiera rossa'
      : finished
        ? 'Gara finita'
        : `Giro ${lap} di ${data.laps}`;

  // Autodromo disegnato una volta in alta risoluzione (fuori schermo): ogni fotogramma ne inquadra una parte.
  useEffect(() => {
    offRef.current = null;
  }, [scene]);

  // Posizione di ogni moto in questo istante (la stessa per la vista 2D e per quella 3D).
  const nG = scene.garages.length;
  const span = scene.pitLane.length - 1;
  const exitFrac = scene.pitExitIdx / scene.pts.length;
  const posLabel = new Map(order.map((o, k) => [o.r.id, k + 1]));
  const bikes: BikeDraw[] = [];
  data.riders.forEach((r, i) => {
    const lateral = ((i % 3) - 1) * scene.width * 0.28;
    let pd: { pos: V; dir: V } | null = null;
    if (!racing) {
      // Fase box: garage → corsia box → giro di ricognizione → casella di griglia.
      const g = Math.max(
        0,
        teams.findIndex((x) => x.team === r.team),
      );
      const fGarage = (scene.pitBoxStart + ((g + 0.5) / nG) * (scene.pitBoxEnd - scene.pitBoxStart)) / span;
      const gridFrac = 1 + data.frames[0]![i]! / L; // poco prima del traguardo
      const leave = -INTRO + 1 + i * 0.55;
      const tPit = (1 - fGarage) * 10;
      const arrive = -4;
      if (t < leave) {
        const gr = scene.garages[g]!;
        pd = {
          pos: [gr.at[0] + gr.dir[0] * 0.004, gr.at[1] + gr.dir[1] * 0.004],
          dir: [-gr.dir[0], -gr.dir[1]],
        };
      } else if (t < leave + tPit) {
        pd = onPitLane(scene, fGarage + ((t - leave) / tPit) * (1 - fGarage));
      } else if (t < arrive) {
        const k = (t - leave - tPit) / (arrive - leave - tPit);
        const e = k * k * (3 - 2 * k);
        pd = onTrack(scene, exitFrac + e * (gridFrac - exitFrac), lateral * e);
      } else pd = onTrack(scene, gridFrac, ((i % 2) - 0.5) * scene.width * 0.5);
    } else {
      const d = dists[i]!;
      // Nell'anello della Long Lap?
      const ll = data.events.find(
        (e) => e.kind === 'longLap' && e.riderId === r.id && e.t <= t && t < e.t + (e.duration ?? 0),
      );
      if (ll && d >= 0) pd = onLongLap(scene, (t - ll.t) / (ll.duration ?? 1));
      else if (d >= 0) pd = onTrack(scene, d / L, lateral);
    }
    if (!pd) return;
    const pos = posLabel.get(r.id) ?? 0;
    bikes.push({
      ...pd,
      color: r.color,
      color2: r.color2,
      number: r.number,
      mine: r.mine,
      label: r.mine || (racing && pos <= 3) ? `${racing ? `${pos}. ` : ''}${r.short}` : null,
    });
  });
  bikes.sort((a, b) => Number(a.mine) - Number(b.mine));
  const crashes: V[] = racing
    ? data.events
        .filter((e) => e.kind === 'crash' && e.t <= t)
        .map((e) => {
          const n = data.riders.findIndex((r) => r.id === e.riderId);
          const frac = lastDist[n]! / L;
          const i = Math.floor((((frac % 1) + 1) % 1) * scene.pts.length) % scene.pts.length;
          const side = scene.curv[i]! > 0 ? -1 : 1;
          return onTrack(scene, frac, (scene.width / 2 + 0.014) * side).pos;
        })
    : [];
  const yellowNow = racing
    ? data.events
        .filter((e) => e.kind === 'yellowFlag' && e.t <= t && t < e.t + (e.duration ?? 0))
        .map((e) => e.at ?? 0)
    : [];

  const rain = data.weather.grip === 'wet' ? 1 : data.weather.sky === 'drizzle' ? 0.45 : 0;

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

    // Telecamera: tutto il circuito, il mio pilota o il leader, con movimento morbido.
    const full = fitView(scene, w, h);
    const fullC = { x: (w / 2 - full.ox) / full.scale, y: (h / 2 - full.oy) / full.scale, z: 1 };
    const targetBike =
      cam === 'mine'
        ? bikes.filter((x) => x.mine).at(-1)
        : cam === 'leader'
          ? bikes.find((x) => x.number === leader.r.number)
          : undefined;
    const goal = targetBike ? { x: targetBike.pos[0], y: targetBike.pos[1], z: 2.4 } : fullC;
    const c0 = camRef.current ?? goal;
    const k = 0.18;
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
    ctx.fillStyle = '#2c3a24';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(off.canvas, sx, sy, sw, sh, 0, 0, w, h);
    drawDynamic(ctx, scene, view, w, h, performance.now() / 1000, bikes, {
      rain,
      leaderNumber: racing ? leader.r.number : null,
      lap: racing ? `${lap}/${data.laps}` : 'GRID',
      crashes,
      chequered: !!winnerEvent && t >= winnerEvent.t,
      yellow: yellowNow,
      red: redActive,
    });
  });

  const pendingLL = (id: string) =>
    !racing
      ? 0
      : data.events
          .filter((e) => e.riderId === id && e.t <= t)
          .reduce(
            (n, e) => n + (e.kind === 'longLapPenalty' ? (e.count ?? 1) : e.kind === 'longLap' ? -1 : 0),
            0,
          );
  const events = data.events
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
  const live = (n: number) => {
    const r = data.riders[n]!;
    const done = Math.min(r.lapTimes.length, lapsDone(n));
    const progress = racing ? Math.min(1, Math.max(0, dists[n]!) / (data.laps * L)) : 0;
    const startFuel = data.fuelCapacity * (data.kind === 'sprint' ? 0.55 : 0.95);
    const fuel = Math.max(0.3, startFuel * (1 - progress) + 0.3 * progress);
    return {
      wear: done > 0 ? r.wear[done - 1]! : 0,
      last: done > 0 ? r.lapTimes[done - 1]! : null,
      best: done > 1 ? Math.min(...r.lapTimes.slice(1, done)) : null,
      fuel,
      pos: order.findIndex((o) => o.r.id === r.id) + 1,
    };
  };
  const TYRE_LETTER: Record<string, string> = { soft: 'S', medium: 'M', hard: 'H', wet: 'W' };
  const MODE_LABEL: Record<string, string> = {
    conservative: 'Prudente',
    normal: 'Normale',
    attack: 'Attacco',
  };
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
            const lv = live(n);
            return (
              <li key={r.id} className={`${r.mine ? 'mine' : ''} ${out ? 'out' : ''}`}>
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
        <div className="rv-stage">
          {mode3d ? (
            <Suspense fallback={<div className="loading">Preparo la vista 3D…</div>}>
              <Race3D
                scene={scene}
                bikes={bikes}
                cam={cam}
                leaderNumber={racing ? leader.r.number : null}
                rain={rain}
                crashes={crashes}
              />
            </Suspense>
          ) : (
            <canvas ref={fg} className="rv-canvas rv-top" aria-label="Circuito con le moto in pista" />
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
            <button className={!mode3d ? 'on' : ''} onClick={() => setMode3d(false)}>
              2D
            </button>
            <button className={mode3d ? 'on' : ''} onClick={() => setMode3d(true)}>
              3D
            </button>
          </div>
          <div className="rv-speeds" role="group" aria-label="Inquadratura">
            {CAMS.map((c) => (
              <button key={c.id} className={cam === c.id ? 'on' : ''} onClick={() => setCam(c.id)}>
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
          <button className="btn primary" onClick={onDone}>
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
          const lv = live(n);
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
              <div className="rv-stat">
                <span>Ritmo</span>
                <b className="rv-mode">{MODE_LABEL[r.mode] ?? r.mode}</b>
              </div>
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
          Ritmo e mappa carburante modificabili durante la gara: prossima milestone (oggi si scelgono prima
          del via).
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
