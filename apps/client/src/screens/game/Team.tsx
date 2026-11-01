import { useQuery } from '../../engine/hooks.ts';
import { Bar, Card, Money, Row, TeamBadge } from '../../design-system/components.tsx';
import { FACILITY, STAFF_ROLE, TEAM_TYPE, country } from '../../i18n/it.ts';

export function TeamScreen({ teamId }: { teamId: string }) {
  const q = useQuery('teamOverview', teamId as `tem_${string}`);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const t = q.data;
  return (
    <div className="grid12">
      <Card
        className="s12"
        style={{ background: `linear-gradient(100deg, ${t.colors.primary}33, var(--bg-2) 55%)` }}
      >
        <div className="hero">
          <TeamBadge colors={t.colors} short={t.shortName} size={5} />
          <div>
            <div className="nm" style={{ fontSize: '2.2rem' }}>
              {t.name}
            </div>
            <div className="t2" style={{ marginTop: '.3rem' }}>
              {TEAM_TYPE[t.type]} · {t.manufacturer} · {country(t.nationality)}, {t.baseCity} · fondata nel{' '}
              {t.founded}
            </div>
          </div>
          <div className="spacer" />
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div className="kpi">
              <small>Reputazione</small>
              <b style={{ fontSize: '1.6rem' }}>{t.reputation}</b>
            </div>
            <div className="kpi">
              <small>Saldo</small>
              <b style={{ fontSize: '1.6rem' }}>{t.balance !== null ? <Money value={t.balance} /> : '—'}</b>
            </div>
          </div>
        </div>
      </Card>
      <Card title="Identità e proprietà" className="s4">
        <Row label="Nome breve">{t.shortName}</Row>
        <Row label="Proprietà">
          {t.owner.name} {t.owner.kind === 'manufacturer' ? '(costruttore)' : ''}
        </Row>
        <Row label="Costruttore delle moto">{t.manufacturer}</Row>
        <Row label="Colori">
          <span style={{ display: 'inline-flex', gap: '.3rem' }}>
            {[t.colors.primary, t.colors.secondary, t.colors.accent].filter(Boolean).map((c) => (
              <i
                key={c}
                title={c}
                style={{
                  width: '1.2rem',
                  height: '1.2rem',
                  borderRadius: 4,
                  background: c,
                  border: '1px solid var(--line-strong)',
                  display: 'inline-block',
                }}
              />
            ))}
          </span>
        </Row>
        <Row label="Moto">
          {t.bikes.total} ({t.bikes.perRider === 2 ? 'Moto A e B per pilota' : 'una per pilota'})
        </Row>
      </Card>
      <Card title="Costi del personale" aside="contratti attivi, all'anno" className="s4">
        <Row label="Piloti">
          <Money value={t.payroll.riders} />
        </Row>
        <Row label="Staff">
          <Money value={t.payroll.staff} />
        </Row>
        <Row label="Totale">
          <Money value={t.payroll.riders + t.payroll.staff} />
        </Row>
      </Card>
      <Card title="Organico" className="s4">
        {t.staffByRole.map((r) => (
          <Row key={r.role} label={STAFF_ROLE[r.role]}>
            {r.count}
          </Row>
        ))}
      </Card>
      <Card
        title="Strutture"
        aside="livello 1–5 · lo sviluppo delle strutture arriverà con la Fase 3"
        className="s12"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '.2rem 2rem' }}>
          {t.facilities.map((f) => (
            <div key={f.type} className="attr" style={{ gridTemplateColumns: '11rem 1fr 2.5rem' }}>
              <span>{FACILITY[f.type]}</span>
              <Bar value={f.level} max={5} />
              <b>{f.level}/5</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
