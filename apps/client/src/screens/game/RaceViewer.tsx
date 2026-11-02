import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReplayData } from '@lean-angle/game';
import { Flag } from '../../design-system/Flag.tsx';
import { raceTime } from '../../design-system/components.tsx';
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

  // Elementi animati.
  useEffect(() => {
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
    drawDynamic(ctx, scene, view, w, h, performance.now() / 1000, bikes, {
      rain: data.weather.grip === 'wet' ? 1 : data.weather.sky === 'drizzle' ? 0.45 : 0,
      leaderNumber: racing ? leader.r.number : null,
      lap: racing ? `${lap}/${data.laps}` : 'GRID',
      crashes,
      chequered: !!winnerEvent && t >= winnerEvent.t,
      yellow: racing
        ? data.events
            .filter((e) => e.kind === 'yellowFlag' && e.t <= t && t < e.t + (e.duration ?? 0))
            .map((e) => e.at ?? 0)
        : [],
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

  return (
    <div className="race-viewer">
      <div className="rv-head">
        <div>
          <small className="muted">
            {data.categoryName} · {data.circuit} · aria {data.weather.airTemp}° · asfalto{' '}
            {data.weather.trackTemp}°
          </small>
          <b className="display">{phase}</b>
        </div>
        <div className="rv-speeds" role="group" aria-label="Velocità di riproduzione">
          {SPEEDS.map((v) => (
            <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)}>
              {v === 0 ? '❚❚' : `${v}×`}
            </button>
          ))}
        </div>
        <div className="rv-speeds" role="group" aria-label="Inquadratura">
          {CAMS.map((c) => (
            <button key={c.id} className={cam === c.id ? 'on' : ''} onClick={() => setCam(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <span className="muted rv-clock">{racing ? raceTime(t) : 'pre-gara'}</span>
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
      <div className="rv-body">
        <div className="rv-stage">
          <canvas ref={fg} className="rv-canvas rv-top" aria-label="Circuito con le moto in pista" />
        </div>
        <ol className="rv-board">
          {order.map(({ r, d }, i) => {
            const out = racing && d < 0;
            const gap = i === 0 || out ? null : (leader.d - d) / avgSpeed;
            return (
              <li key={r.id} className={`${r.mine ? 'mine' : ''} ${out ? 'out' : ''}`}>
                <span className="p">{out ? '–' : i + 1}</span>
                <span className="c" style={{ background: r.color }} />
                <span className="n">
                  <Flag code={r.nationality} size={0.75} /> {r.name}
                  {pendingLL(r.id) > 0 && (
                    <em className="llp" title="Long Lap Penalty da scontare">
                      LLP{pendingLL(r.id) > 1 ? `×${pendingLL(r.id)}` : ''}
                    </em>
                  )}
                </span>
                <span className="g">
                  {!racing
                    ? 'griglia'
                    : out
                      ? 'ritirato'
                      : i === 0
                        ? 'leader'
                        : leader.d - d > L
                          ? `+${Math.floor((leader.d - d) / L)} giro`
                          : `+${gap!.toFixed(1)}s`}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ul className="rv-feed" aria-live="polite">
        {!racing && <li className="muted">I piloti escono dai box per il giro di ricognizione.</li>}
        {racing && events.length === 0 && <li className="muted">Semaforo verde: si parte!</li>}
        {events.map((e, i) => (
          <li key={`${e.t}-${i}`} className={e.kind}>
            <span className="muted">Giro {Math.max(1, e.lap)}</span> {evText(e)}
          </li>
        ))}
      </ul>
    </div>
  );
}
