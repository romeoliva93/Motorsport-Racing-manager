import { Flag } from '../../design-system/Flag.tsx';
import { useState } from 'react';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Pos, Tabs } from '../../design-system/components.tsx';

type View = 'riders' | 'teams' | 'constructors' | 'independent' | 'races';

export function ChampionshipScreen({ categoryId }: { categoryId: string }) {
  const [cat, setCat] = useState(categoryId);
  const [view, setView] = useState<View>('riders');
  const cats = useQuery('categories');
  const q = useQuery('championship', cat);
  const c = q.status === 'ready' ? q.data : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {cats.status === 'ready' && (
          <Tabs
            value={cat}
            options={cats.data.map((x) => ({ id: x.id as string, label: x.name }))}
            onChange={setCat}
          />
        )}
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { id: 'riders', label: 'Piloti' },
            { id: 'teams', label: 'Team' },
            { id: 'constructors', label: 'Scuderie (costruttori)' },
            { id: 'independent', label: 'Indipendenti' },
            { id: 'races', label: 'Gare' },
          ]}
        />
      </div>
      {!c ? (
        <div className="loading">Caricamento…</div>
      ) : (
        <>
          <Explain>
            {c.category} {c.year}: {c.racesDone} gare disputate su {c.racesTotal}. A ogni gara i primi 15
            prendono punti (25 al vincitore); in MotoGP anche la Sprint del sabato dà punti ai primi 9 (12 al
            vincitore). Vittorie e podi contano solo la gara della domenica. Chi ha più punti a fine anno è
            campione. La classifica team somma i punti dei due piloti; quella delle scuderie (costruttori)
            conta solo il miglior pilota di ogni marca in ogni gara.
          </Explain>
          {view === 'riders' && (
            <Card title="Classifica piloti">
              <table className="std static">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Pilota</th>
                    <th>Squadra</th>
                    <th className="r">Vittorie</th>
                    <th className="r">
                      Podi<Help>Arrivi nei primi tre nella gara della domenica.</Help>
                    </th>
                    <th className="r">
                      Pole<Help>Primo posto nella griglia di partenza.</Help>
                    </th>
                    <th className="r">
                      Giri veloci<Help>Miglior giro della gara. È una statistica: non assegna punti.</Help>
                    </th>
                    <th className="r">Punti</th>
                  </tr>
                </thead>
                <tbody>
                  {c.riders.map((r, i) => (
                    <tr key={r.riderId} className={r.teamId === c.myTeamId ? 'mine' : ''}>
                      <td>
                        <Pos value={i + 1} />
                      </td>
                      <td>
                        <span className="swatch" style={{ background: r.color }} />
                        <Flag code={r.nationality} size={0.85} /> <b>{r.name}</b>
                      </td>
                      <td className="t2">{r.team}</td>
                      <td className="r">{r.wins || '—'}</td>
                      <td className="r">{r.podiums || '—'}</td>
                      <td className="r">{r.poles || '—'}</td>
                      <td className="r">{r.fastestLaps || '—'}</td>
                      <td className="r">
                        <b>{r.points}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.riders.length === 0 && <p className="muted">Nessuna gara ancora disputata.</p>}
            </Card>
          )}
          {view === 'teams' && (
            <Card title="Classifica team">
              <table className="std static">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Squadra</th>
                    <th className="r">Vittorie</th>
                    <th className="r">Punti</th>
                  </tr>
                </thead>
                <tbody>
                  {c.teams.map((t, i) => (
                    <tr key={t.teamId} className={t.teamId === c.myTeamId ? 'mine' : ''}>
                      <td>
                        <Pos value={i + 1} />
                      </td>
                      <td>
                        <span className="swatch" style={{ background: t.color }} />
                        <b>{t.team}</b>
                      </td>
                      <td className="r">{t.wins || '—'}</td>
                      <td className="r">
                        <b>{t.points}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.teams.length === 0 && <p className="muted">Nessuna gara ancora disputata.</p>}
            </Card>
          )}
          {view === 'constructors' && (
            <Card title="Classifica scuderie (costruttori)">
              <table className="std static">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Costruttore</th>
                    <th className="r">Vittorie</th>
                    <th className="r">Punti</th>
                  </tr>
                </thead>
                <tbody>
                  {c.constructors.map((m, i) => (
                    <tr key={m.manufacturerId}>
                      <td>
                        <Pos value={i + 1} />
                      </td>
                      <td>
                        <b>{m.name}</b>
                      </td>
                      <td className="r">{m.wins || '—'}</td>
                      <td className="r">
                        <b>{m.points}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.constructors.length === 0 && <p className="muted">Nessuna gara ancora disputata.</p>}
            </Card>
          )}
          {view === 'independent' && (
            <div className="grid12">
              <Card title="Miglior pilota indipendente" aside="squadre non ufficiali" className="s6">
                <table className="std static">
                  <tbody>
                    {c.independentRiders.map((r, i) => (
                      <tr key={r.riderId} className={r.teamId === c.myTeamId ? 'mine' : ''}>
                        <td style={{ width: '2.6rem' }}>
                          <Pos value={i + 1} />
                        </td>
                        <td>
                          <span className="swatch" style={{ background: r.color }} />
                          <Flag code={r.nationality} size={0.85} /> <b>{r.name}</b>
                        </td>
                        <td className="t2">{r.team}</td>
                        <td className="r">
                          <b>{r.points}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="Miglior squadra indipendente" className="s6">
                <table className="std static">
                  <tbody>
                    {c.independentTeams.map((t, i) => (
                      <tr key={t.teamId} className={t.teamId === c.myTeamId ? 'mine' : ''}>
                        <td style={{ width: '2.6rem' }}>
                          <Pos value={i + 1} />
                        </td>
                        <td>
                          <span className="swatch" style={{ background: t.color }} />
                          <b>{t.team}</b>
                        </td>
                        <td className="r">
                          <b>{t.points}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
          {view === 'races' && (
            <Card title="Gare della stagione">
              <table className="std static">
                <thead>
                  <tr>
                    <th>GP</th>
                    <th>Circuito</th>
                    <th>Vincitore</th>
                  </tr>
                </thead>
                <tbody>
                  {c.races.map((r) => (
                    <tr key={r.number}>
                      <td>{r.number}</td>
                      <td>{r.circuit}</td>
                      <td className={r.done ? '' : 'muted'}>{r.done ? (r.winner ?? '—') : 'da correre'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
