import { Helmet } from '../../design-system/Helmet.tsx';
import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import { useQuery } from '../../engine/hooks.ts';
import { Bar, Card, Row, ratingTone } from '../../design-system/components.tsx';
import { RIDER_ATTR, RIDER_ROLE, country } from '../../i18n/it.ts';

export function RidersScreen({
  teamId,
  teamName,
  colors,
}: {
  teamId: string;
  teamName: string;
  colors: { primary: string; secondary: string };
}) {
  const q = useQuery('teamRiders', teamId as `tem_${string}`);
  const [selected, setSelected] = useState<string | null>(null);
  if (q.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const current = selected ?? q.data[0]?.id ?? null;
  return (
    <div className="split">
      <Card title="Piloti sotto contratto" aside={`${q.data.length} piloti`}>
        <table className="std">
          <thead>
            <tr>
              <th>#</th>
              <th>Pilota</th>
              <th>Ruolo</th>
              <th>Naz.</th>
              <th className="r">Età</th>
              <th className="r">Valut.</th>
              <th className="r">Morale</th>
              <th>Contratto</th>
              <th className="r">Stipendio</th>
            </tr>
          </thead>
          <tbody>
            {q.data.map((r) => (
              <tr key={r.id} className={r.id === current ? 'sel' : ''} onClick={() => setSelected(r.id)}>
                <td className="muted">{r.number ?? '—'}</td>
                <td>
                  <b>{r.name}</b>
                </td>
                <td>{RIDER_ROLE[r.role]}</td>
                <td>{r.nationality}</td>
                <td className="r">{r.age}</td>
                <td className={`r ${ratingTone(r.rating) ?? ''}`}>
                  <b>{r.rating}</b>
                </td>
                <td className="r">{r.morale}</td>
                <td>{r.contractEnd}</td>
                <td className="r">{r.salary ? formatMoney(r.salary) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {current && <RiderDetailPanel riderId={current} teamName={teamName} colors={colors} />}
    </div>
  );
}

function RiderDetailPanel({
  riderId,
  teamName,
  colors,
}: {
  riderId: string;
  teamName: string;
  colors: { primary: string; secondary: string };
}) {
  const q = useQuery('riderDetail', riderId);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const r = q.data;
  return (
    <div className="detail">
      <Card>
        <div className="hero">
          <Helmet team={teamName} colors={colors} number={r.number} size={7} />
          <div>
            <div className="nm">{r.name}</div>
            <div className="muted" style={{ fontSize: '.8rem', marginTop: '.3rem' }}>
              {country(r.nationality)} · {r.age} anni · {RIDER_ROLE[r.role]}
            </div>
          </div>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem', marginTop: '.9rem' }}
        >
          <div className="kpi">
            <small>Valutazione</small>
            <b className={ratingTone(r.rating)} style={{ fontSize: '1.4rem' }}>
              {r.rating}
            </b>
          </div>
          <div className="kpi">
            <small>Potenziale (stima)</small>
            <b style={{ fontSize: '1.4rem' }}>
              {r.potential[0]}–{r.potential[1]}
            </b>
          </div>
          <div className="kpi">
            <small>Morale</small>
            <b style={{ fontSize: '1.4rem' }}>{r.morale}</b>
          </div>
          <div className="kpi">
            <small>Reputazione</small>
            <b style={{ fontSize: '1.4rem' }}>{r.reputation}</b>
          </div>
        </div>
      </Card>
      <Card title="Attributi">
        {r.attributes.map((a) => (
          <div key={a.key} className="attr">
            <span>{RIDER_ATTR[a.key]}</span>
            <Bar value={a.value} />
            <b className={ratingTone(a.value)}>{a.value}</b>
          </div>
        ))}
      </Card>
      {r.staff.length > 0 && (
        <Card title="Staff tecnico assegnato" aside="rapporto con il pilota">
          {r.staff.map((m) => (
            <div key={m.id} style={{ padding: '.4rem 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.84rem' }}>
                <b>{m.name}</b>
                <span className="muted">
                  {m.role === 'crewChief' ? 'Capotecnico' : 'Ingegnere di pista'} · {m.rating}
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '.5rem',
                  fontSize: '.7rem',
                  marginTop: '.3rem',
                }}
              >
                <span className="muted">
                  Fiducia <b className="t2">{m.trust}</b>
                </span>
                <span className="muted">
                  Comunicazione <b className="t2">{m.communication}</b>
                </span>
                <span className="muted">
                  Compatibilità <b className="t2">{m.compatibility}</b>
                </span>
                <span className="muted">
                  Stile <b className="t2">{m.styleUnderstanding}%</b>
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card title="Contratto e moto">
        <Row label="Squadra">{r.team ?? '—'}</Row>
        <Row label="Scadenza">{r.contractEnd ?? '—'}</Row>
        <Row label="Stipendio annuo">{r.salary !== null ? formatMoney(r.salary) : '—'}</Row>
        {r.bonuses.map((b) => (
          <Row
            key={b.condition}
            label={
              b.condition === 'podium'
                ? 'Bonus podio'
                : b.condition === 'win'
                  ? 'Bonus vittoria'
                  : `Bonus ${b.condition}`
            }
          >
            {formatMoney(b.amount)}
          </Row>
        ))}
        <Row label="Moto assegnate">
          {r.bikes.length ? r.bikes.map((b) => `Moto ${b.slot}`).join(' · ') : 'nessuna'}
        </Row>
      </Card>
    </div>
  );
}
