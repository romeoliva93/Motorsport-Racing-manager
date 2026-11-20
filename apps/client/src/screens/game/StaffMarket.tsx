/**
 * Mercato del personale tecnico: tecnici svincolati da ingaggiare in qualsiasi momento.
 * Capotecnico e ingegnere di pista si assegnano a un pilota; per gli altri ruoli si può sostituire qualcuno.
 */
import { useMemo, useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { StaffRole } from '@lean-angle/data';
import type { StaffMarketView } from '@lean-angle/game';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Row, ratingTone } from '../../design-system/components.tsx';
import { Flag } from '../../design-system/Flag.tsx';
import { STAFF_ROLE, STAFF_SKILL } from '../../i18n/it.ts';

const RIDER_ROLES: StaffRole[] = ['crewChief', 'trackEngineer'];

export function StaffMarket({ notify }: { notify: (t: string, e?: boolean) => void }) {
  const q = useQuery('staffMarket');
  const [role, setRole] = useState<StaffRole | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const v = q.status === 'ready' ? q.data : null;
  const roles = useMemo(() => [...new Set((v?.free ?? []).map((m) => m.role))], [v]);
  if (!v) return <div className="loading">Caricamento…</div>;
  const list = v.free.filter((m) => role === 'all' || m.role === role);
  const current = list.find((m) => m.id === sel) ?? list[0] ?? null;
  return (
    <div className="split market">
      <Card title="Personale tecnico svincolato" aside={`${list.length} tecnici`}>
        <Explain style={{ marginBottom: '.8rem' }}>
          Tecnici senza contratto: si ingaggiano in ogni momento della stagione. Il capotecnico decide
          consigli e tempi delle modifiche d’assetto; i meccanici accelerano i lavori fra le sessioni (ne hai{' '}
          <b>{v.mechanics.count}</b> su {v.mechanics.reference} di riferimento: lavori{' '}
          {v.mechanics.factor <= 1
            ? `${Math.round((1 - v.mechanics.factor) * 100)}% più rapidi`
            : `${Math.round((v.mechanics.factor - 1) * 100)}% più lenti`}
          ).
        </Explain>
        <div className="mk-filters">
          <button className={`btn ${role === 'all' ? 'sel' : ''}`} onClick={() => setRole('all')}>
            Tutti
          </button>
          {roles.map((r) => (
            <button key={r} className={`btn ${role === r ? 'sel' : ''}`} onClick={() => setRole(r)}>
              {STAFF_ROLE[r]}
            </button>
          ))}
        </div>
        <div className="mk-table">
          <table className="std">
            <thead>
              <tr>
                <th>Tecnico</th>
                <th>Ruolo</th>
                <th className="r">Età</th>
                <th className="r">Valut.</th>
                <th>Punti forti</th>
                <th className="r">Stipendio richiesto</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id} className={m.id === current?.id ? 'sel' : ''} onClick={() => setSel(m.id)}>
                  <td>
                    <b>{m.name}</b>
                    <div className="muted" style={{ fontSize: '.72rem' }}>
                      <Flag code={m.nationality} size={0.8} /> · {m.experienceYears} anni di esperienza
                    </div>
                  </td>
                  <td>{STAFF_ROLE[m.role]}</td>
                  <td className="r">{m.age}</td>
                  <td className={`r ${ratingTone(m.rating) ?? ''}`}>
                    <b>{m.rating}</b>
                  </td>
                  <td className="muted" style={{ fontSize: '.8rem' }}>
                    {m.best.map((b) => `${STAFF_SKILL[b.key] ?? b.key} ${b.value}`).join(' · ')}
                  </td>
                  <td className="r">{formatMoney(m.askingSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {current && <HirePanel key={current.id} m={current} v={v} notify={notify} />}
    </div>
  );
}

function HirePanel({
  m,
  v,
  notify,
}: {
  m: StaffMarketView['free'][number];
  v: StaffMarketView;
  notify: (t: string, e?: boolean) => void;
}) {
  const forRider = RIDER_ROLES.includes(m.role);
  const sameRole = v.mine.filter((x) => x.role === m.role);
  const [years, setYears] = useState(2);
  const [rider, setRider] = useState(v.riders[0]?.id ?? '');
  const [replace, setReplace] = useState('');
  const [busy, setBusy] = useState(false);
  const current = v.riders.find((r) => r.id === rider);
  async function hire() {
    setBusy(true);
    try {
      await engine.dispatch({
        type: 'HireStaff',
        staffId: m.id,
        years,
        ...(forRider ? { riderId: rider } : replace ? { replaceStaffId: replace } : {}),
      });
      notify(`${m.name} ingaggiato (${STAFF_ROLE[m.role].toLowerCase()}).`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="detail">
      <Card title={m.name} aside={STAFF_ROLE[m.role]}>
        <Row label="Valutazione">
          <b className={ratingTone(m.rating)}>{m.rating}</b>
        </Row>
        <Row label="Età · esperienza">
          {m.age} anni · {m.experienceYears} anni nel paddock
        </Row>
        {m.best.map((b) => (
          <Row key={b.key} label={STAFF_SKILL[b.key] ?? b.key}>
            {b.value}
          </Row>
        ))}
        <Row label="Stipendio richiesto">
          <b>{formatMoney(m.askingSalary)}</b> all’anno
        </Row>
      </Card>
      <Card title="Ingaggio" aside={`Saldo: ${formatMoney(v.balance)}`}>
        <div className="mk-form">
          <label className="field">
            <span>Durata</span>
            <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3].map((y) => (
                <option key={y} value={y}>
                  {y} {y === 1 ? 'anno' : 'anni'}
                </option>
              ))}
            </select>
          </label>
          {forRider ? (
            <label className="field">
              <span>Pilota da seguire</span>
              <select value={rider} onChange={(e) => setRider(e.target.value)}>
                {v.riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Sostituisce</span>
              <select value={replace} onChange={(e) => setReplace(e.target.value)}>
                <option value="">Nessuno (si aggiunge alla squadra)</option>
                {sameRole.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.rating})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {forRider && current && (
          <p className="muted" style={{ fontSize: '.82rem' }}>
            Prende il posto di <b>{m.role === 'crewChief' ? current.crewChief : current.trackEngineer}</b>,
            che viene liberato con un’indennità del 25% del contratto residuo.
          </p>
        )}
        <button className="btn primary" disabled={busy} onClick={hire}>
          Ingaggia per {formatMoney(m.askingSalary)} all’anno
        </button>
      </Card>
    </div>
  );
}
