import { useQuery } from '../../engine/hooks.ts';
import { Bar, Card, Money, Monogram, Row, ratingTone } from '../../design-system/components.tsx';
import { STAFF_ROLE, TEAM_TYPE, country } from '../../i18n/it.ts';
import type { Section } from '../../shell/Shell.tsx';

export function Overview({ go }: { go: (s: Section) => void }) {
  const sum = useQuery('careerSummary');
  if (sum.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const s = sum.data;
  const team = s.team!;
  return (
    <div className="grid12">
      <Card
        title="Prossimo evento"
        aside={s.nextRound ? `Round ${s.nextRound.number} di ${s.roundsTotal}` : undefined}
        className="s5"
      >
        {s.nextRound ? (
          <>
            <div className="display" style={{ fontSize: '1.6rem' }}>
              {s.nextRound.circuit}
            </div>
            <div className="muted" style={{ marginBottom: '.6rem' }}>
              {country(s.nextRound.country)} · {s.nextRound.date}
            </div>
            <Row label="Mancano">{s.nextRound.inDays} giorni</Row>
            <Row label="Lunghezza">{(s.nextRound.lengthM / 1000).toFixed(2).replace('.', ',')} km</Row>
            <Row label="Curve">{s.nextRound.turns}</Row>
            <p className="muted" style={{ fontSize: '.76rem' }}>
              Il weekend di gara (prove, qualifiche, gara) sarà giocabile con la Fase 2.
            </p>
          </>
        ) : (
          <p className="muted">La stagione è conclusa.</p>
        )}
        <button className="btn" onClick={() => go('calendar')}>
          Calendario completo
        </button>
      </Card>
      <RidersCard teamId={team.id} color={team.colors.primary} go={go} />
      <Card title="Scuderia" className="s4">
        <Row label="Tipologia">{TEAM_TYPE[team.type]}</Row>
        <Row label="Costruttore">{team.manufacturer}</Row>
        <Row label="Proprietà">{team.ownerName}</Row>
        <Row label="Reputazione">{team.reputation}</Row>
        <Row label="Categoria">
          {s.category!.name} · {s.category!.bikesPerRider === 2 ? 'Moto A e B' : 'una moto per pilota'}
        </Row>
        <button className="btn" style={{ marginTop: '.5rem' }} onClick={() => go('team')}>
          Dettagli scuderia
        </button>
      </Card>
      <Card title="Finanze" aside="saldo reale dalle transazioni" className="s4">
        <div className="muted" style={{ fontSize: '.72rem' }}>
          Saldo di cassa
        </div>
        <div className="big" style={{ margin: '.2rem 0 .7rem' }}>
          {team.balance !== null ? <Money value={team.balance} /> : '—'}
        </div>
        <p className="muted" style={{ fontSize: '.76rem' }}>
          Entrate, uscite e previsioni arriveranno con il sistema economico (Fase 2).
        </p>
      </Card>
      <Card title="Stagione" className="s4">
        <Row label="Round disputati">
          {s.roundsDone} / {s.roundsTotal}
        </Row>
        <div style={{ margin: '.6rem 0' }}>
          <Bar value={s.roundsDone} max={s.roundsTotal} />
        </div>
        <Row label="Data di gioco">{s.date}</Row>
        <Row label="Carriera">{s.saveName}</Row>
      </Card>
      <KeyStaff teamId={team.id} color={team.colors.primary} go={go} />
    </div>
  );
}

function RidersCard({ teamId, color, go }: { teamId: string; color: string; go: (s: Section) => void }) {
  const q = useQuery('teamRiders', teamId as `tem_${string}`);
  const riders = q.status === 'ready' ? q.data.filter((r) => r.role === 'race') : [];
  return (
    <Card
      title="Piloti"
      aside={
        <button className="btn ghost" style={{ padding: '.1rem .5rem' }} onClick={() => go('riders')}>
          Gestisci
        </button>
      }
      className="s7"
    >
      <div className="two-col">
        {riders.map((r) => (
          <div
            key={r.id}
            style={{
              background: 'var(--bg-3)',
              borderRadius: 'var(--r-2)',
              padding: '.85rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: '.6rem',
                top: '-.6rem',
                font: '800 5rem/1 var(--font-display)',
                fontStyle: 'italic',
                color: 'rgba(255,255,255,.05)',
              }}
            >
              {r.number}
            </div>
            <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center' }}>
              <Monogram name={r.name} color={color} size={3.2} />
              <div>
                <div className="display" style={{ fontSize: '1.25rem' }}>
                  {r.name}
                </div>
                <div className="muted" style={{ fontSize: '.76rem' }}>
                  #{r.number} · {country(r.nationality)} · {r.age} anni
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: '.4rem',
                marginTop: '.8rem',
                fontSize: '.7rem',
              }}
            >
              <div>
                <div className="muted">VALUTAZIONE</div>
                <b className={ratingTone(r.rating)} style={{ fontSize: '1.1rem' }}>
                  {r.rating}
                </b>
              </div>
              <div>
                <div className="muted">MORALE</div>
                <b style={{ fontSize: '1.1rem' }}>{r.morale}</b>
              </div>
              <div>
                <div className="muted">CONTRATTO</div>
                <b style={{ fontSize: '.85rem' }}>{r.contractEnd}</b>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function KeyStaff({ teamId, color, go }: { teamId: string; color: string; go: (s: Section) => void }) {
  const q = useQuery('teamStaff', teamId as `tem_${string}`);
  const key =
    q.status === 'ready'
      ? q.data.filter((x) => ['technicalDirector', 'crewChief', 'trackEngineer'].includes(x.role))
      : [];
  return (
    <Card
      title="Staff tecnico"
      aside={
        <button className="btn ghost" style={{ padding: '.1rem .5rem' }} onClick={() => go('staff')}>
          Personale
        </button>
      }
      className="s12"
    >
      <div className="staff-row">
        {key.map((m) => (
          <div key={m.id} style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
            <Monogram name={m.name} color={color} />
            <div style={{ fontSize: '.78rem', minWidth: 0 }}>
              <b>{m.name}</b>
              <div className="muted">
                {STAFF_ROLE[m.role]}
                {m.assignedTo ? ` · ${m.assignedTo}` : ''}
              </div>
            </div>
            <b className={ratingTone(m.rating)} style={{ marginLeft: 'auto' }}>
              {m.rating}
            </b>
          </div>
        ))}
      </div>
    </Card>
  );
}
