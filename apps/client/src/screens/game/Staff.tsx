import { Flag, FlagName } from '../../design-system/Flag.tsx';
import { useMemo, useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { StaffRole } from '@lean-angle/data';
import { useQuery } from '../../engine/hooks.ts';
import { Bar, Card, Monogram, Row, ratingTone } from '../../design-system/components.tsx';
import { ROLE_ORDER, STAFF_ROLE, STAFF_SKILL } from '../../i18n/it.ts';

const GROUPS: { label: string; roles: StaffRole[] | null }[] = [
  { label: 'Tutti', roles: null },
  { label: 'Tecnici di pista', roles: ['crewChief', 'trackEngineer', 'telemetryAnalyst', 'strategyChief'] },
  { label: 'Direzione', roles: ['technicalDirector', 'sportingDirector'] },
  { label: 'Meccanici', roles: ['mechanic'] },
  { label: 'Area medica', roles: ['doctor', 'physio'] },
];

export function StaffScreen({ teamId, colors }: { teamId: string; colors: { primary: string } }) {
  const q = useQuery('teamStaff', teamId as `tem_${string}`);
  const [group, setGroup] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const list = useMemo(() => {
    if (q.status !== 'ready') return [];
    const roles = GROUPS[group]!.roles;
    return q.data
      .filter((m) => !roles || roles.includes(m.role))
      .sort(
        (a, b) =>
          ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
          (a.assignedTo ?? '').localeCompare(b.assignedTo ?? '') ||
          b.rating - a.rating,
      );
  }, [q, group]);
  if (q.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const current = selected && list.some((m) => m.id === selected) ? selected : (list[0]?.id ?? null);
  return (
    <div className="split">
      <Card title="Personale" aside={`${q.data.length} persone sotto contratto`}>
        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.8rem', flexWrap: 'wrap' }}>
          {GROUPS.map((g, i) => (
            <button key={g.label} className={`btn ${i === group ? 'sel' : ''}`} onClick={() => setGroup(i)}>
              {g.label}
            </button>
          ))}
        </div>
        <table className="std">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Assegnato a</th>
              <th>Naz.</th>
              <th className="r">Età</th>
              <th className="r">Valut.</th>
              <th className="r">Esper.</th>
              <th>Contratto</th>
              <th className="r">Stipendio</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className={m.id === current ? 'sel' : ''} onClick={() => setSelected(m.id)}>
                <td>
                  <b>{m.name}</b>
                </td>
                <td>{STAFF_ROLE[m.role]}</td>
                <td className="t2">{m.assignedTo ?? '—'}</td>
                <td>
                  <Flag code={m.nationality} />
                </td>
                <td className="r">{m.age}</td>
                <td className={`r ${ratingTone(m.rating) ?? ''}`}>
                  <b>{m.rating}</b>
                </td>
                <td className="r">{m.experienceYears} a</td>
                <td>{m.contractEnd}</td>
                <td className="r">{m.salary ? formatMoney(m.salary) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {current && <StaffDetailPanel staffId={current} color={colors.primary} />}
    </div>
  );
}

function StaffDetailPanel({ staffId, color }: { staffId: string; color: string }) {
  const q = useQuery('staffDetail', staffId);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const m = q.data;
  return (
    <div className="detail">
      <Card>
        <div className="hero">
          <Monogram name={m.name} color={color} size={4.4} />
          <div>
            <div className="nm">{m.name}</div>
            <div className="muted" style={{ fontSize: '.8rem', marginTop: '.3rem' }}>
              {STAFF_ROLE[m.role]} · <FlagName code={m.nationality} size={0.9} /> · {m.age} anni
            </div>
          </div>
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem', marginTop: '.9rem' }}
        >
          <div className="kpi">
            <small>Valutazione</small>
            <b className={ratingTone(m.rating)} style={{ fontSize: '1.4rem' }}>
              {m.rating}
            </b>
          </div>
          <div className="kpi">
            <small>Potenziale (stima)</small>
            <b style={{ fontSize: '1.4rem' }}>~{m.potential}</b>
          </div>
          <div className="kpi">
            <small>Esperienza</small>
            <b style={{ fontSize: '1.4rem' }}>{m.experienceYears} a</b>
          </div>
          <div className="kpi">
            <small>Morale</small>
            <b style={{ fontSize: '1.4rem' }}>{m.morale}</b>
          </div>
        </div>
      </Card>
      <Card title="Competenze">
        {m.skills.map((s) => (
          <div key={s.key} className="attr">
            <span>{STAFF_SKILL[s.key] ?? s.key}</span>
            <Bar value={s.value} />
            <b className={ratingTone(s.value)}>{s.value}</b>
          </div>
        ))}
      </Card>
      {m.bonds.length > 0 && (
        <Card title="Rapporti con i piloti">
          {m.bonds.map((b) => (
            <div key={b.riderId} style={{ padding: '.4rem 0', borderTop: '1px solid var(--line)' }}>
              <b style={{ fontSize: '.84rem' }}>{b.rider}</b>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '.4rem',
                  fontSize: '.7rem',
                  marginTop: '.3rem',
                }}
              >
                <span className="muted">
                  Fiducia <b className="t2">{b.trust}</b>
                </span>
                <span className="muted">
                  Comunic. <b className="t2">{b.communication}</b>
                </span>
                <span className="muted">
                  Compat. <b className="t2">{b.compatibility}</b>
                </span>
                <span className="muted">
                  Stile <b className="t2">{b.styleUnderstanding}%</b>
                </span>
                <span className="muted">
                  Soddisf. <b className="t2">{b.satisfaction}</b>
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
      <Card title="Contratto">
        <Row label="Scadenza">{m.contractEnd ?? '—'}</Row>
        <Row label="Stipendio annuo">{m.salary !== null ? formatMoney(m.salary) : '—'}</Row>
        <Row label="Reputazione">{m.reputation}</Row>
      </Card>
    </div>
  );
}
