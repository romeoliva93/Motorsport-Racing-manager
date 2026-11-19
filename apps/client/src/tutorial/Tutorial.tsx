/**
 * Tutorial a passi. Dentro una carriera "Mostrami" apre la schermata del passo e riduce la guida a una barra
 * in basso, da cui si riprende. Si apre da solo alla prima carriera; poi dal pulsante "Guida".
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Section } from '../shell/Shell.tsx';
import { TUTORIAL } from './steps.ts';
import logo from '../assets/brand/logo.webp';
import './tutorial.css';

export function Tutorial(props: Parameters<typeof TutorialPanel>[0]) {
  // Sul body: fuori dalla griglia dell'app, che rende relative i suoi figli diretti.
  return createPortal(<TutorialPanel {...props} />, document.body);
}

function TutorialPanel({
  onClose,
  go,
  start = 0,
}: {
  onClose: () => void;
  /** Solo dentro una carriera: apre la schermata del passo. */
  go?: (s: Section) => void;
  start?: number;
}) {
  const [i, setI] = useState(start);
  const [mini, setMini] = useState(false);
  const step = TUTORIAL[i]!;
  const last = i === TUTORIAL.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mini) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(TUTORIAL.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mini, onClose]);

  if (mini)
    return (
      <div className="tut-mini" role="status">
        <span>
          Guida · passo {i + 1} di {TUTORIAL.length}: <b>{step.title}</b>
        </span>
        <button className="btn primary" onClick={() => setMini(false)}>
          Riprendi la guida
        </button>
        <button className="btn ghost" onClick={onClose}>
          Chiudi
        </button>
      </div>
    );

  return (
    <div className="tut-backdrop" role="dialog" aria-modal="true" aria-label="Guida al gioco">
      <div className="tut">
        <aside className="tut-index">
          <img src={logo} alt="Motorcycle Racing Manager" className="tut-logo" />
          <ol>
            {TUTORIAL.map((s, k) => (
              <li key={s.id}>
                <button className={k === i ? 'on' : k < i ? 'done' : ''} onClick={() => setI(k)}>
                  <span>{k + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <section className="tut-body">
          <small className="muted">
            Guida · passo {i + 1} di {TUTORIAL.length}
          </small>
          <h2>{step.title}</h2>
          <p className="tut-intro">{step.intro}</p>
          <ul>
            {step.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {step.tip && <p className="tut-tip">{step.tip}</p>}
          <div className="tut-progress" aria-hidden>
            <i style={{ width: `${((i + 1) / TUTORIAL.length) * 100}%` }} />
          </div>
          <div className="tut-actions">
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
              ◂ Indietro
            </button>
            {go && step.section && (
              <button
                className="btn"
                onClick={() => {
                  go(step.section!);
                  setMini(true);
                }}
              >
                Mostrami
              </button>
            )}
            <span className="spacer" />
            <button className="btn ghost" onClick={onClose}>
              {last ? 'Chiudi' : 'Salta la guida'}
            </button>
            {last ? (
              <button className="btn primary" onClick={onClose}>
                Inizia a giocare
              </button>
            ) : (
              <button className="btn primary" onClick={() => setI(i + 1)}>
                Avanti ▸
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
