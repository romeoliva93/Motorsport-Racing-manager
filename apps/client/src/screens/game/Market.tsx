import { Flag, FlagName } from '../../design-system/Flag.tsx';
import { Helmet } from '../../design-system/Helmet.tsx';
import { useEffect, useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import type { MarketFilter, NegotiationView } from '@lean-angle/game';
import type { RiderId } from '@lean-angle/data';
import { engine } from '../../engine/engine.ts';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Money, Row, ratingTone } from '../../design-system/components.tsx';
import { RIDER_ROLE } from '../../i18n/it.ts';
import './market.css';

const FILTERS: { id: MarketFilter; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'free', label: 'Senza contratto' },
  { id: 'premier', label: 'MotoGP' },
  { id: 'intermediate', label: 'Moto2' },
  { id: 'lightweight', label: 'Moto3' },
  { id: 'rookies', label: 'Rookies Cup' },
];

const NEG_LABEL: Record<string, { text: string; cls: string }> = {
  open: { text: 'In trattativa', cls: 'or' },
  signed: { text: 'Firmato', cls: 'ok' },
  rejected: { text: 'Rifiutato', cls: 'bad' },
  withdrawn: { text: 'Chiusa', cls: '' },
};

export function MarketScreen({ notify }: { notify: (text: string, err?: boolean) => void }) {
  const [filter, setFilter] = useState<MarketFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery('marketRiders', filter, search);
  const list = q.status === 'ready' ? q.data : [];
  // Se il pilota selezionato non è nell'elenco filtrato, il pannello mostra il primo dell'elenco.
  const current =
    (selected && list.some((r) => r.id === selected) ? selected : null) ??
    list.find((r) => !r.own)?.id ??
    null;
  return (
    <div className="split market">
      <Card title="Mercato piloti" aside={q.status === 'ready' ? `${list.length} piloti` : '…'}>
        <div className="mk-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`btn ${f.id === filter ? 'sel' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <input
            id="market-search"
            className="mk-search"
            placeholder="Cerca pilota o squadra…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="mk-table">
          <table className="std">
            <thead>
              <tr>
                <th>Pilota</th>
                <th>Squadra</th>
                <th className="r">Età</th>
                <th className="r">Valut.</th>
                <th>Potenz.</th>
                <th className="r">Stipendio</th>
                <th>Scadenza</th>
                <th className="r">Clausola</th>
                <th className="r">Richiesta</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={r.id === current ? 'sel' : ''} onClick={() => setSelected(r.id)}>
                  <td>
                    <b>{r.name}</b>
                    <div className="muted" style={{ fontSize: '.72rem' }}>
                      <Flag code={r.nationality} size={0.8} /> · {r.category ?? '—'} · {RIDER_ROLE[r.role]}
                    </div>
                  </td>
                  <td>{r.team ?? <span className="ok">Libero</span>}</td>
                  <td className="r">{r.age}</td>
                  <td className={`r ${ratingTone(r.rating) ?? ''}`}>
                    <b>{r.rating}</b>
                  </td>
                  <td>
                    {r.potential[0]}–{r.potential[1]}
                  </td>
                  <td className="r">{r.salary !== null ? formatMoney(r.salary) : '—'}</td>
                  <td>{r.contractEnd ?? '—'}</td>
                  <td className="r">{r.buyout > 0 ? formatMoney(r.buyout) : '—'}</td>
                  <td className="r">{r.askingRange ? `${formatMoney(r.askingRange[0])}` : '—'}</td>
                  <td>
                    {r.own ? (
                      <span className="pill info">Tuo pilota</span>
                    ) : !r.eligible ? (
                      <span className="pill" title={r.ineligibleReason ?? ''}>
                        Non idoneo
                      </span>
                    ) : r.negotiation ? (
                      <span className={`pill ${NEG_LABEL[r.negotiation]!.cls}`}>
                        {NEG_LABEL[r.negotiation]!.text}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {current && <NegotiationPanel riderId={current} notify={notify} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
const toMln = (v: number) => (v / 1_000_000).toFixed(2).replace('.', ',');
const fromMln = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 1_000_000) : NaN;
};

function NegotiationPanel({
  riderId,
  notify,
}: {
  riderId: string;
  notify: (text: string, err?: boolean) => void;
}) {
  const q = useQuery('negotiationView', riderId);
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  return <NegotiationForm key={riderId} v={q.data} notify={notify} />;
}

function NegotiationForm({
  v,
  notify,
}: {
  v: NegotiationView;
  notify: (text: string, err?: boolean) => void;
}) {
  const r = v.rider;
  const suggested = r.askingRange
    ? Math.round((r.askingRange[0] + r.askingRange[1]) / 2 / 10_000) * 10_000
    : 100_000;
  const [salary, setSalary] = useState(toMln(suggested));
  const [years, setYears] = useState<1 | 2 | 3>(2);
  const [role, setRole] = useState<'race' | 'test'>('race');
  const [win, setWin] = useState('0,00');
  const [podium, setPodium] = useState('0,00');
  const vacant = v.ownSeats.some((s) => s.riderId === null);
  const [replace, setReplace] = useState<string>('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!vacant && !replace) setReplace(v.ownSeats[v.ownSeats.length - 1]?.riderId ?? '');
  }, [vacant, replace, v.ownSeats]);

  const last = v.rounds.at(-1);
  const salaryValue = fromMln(salary);
  const needsReplace = v.kind === 'transfer' && role === 'race' && !vacant;
  const canOffer =
    v.marketOpen &&
    r.eligible &&
    v.status !== 'rejected' &&
    Number.isFinite(salaryValue) &&
    salaryValue >= 0 &&
    v.status !== 'signed';

  async function run(action: () => Promise<{ type: string; payload: unknown }[]>) {
    setBusy(true);
    try {
      const events = await action();
      const ans = events.find((e) => e.type === 'OfferAnswered')?.payload as { message: string } | undefined;
      const ai = events.find((e) => e.type === 'AiRiderSigned');
      if (ans) notify(ans.message + (ai ? ' La squadra di provenienza ha ingaggiato un sostituto.' : ''));
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const offer = () =>
    run(() =>
      engine.dispatch({
        type: 'MakeOffer',
        riderId: r.id as RiderId,
        offer: {
          salary: salaryValue,
          years,
          role: v.kind === 'renewal' ? (r.role === 'test' ? 'test' : 'race') : role,
          winBonus: Math.max(0, fromMln(win) || 0),
          podiumBonus: Math.max(0, fromMln(podium) || 0),
          replaceRiderId: needsReplace ? ((replace || null) as RiderId | null) : null,
        },
      }),
    );

  return (
    <div className="detail">
      <Card>
        <div className="hero">
          <Helmet
            team={r.team ?? ''}
            colors={r.teamColors ?? { primary: '#6b6e75', secondary: '#3a3c42' }}
            number={r.number ?? null}
            size={6}
          />
          <div>
            <div className="nm">{r.name}</div>
            <div className="muted" style={{ fontSize: '.8rem', marginTop: '.3rem' }}>
              <FlagName code={r.nationality} size={0.9} /> · {r.age} anni · {r.team ?? 'senza contratto'}
              {r.category ? ` · ${r.category}` : ''}
            </div>
          </div>
        </div>
        <div className="mk-kpis">
          <div className="kpi">
            <small>Valutazione</small>
            <b className={ratingTone(r.rating)}>{r.rating}</b>
          </div>
          <div className="kpi">
            <small>Potenziale (stima)</small>
            <b>
              {r.potential[0]}–{r.potential[1]}
            </b>
          </div>
          <div className="kpi">
            <small>Richiesta stimata</small>
            <b>{r.askingRange ? `${toMln(r.askingRange[0])}–${toMln(r.askingRange[1])} mln` : '—'}</b>
          </div>
        </div>
      </Card>

      <Card title="Contratto attuale">
        {v.currentContract ? (
          <>
            <Row label="Squadra">{v.currentContract.team}</Row>
            <Row label="Stipendio annuo">
              <Money value={v.currentContract.salary} />
            </Row>
            <Row label="Scadenza">{v.currentContract.end}</Row>
            {v.currentContract.bonuses.map((b) => (
              <Row key={b.condition} label={b.condition === 'win' ? 'Bonus vittoria' : 'Bonus podio'}>
                <Money value={b.amount} />
              </Row>
            ))}
            {v.kind === 'transfer' && (
              <Row label="Clausola rescissoria">
                <Money value={r.buyout} />
              </Row>
            )}
          </>
        ) : (
          <p className="muted">Pilota senza contratto: nessuna clausola da pagare.</p>
        )}
      </Card>

      <Card
        title={v.kind === 'renewal' ? 'Proposta di rinnovo' : 'La tua offerta'}
        aside={`Saldo: ${formatMoney(v.balance)}`}
      >
        {!v.marketOpen && <p className="bad">Il mercato è chiuso: si riapre a fine stagione.</p>}
        {!r.eligible && <p className="warn">Non idoneo: {r.ineligibleReason}</p>}
        {v.status === 'signed' && <p className="ok">Trattativa conclusa: contratto firmato.</p>}
        {v.status === 'rejected' && (
          <p className="bad">Il pilota ha chiuso la trattativa. Potrai riprovare fra qualche settimana.</p>
        )}
        <div className="mk-form">
          <label className="field">
            <span>Stipendio annuo (mln €)</span>
            <input
              id="offer-salary"
              inputMode="decimal"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Durata</span>
            <select
              id="offer-years"
              value={years}
              onChange={(e) => setYears(Number(e.target.value) as 1 | 2 | 3)}
            >
              <option value={1}>1 anno</option>
              <option value={2}>2 anni</option>
              <option value={3}>3 anni</option>
            </select>
          </label>
          {v.kind === 'transfer' && (
            <label className="field">
              <span>Ruolo</span>
              <select
                id="offer-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'race' | 'test')}
              >
                <option value="race">Titolare</option>
                <option value="test">Collaudatore</option>
              </select>
            </label>
          )}
          <label className="field">
            <span>Bonus vittoria (mln €)</span>
            <input id="offer-win" inputMode="decimal" value={win} onChange={(e) => setWin(e.target.value)} />
          </label>
          <label className="field">
            <span>Bonus podio (mln €)</span>
            <input
              id="offer-podium"
              inputMode="decimal"
              value={podium}
              onChange={(e) => setPodium(e.target.value)}
            />
          </label>
          {needsReplace && (
            <label className="field">
              <span>Chi lascia il posto</span>
              <select id="offer-replace" value={replace} onChange={(e) => setReplace(e.target.value)}>
                {v.ownSeats.map((s) => (
                  <option key={s.riderId ?? s.number} value={s.riderId ?? ''}>
                    #{s.number} {s.name ?? 'posto libero'}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {needsReplace && (
          <p className="muted" style={{ fontSize: '.74rem' }}>
            Il pilota sostituito viene liberato con un'indennità pari al 50% dello stipendio residuo.
          </p>
        )}
        <div className="mk-actions">
          <button className="btn primary" disabled={!canOffer || busy} onClick={offer}>
            {busy ? '…' : v.open ? 'Invia nuova offerta' : 'Invia offerta'}
          </button>
          {v.open && last?.counter && (
            <button
              className="btn sel"
              disabled={busy}
              onClick={() =>
                run(() =>
                  engine.dispatch({
                    type: 'AcceptCounter',
                    riderId: r.id as RiderId,
                    replaceRiderId: needsReplace ? ((replace || null) as RiderId | null) : null,
                  }),
                )
              }
            >
              Accetta: {formatMoney(last.counter.salary)} × {last.counter.years}{' '}
              {last.counter.years === 1 ? 'anno' : 'anni'}
            </button>
          )}
          {v.open && (
            <button
              className="btn ghost"
              disabled={busy}
              onClick={() =>
                run(() => engine.dispatch({ type: 'WithdrawNegotiation', riderId: r.id as RiderId }))
              }
            >
              Chiudi trattativa
            </button>
          )}
        </div>
      </Card>

      {v.rounds.length > 0 && (
        <Card
          title="Storico della trattativa"
          aside={v.patience !== null && v.open ? `pazienza: ${Math.max(0, v.patience)}` : undefined}
        >
          {v.rounds.map((x, i) => (
            <div key={i} className="mk-round">
              <div className="t2" style={{ fontSize: '.74rem' }}>
                {x.day} · offerta {formatMoney(x.salary)} × {x.years} {x.years === 1 ? 'anno' : 'anni'} (
                {x.role === 'race' ? 'titolare' : 'collaudatore'})
              </div>
              <div className={x.response === 'accepted' ? 'ok' : x.response === 'rejected' ? 'bad' : 'or'}>
                {x.message}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
