import { useQuery } from '../../engine/hooks.ts';
import { Card } from '../../design-system/components.tsx';
import { country } from '../../i18n/it.ts';

export function CalendarScreen({ categoryId }: { categoryId: string }) {
  const q = useQuery('calendar', categoryId);
  if (q.status !== 'ready') return <div className="loading">Caricamento…</div>;
  return (
    <Card title="Calendario della stagione" aside={`${q.data.length} round`}>
      <table className="std">
        <thead>
          <tr>
            <th>Round</th>
            <th>Circuito</th>
            <th>Paese</th>
            <th>Data</th>
            <th className="r">Lunghezza</th>
            <th className="r">Curve</th>
            <th>Stato</th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((r) => (
            <tr
              key={r.id}
              className={r.status === 'next' ? 'sel' : ''}
              style={{ cursor: 'default', opacity: r.status === 'done' ? 0.55 : 1 }}
            >
              <td>
                <b>{r.number}</b>
              </td>
              <td>
                <b>{r.circuit}</b>
              </td>
              <td>{country(r.country)}</td>
              <td>{r.date}</td>
              <td className="r">{(r.lengthM / 1000).toFixed(2).replace('.', ',')} km</td>
              <td className="r">{r.turns}</td>
              <td>
                {r.status === 'done' ? (
                  <span className="pill">Raggiunto</span>
                ) : r.status === 'next' ? (
                  <span className="pill or">Prossimo</span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
