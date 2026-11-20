/**
 * Schermata tempi (live timing): una riga per pilota, celle dei 4 settori con il tempo cumulato del giro.
 * La cella del settore in corso si riempie mentre il pilota avanza; al checkpoint si colora:
 * rosso = miglior settore assoluto, arancio = miglior settore personale, grigio = più lento.
 */
import { fmtGap, fmtLap, type TimingRow } from './timing.ts';
import './timing.css';

const TYRE: Record<string, string> = { soft: 'S', medium: 'M', hard: 'H', wet: 'W' };

function ink(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#111' : '#fff';
}

export function TimingTower({
  rows,
  mode,
  q2Cut = 0,
  totalLaps,
  selectedId,
  onSelect,
}: {
  rows: TimingRow[];
  mode: 'session' | 'race';
  /** Prove: i primi N passano in Q2. */
  q2Cut?: number;
  totalLaps?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const race = mode === 'race';
  return (
    <div className="tt-wrap">
      <table className="tt" aria-label="Tempi">
        <thead>
          <tr>
            <th className="tt-p">P</th>
            <th className="tt-rider">Pilota</th>
            <th className="tt-num">#</th>
            {race ? (
              <>
                <th>Giro</th>
                <th>Distacco</th>
                <th>Interv.</th>
                <th>Ultimo</th>
                <th>Migliore</th>
              </>
            ) : (
              <>
                {q2Cut > 0 && <th>Q</th>}
                <th>Miglior giro</th>
                <th>Giri</th>
                <th>Gap P.</th>
                <th>Gap F.</th>
              </>
            )}
            <th className="tt-tyre">Gomma</th>
            <th className="tt-s">S1</th>
            <th className="tt-s">S2</th>
            <th className="tt-s">S3</th>
            <th className="tt-s">S4</th>
            <th className="tt-bike">Moto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const i = r.info;
            const gone = r.status === 'retired';
            return (
              <tr
                key={i.id}
                className={`${i.mine ? 'mine' : ''} ${selectedId === i.id ? 'sel' : ''} ${gone ? 'out' : ''}`}
                onClick={onSelect ? () => onSelect(i.id) : undefined}
              >
                <td className="tt-p">{gone ? '–' : r.pos}</td>
                <td className="tt-rider" style={{ ['--c' as string]: i.color }}>
                  <span className="tt-first">{i.firstName}</span> <b>{i.lastName.toUpperCase()}</b>
                  {r.status === 'box' && <em className="tt-flag">BOX</em>}
                  {r.status === 'out' && <em className="tt-flag out">OUT</em>}
                  {r.status === 'in' && <em className="tt-flag">IN</em>}
                  {gone && <em className="tt-flag ret">RIT</em>}
                </td>
                <td className="tt-num" style={{ background: i.color, color: ink(i.color) }}>
                  {i.number}
                </td>
                {race ? (
                  <>
                    <td className="tt-t">
                      {r.status === 'finished' ? '🏁' : `${Math.min(r.laps + 1, totalLaps ?? 99)}`}
                    </td>
                    <td className="tt-t">
                      {r.pos === 1 || gone
                        ? ''
                        : r.lapsDown > 0
                          ? `+${r.lapsDown} ${r.lapsDown === 1 ? 'giro' : 'giri'}`
                          : fmtGap(r.gapFirst)}
                    </td>
                    <td className="tt-t">{r.pos === 1 || gone ? '' : fmtGap(r.gapPrev)}</td>
                    <td className="tt-t">{fmtLap(r.lastLap)}</td>
                    <td className="tt-t">{fmtLap(r.best)}</td>
                  </>
                ) : (
                  <>
                    {q2Cut > 0 && <td className="tt-q">{r.best !== null && r.pos <= q2Cut ? 'Q2' : ''}</td>}
                    <td className="tt-t">{fmtLap(r.best)}</td>
                    <td className="tt-t">{r.laps}</td>
                    <td className="tt-t">{fmtGap(r.gapPrev)}</td>
                    <td className="tt-t">{fmtGap(r.gapFirst)}</td>
                  </>
                )}
                <td className="tt-tyre">
                  <i className={`tt-chip ${i.compound}`}>{TYRE[i.compound] ?? '?'}</i>
                </td>
                {r.cells.map((c, k) => (
                  <td
                    key={k}
                    className={`tt-s ${c.state} ${c.color ?? ''}`}
                    style={
                      c.state === 'progress' ? { ['--fill' as string]: `${(c.fill ?? 0) * 100}%` } : undefined
                    }
                  >
                    {c.state === 'done' ? fmtLap(c.time) : ''}
                  </td>
                ))}
                <td className="tt-bike">{i.bike}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="tt-legend" aria-hidden>
        <span>
          <i className="best" /> miglior settore assoluto
        </span>
        <span>
          <i className="pb" /> miglior settore personale
        </span>
        <span>
          <i className="slow" /> più lento
        </span>
      </div>
    </div>
  );
}
