import { useEffect, useState } from 'react';
import type { SaveMeta } from '@lean-angle/persistence';
import { engine } from '../engine/engine.ts';
import type { AppScreen } from '../App.tsx';
import { Card } from '../design-system/components.tsx';

export function LoadGame({ go }: { go: (s: AppScreen) => void }) {
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Slot in attesa di conferma dell'eliminazione (conferma nella pagina, non con finestre del browser). */
  const [confirming, setConfirming] = useState<string | null>(null);
  const refresh = () => engine.listSaves().then(setSaves, (e: Error) => setError(e.message));
  useEffect(() => void refresh(), []);

  async function load(slot: string) {
    try {
      await engine.load(slot);
      go({ name: 'game', slot });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(slot: string) {
    if (confirming !== slot) {
      setConfirming(slot);
      return;
    }
    setConfirming(null);
    await engine.deleteSave(slot);
    await refresh();
  }

  return (
    <div style={{ padding: '3rem 6vw', maxWidth: 1100 }}>
      <button className="btn ghost" onClick={() => go({ name: 'menu' })}>
        ◂ Menu principale
      </button>
      <h1 className="display" style={{ fontSize: '2.4rem', margin: '1.2rem 0' }}>
        Carica partita
      </h1>
      <Card title="Salvataggi" aside={`${saves.length} slot`}>
        <table className="std">
          <thead>
            <tr>
              <th>Slot</th>
              <th>Carriera</th>
              <th>Squadra</th>
              <th>Data di gioco</th>
              <th>Salvato</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {saves.map((s) => (
              <tr key={s.slot} onClick={() => load(s.slot)}>
                <td>{s.slot}</td>
                <td>{s.saveName}</td>
                <td>{s.teamName ?? '—'}</td>
                <td>{s.gameDate}</td>
                <td className="muted">{new Date(s.savedAt).toLocaleString('it-IT')}</td>
                <td className="r">
                  <button
                    className="btn ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(s.slot);
                    }}
                  >
                    {confirming === s.slot ? 'Conferma eliminazione' : 'Elimina'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {error && <p className="bad">{error}</p>}
    </div>
  );
}
