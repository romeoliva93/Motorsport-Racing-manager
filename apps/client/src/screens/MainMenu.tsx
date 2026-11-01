import { useEffect, useState } from 'react';
import type { SaveMeta } from '@lean-angle/persistence';
import { engine } from '../engine/engine.ts';
import type { AppScreen } from '../App.tsx';
import './menu.css';

const TRACK =
  'M120 470 L520 470 C600 470 640 440 660 400 L700 320 C720 280 760 270 800 290 L880 330 C930 355 950 320 930 280 L860 150 C840 110 800 95 760 110 L560 180 C520 195 490 180 470 150 L430 95 C405 60 360 55 330 80 L180 200 C150 225 160 260 195 270 L330 300 C370 310 375 350 340 365 L130 400 C80 410 70 470 120 470 Z';

export function MainMenu({ go }: { go: (s: AppScreen) => void }) {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    engine.listSaves().then(setSaves, (e: Error) => setError(e.message));
  }, []);
  const last = saves?.[0];

  async function continueLast() {
    if (!last) return;
    try {
      await engine.load(last.slot);
      go({ name: 'game', slot: last.slot });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="menu-stage">
      <div className="menu-grid" />
      <svg className="menu-track" viewBox="0 0 1000 620" aria-hidden>
        <defs>
          <linearGradient id="mg" x1="0" x2="1">
            <stop offset="0" stopColor="#e5322d" />
            <stop offset="1" stopColor="#ff7a1a" />
          </linearGradient>
        </defs>
        <path id="trk" className="base" d={TRACK} />
        <path className="line" d={TRACK} />
        <circle r="7" fill="#ff7a1a">
          <animateMotion dur="9s" repeatCount="indefinite">
            <mpath href="#trk" />
          </animateMotion>
        </circle>
        <circle r="6" fill="#e5322d">
          <animateMotion dur="9.4s" begin="-0.5s" repeatCount="indefinite">
            <mpath href="#trk" />
          </animateMotion>
        </circle>
      </svg>
      <div className="menu-left">
        <div className="brand">
          <div className="kicker">Velocity World Championship</div>
          <h1>
            Lean
            <br />
            <span>Angle</span>
          </h1>
          <p>Moto Racing Manager</p>
        </div>
        {last && (
          <div className="continue-card">
            <div>
              <div className="nm">{last.teamName ?? last.saveName}</div>
              <div className="muted" style={{ fontSize: '.8rem' }}>
                {last.saveName} · {last.gameDate} · salvato {new Date(last.savedAt).toLocaleString('it-IT')}
              </div>
            </div>
          </div>
        )}
        <nav className="menu-nav">
          {last && (
            <button className="item primary" onClick={continueLast}>
              Continua carriera <small>{last.slot}</small>
            </button>
          )}
          <button className={`item ${last ? '' : 'primary'}`} onClick={() => go({ name: 'newCareer' })}>
            Nuova carriera <small>Squadra esistente</small>
          </button>
          <button
            className="item"
            disabled={!saves || saves.length === 0}
            onClick={() => go({ name: 'load' })}
          >
            Carica partita <small>{saves ? `${saves.length} salvataggi` : '…'}</small>
          </button>
          <button className="item" disabled>
            Crea la tua squadra <span className="soon">In sviluppo</span>
          </button>
          <button className="item" disabled>
            Impostazioni <span className="soon">In sviluppo</span>
          </button>
        </nav>
        {error && <div className="bad">{error}</div>}
      </div>
      <footer className="menu-foot">Fase 1 — fondamenta · universo, nomi e marchi originali</footer>
    </div>
  );
}
