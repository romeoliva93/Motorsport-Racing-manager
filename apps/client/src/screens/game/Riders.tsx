import { Portrait } from '../../design-system/Portrait.tsx';
import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { RiderProfile } from '@lean-angle/game';
import { useQuery } from '../../engine/hooks.ts';
import { Bar, Card, Explain, Help, Pos, Row, Tabs, ratingTone } from '../../design-system/components.tsx';
import { Helmet } from '../../design-system/Helmet.tsx';
import { NumberPlate } from '../../design-system/NumberPlate.tsx';
import { Flag, FlagName } from '../../design-system/Flag.tsx';
import { RIDER_ATTR, RIDER_ROLE, STAFF_ROLE } from '../../i18n/it.ts';
import './riders.css';

type Tab = 'overview' | 'attributes' | 'results' | 'contract' | 'relations' | 'tech' | 'history';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Panoramica' },
  { id: 'attributes', label: 'Attributi' },
  { id: 'results', label: 'Risultati' },
  { id: 'contract', label: 'Contratto' },
  { id: 'relations', label: 'Relazioni' },
  { id: 'tech', label: 'Preferenze tecniche' },
  { id: 'history', label: 'Storico' },
];

const GROUPS: { title: string; keys: (keyof typeof RIDER_ATTR)[] }[] = [
  { title: 'Velocità', keys: ['speed', 'racePace', 'acceleration'] },
  { title: 'Guida', keys: ['braking', 'cornerEntry', 'overtaking', 'defending'] },
  { title: 'Gestione', keys: ['tyreManagement', 'fuelManagement', 'consistency', 'wet'] },
  {
    title: 'Testa e fisico',
    keys: ['aggression', 'concentration', 'mentalStrength', 'fitness', 'adaptability', 'technicalFeedback'],
  },
];
const PERSONALITY: Record<string, string> = {
  ambition: 'Ambizione',
  loyalty: 'Lealtà',
  temperament: 'Temperamento',
  professionalism: 'Professionalità',
  mediaSavvy: 'Rapporto con i media',
};

export function RidersScreen({
  teamId,
  teamName,
  colors,
  twoBikes,
}: {
  teamId: string;
  teamName: string;
  colors: { primary: string; secondary: string };
  /** Solo in Premier ogni pilota ha Moto A e Moto B. */
  twoBikes: boolean;
}) {
  const q = useQuery('teamRiders', teamId as `tem_${string}`);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  if (q.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const list = q.data;
  const current = list.some((r) => r.id === selected) ? selected : (list[0]?.id ?? null);
  return (
    <div className="riders">
      <div className="rider-switch" role="tablist" aria-label="Scegli il pilota">
        {list.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={r.id === current}
            className={`rs-card ${r.id === current ? 'on' : ''}`}
            onClick={() => setSelected(r.id)}
          >
            <Portrait
              portrait={r.portrait}
              name={r.name}
              size={3.2}
              round
              fallback={<Helmet team={teamName} colors={colors} size={3.4} />}
            />
            <span className="rs-num" style={{ color: colors.primary }}>
              {r.number ?? '–'}
            </span>
            <span className="rs-who">
              <b>{r.name}</b>
              <small>
                <Flag code={r.nationality} size={0.8} /> {RIDER_ROLE[r.role]}
              </small>
            </span>
            <span className={`rs-rating ${ratingTone(r.rating) ?? ''}`}>{r.rating}</span>
          </button>
        ))}
      </div>
      {current && (
        <RiderProfileView
          riderId={current}
          teamName={teamName}
          tab={tab}
          setTab={setTab}
          twoBikes={twoBikes}
        />
      )}
    </div>
  );
}

function RiderProfileView({
  riderId,
  teamName,
  tab,
  setTab,
  twoBikes,
}: {
  riderId: string;
  teamName: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  twoBikes: boolean;
}) {
  const q = useQuery('riderProfile', riderId);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const p = q.data;
  const r = p.detail;
  const colors = p.teamColors ?? { primary: '#55585f', secondary: '#2a2b30' };
  return (
    <>
      <div className="card accent rider-hero" style={{ ['--team' as string]: colors.primary }}>
        <div className="rh-portrait">
          <Portrait
            portrait={r.portrait}
            name={r.name}
            size={8.5}
            fallback={
              <>
                <Helmet team={teamName} colors={colors} size={9} />
                <small className="muted">Ritratto in arrivo</small>
              </>
            }
          />
        </div>
        <NumberPlate number={r.number} colors={colors} size={6.5} />
        <div className="rh-id">
          <div className="rh-flag">
            <FlagName code={r.nationality} size={1.2} />
          </div>
          <h1>
            <span>{r.firstName}</span> {r.lastName}
          </h1>
          <div className="t2">
            {r.team ?? 'Senza squadra'} · {p.category ?? '—'} · {RIDER_ROLE[r.role]} · {r.age} anni
          </div>
        </div>
        <div className="rh-kpis">
          <Kpi label="Valutazione" value={r.rating} tone={ratingTone(r.rating)} />
          <Kpi
            label="Potenziale"
            value={`${r.potential[0]}–${r.potential[1]}`}
            help="Stima degli osservatori: più è largo l’intervallo, meno sono sicuri."
          />
          <Kpi
            label="Morale"
            value={r.morale}
            tone={r.morale >= 70 ? 'ok' : r.morale < 45 ? 'bad' : undefined}
          />
          <Kpi label="Punti stagione" value={p.current?.points ?? 0} />
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} options={TABS} />

      {tab === 'overview' && <Overview p={p} />}
      {tab === 'attributes' && <Attributes p={p} />}
      {tab === 'results' && <Results p={p} />}
      {tab === 'contract' && <Contract p={p} twoBikes={twoBikes} />}
      {tab === 'relations' && <Relations p={p} />}
      {tab === 'tech' && <Tech p={p} />}
      {tab === 'history' && <History p={p} />}
    </>
  );
}

function Kpi({
  label,
  value,
  tone,
  help,
}: {
  label: string;
  value: string | number;
  tone?: string | undefined;
  help?: string;
}) {
  return (
    <div className="rh-kpi">
      <small>
        {label}
        {help && <Help>{help}</Help>}
      </small>
      <b className={tone}>{value}</b>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function Overview({ p }: { p: RiderProfile }) {
  const s = p.current;
  const r = p.detail;
  return (
    <div className="grid12">
      <Card title={`Stagione ${s?.year ?? ''}`} className="s8">
        {s ? (
          <div className="stat-grid">
            <Stat label="Gare" value={s.starts} />
            <Stat label="Vittorie" value={s.wins} />
            <Stat label="Podi" value={s.podiums} />
            <Stat label="Pole" value={s.poles} />
            <Stat label="Giri veloci" value={s.fastestLaps} />
            <Stat label="Punti" value={s.points} />
            <Stat label="Classifica" value={s.position ? `${s.position}°` : '—'} />
            <Stat label="Ritiri" value={s.dnf} />
          </div>
        ) : (
          <p className="muted">Ancora nessuna gara in questa stagione.</p>
        )}
        {s && s.results.length > 0 && (
          <div className="form-strip" aria-label="Ultimi risultati">
            {s.results.slice(-6).map((x) => (
              <span
                key={x.roundNumber}
                title={`${x.circuit}: ${x.race?.position ? `${x.race.position}°` : 'ritirato'}`}
              >
                <Flag code={x.country} size={0.75} />
                <Pos value={x.race?.position ?? null} />
              </span>
            ))}
          </div>
        )}
      </Card>
      <Card title="In breve" className="s4">
        <Row label="Squadra">{r.team ?? '—'}</Row>
        <Row label="Reputazione">{r.reputation}</Row>
        <Row label="Forma">
          <span className={r.form > 0 ? 'ok' : r.form < 0 ? 'bad' : ''}>
            {r.form > 0 ? `+${r.form}` : r.form}
          </span>
        </Row>
        <Row label="Morale">
          <span className={r.morale >= 65 ? 'ok' : r.morale >= 45 ? '' : 'warn'}>{r.morale}</span>
        </Row>
        <Row label="Contratto fino al">{p.contract?.end ?? '—'}</Row>
        {r.injury && (
          <Row label="Infortunio">
            <span className="bad">
              {r.injury.type} · {r.injury.estimate[0]}–{r.injury.estimate[1]} giorni
            </span>
          </Row>
        )}
      </Card>
      <Card title="Punti di forza" className="s6">
        {[...r.attributes]
          .sort((a, b) => b.value - a.value)
          .slice(0, 4)
          .map((a) => (
            <AttrRow key={a.key} label={RIDER_ATTR[a.key]} value={a.value} />
          ))}
      </Card>
      <Card title="Da migliorare" className="s6">
        {[...r.attributes]
          .sort((a, b) => a.value - b.value)
          .slice(0, 4)
          .map((a) => (
            <AttrRow key={a.key} label={RIDER_ATTR[a.key]} value={a.value} />
          ))}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

function AttrRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="attr">
      <span>{label}</span>
      <Bar value={value} max={99} tone={ratingTone(value)} />
      <b className={ratingTone(value)}>{value}</b>
    </div>
  );
}

function Attributes({ p }: { p: RiderProfile }) {
  const val = new Map(p.detail.attributes.map((a) => [a.key, a.value]));
  return (
    <div className="grid12">
      {GROUPS.map((g) => (
        <Card key={g.title} title={g.title} className="s6">
          {g.keys.map((k) => (
            <AttrRow key={k} label={RIDER_ATTR[k]} value={val.get(k) ?? 0} />
          ))}
        </Card>
      ))}
      <Explain style={{ gridColumn: 'span 12' }}>
        Valori da 1 a 99: <b className="ok">75+</b> ottimo, <b>60–74</b> buono, <b className="warn">45–59</b>{' '}
        discreto, sotto è debole. I giovani si avvicinano al loro potenziale stagione dopo stagione; dopo i 30
        anni velocità e forma fisica calano.
      </Explain>
    </div>
  );
}

function Results({ p }: { p: RiderProfile }) {
  const s = p.current;
  if (!s || s.results.length === 0)
    return (
      <Card>
        <p className="muted" style={{ margin: 0 }}>
          Nessun Gran Premio disputato in questa stagione.
        </p>
      </Card>
    );
  return (
    <Card title={`Gran Premi ${s.year}`} aside={`${s.category} · ${s.points} punti`}>
      <div style={{ overflowX: 'auto' }}>
        <table className="std static">
          <thead>
            <tr>
              <th>GP</th>
              <th>Circuito</th>
              <th className="r">Griglia</th>
              <th className="r">Sprint</th>
              <th className="r">Gara</th>
              <th className="r">Punti</th>
            </tr>
          </thead>
          <tbody>
            {s.results.map((x) => (
              <tr key={x.roundNumber}>
                <td>{x.roundNumber}</td>
                <td>
                  <span className="flag-name">
                    <Flag code={x.country} />
                    {x.circuit}
                  </span>
                </td>
                <td className="r">
                  {x.grid ?? '—'}
                  {x.pole && (
                    <span className="pill or" style={{ marginLeft: '.4rem' }}>
                      pole
                    </span>
                  )}
                </td>
                <td className="r">{x.sprint ? (x.sprint.position ?? 'rit.') : '—'}</td>
                <td className="r">
                  {x.race ? (
                    x.race.position ? (
                      <Pos value={x.race.position} />
                    ) : (
                      <span className="bad">rit.</span>
                    )
                  ) : (
                    '—'
                  )}
                  {x.fastestLap && (
                    <span className="pill info" style={{ marginLeft: '.4rem' }}>
                      giro veloce
                    </span>
                  )}
                </td>
                <td className="r">
                  <b>{x.points || '—'}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Contract({ p, twoBikes }: { p: RiderProfile; twoBikes: boolean }) {
  const k = p.contract;
  if (!k)
    return (
      <Card>
        <p className="muted" style={{ margin: 0 }}>
          Pilota senza contratto.
        </p>
      </Card>
    );
  return (
    <div className="grid12">
      <Card title="Contratto" className="s6">
        <Row label="Ruolo">{RIDER_ROLE[k.role as keyof typeof RIDER_ROLE] ?? k.role}</Row>
        <Row label="Inizio">{k.start}</Row>
        <Row label="Scadenza">
          <span className={k.expiresThisYear ? 'warn' : ''}>
            {k.end}
            {k.expiresThisYear ? ' · in scadenza' : ''}
          </span>
        </Row>
        <Row label="Stipendio annuo">{formatMoney(k.salary)}</Row>
        <Row label="Clausola rescissoria">{formatMoney(k.buyout)}</Row>
        {k.bonuses.map((b) => (
          <Row key={b.condition} label={`Bonus ${b.condition}`}>
            {formatMoney(b.amount)}
          </Row>
        ))}
      </Card>
      <Card title={twoBikes ? 'Garage: Moto A e Moto B' : 'Moto'} className="s6">
        {p.detail.bikes.length === 0 && <p className="muted">Nessuna moto assegnata.</p>}
        {p.detail.bikes
          .filter((b) => twoBikes || b.slot === 'A')
          .map((b) => (
            <Row key={b.slot} label={twoBikes ? `Moto ${b.slot}` : 'Moto da gara'}>
              {b.label}
            </Row>
          ))}
        <p className="muted" style={{ fontSize: '.85rem' }}>
          {twoBikes
            ? 'In Premier ogni pilota ha due moto pronte ai box.'
            : 'In questa categoria il regolamento prevede una sola moto per pilota.'}
        </p>
      </Card>
    </div>
  );
}

function Relations({ p }: { p: RiderProfile }) {
  return (
    <div className="grid12">
      <Card title="Squadra tecnica" aside="rapporto con il pilota" className="s7">
        {p.detail.staff.length === 0 && <p className="muted">Nessun tecnico assegnato.</p>}
        {p.detail.staff.map((m) => (
          <div key={m.id} className="rel">
            <div className="rel-head">
              <b>{m.name}</b>
              <span className="muted">
                {STAFF_ROLE[m.role]} · valutazione {m.rating}
              </span>
            </div>
            <AttrRow label="Fiducia" value={m.trust} />
            <AttrRow label="Comunicazione" value={m.communication} />
            <AttrRow label="Compatibilità" value={m.compatibility} />
            <AttrRow label="Capisce il suo stile" value={m.styleUnderstanding} />
          </div>
        ))}
      </Card>
      <Card title="Carattere" className="s5">
        {p.personality.map((x) => (
          <AttrRow key={x.key} label={PERSONALITY[x.key] ?? x.key} value={x.value} />
        ))}
      </Card>
    </div>
  );
}

function Tech({ p }: { p: RiderProfile }) {
  return (
    <Card title="Preferenze tecniche">
      <Explain style={{ marginBottom: '.8rem' }}>
        Ricavate dallo stile di guida del pilota: l’ingegnere le usa come punto di partenza per l’assetto.
      </Explain>
      <div className="prefs">
        {p.preferences.map((x) => (
          <div key={x.label} className="tile">
            <small className="muted">{x.label}</small>
            <b>{x.value}</b>
            <span className="t2">{x.why}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function History({ p }: { p: RiderProfile }) {
  const c = p.career;
  return (
    <div className="grid12">
      <Card title="Carriera" aside="stagioni giocate in questa partita" className="s12">
        <div className="stat-grid">
          <Stat label="Stagioni" value={c.seasons} />
          <Stat label="Titoli" value={c.titles} />
          <Stat label="Gare" value={c.starts} />
          <Stat label="Vittorie" value={c.wins} />
          <Stat label="Podi" value={c.podiums} />
          <Stat label="Pole" value={c.poles} />
          <Stat label="Giri veloci" value={c.fastestLaps} />
          <Stat label="Punti" value={c.points} />
        </div>
      </Card>
      <Card title="Stagione per stagione" className="s12">
        {p.history.length === 0 ? (
          <p className="muted">Lo storico si riempie con le gare disputate.</p>
        ) : (
          <table className="std static">
            <thead>
              <tr>
                <th>Anno</th>
                <th>Categoria</th>
                <th>Squadra</th>
                <th className="r">Pos.</th>
                <th className="r">Punti</th>
                <th className="r">Vittorie</th>
                <th className="r">Podi</th>
                <th className="r">Pole</th>
              </tr>
            </thead>
            <tbody>
              {p.history.map((h) => (
                <tr key={h.seasonId}>
                  <td>
                    {h.year}
                    {!h.finished && <span className="muted"> · in corso</span>}
                  </td>
                  <td>{h.category}</td>
                  <td className="t2">{h.team}</td>
                  <td className="r">
                    {h.position ?? '—'}
                    {h.position === 1 && h.finished && (
                      <span className="pill or" style={{ marginLeft: '.4rem' }}>
                        campione
                      </span>
                    )}
                  </td>
                  <td className="r">
                    <b>{h.points}</b>
                  </td>
                  <td className="r">{h.wins}</td>
                  <td className="r">{h.podiums}</td>
                  <td className="r">{h.poles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
