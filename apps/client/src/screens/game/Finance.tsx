import { useState } from 'react';
import { formatMoney } from '@lean-angle/core';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Money } from '../../design-system/components.tsx';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function FinanceScreen() {
  const q = useQuery('financeView');
  if (q.status !== 'ready' || !q.data) return <div className="loading">Caricamento…</div>;
  const f = q.data;
  return (
    <div className="grid12">
      <Card title="Soldi in cassa" className="s4 accent">
        <div className="big">
          <Money value={f.balance} />
        </div>
        <p className="t2" style={{ marginBottom: 0 }}>
          Previsione a fine anno:{' '}
          <b className={f.forecastYearEnd < 0 ? 'bad' : ''}>{formatMoney(f.forecastYearEnd)}</b>
          <Help>
            Saldo di oggi + entrate e uscite fisse dei prossimi mesi + diritti TV meno trasferte delle{' '}
            {f.racesLeft} gare rimaste. I premi non sono inclusi: dipendono dai risultati.
          </Help>
        </p>
      </Card>
      <Card title="Ogni mese" aside="il 1° del mese" className="s4">
        <div className="row">
          <span className="muted">Sponsor</span>
          <b className="ok">+{formatMoney(f.monthly.sponsor)}</b>
        </div>
        <div className="row">
          <span className="muted">Stipendi piloti e staff</span>
          <b>−{formatMoney(f.monthly.salaries)}</b>
        </div>
        <div className="row">
          <span className="muted">Gestione (sede, officina, ricambi)</span>
          <b>−{formatMoney(f.monthly.running)}</b>
        </div>
        <div className="row">
          <span>Saldo mensile</span>
          <b className={f.monthly.net < 0 ? 'bad' : 'ok'}>
            {f.monthly.net >= 0 ? '+' : ''}
            {formatMoney(f.monthly.net)}
          </b>
        </div>
      </Card>
      <Card title="Ogni Gran Premio" className="s4">
        <div className="row">
          <span className="muted">Diritti TV e commerciali</span>
          <b className="ok">+{formatMoney(f.perRace.rights)}</b>
        </div>
        <div className="row">
          <span className="muted">Trasferta e logistica</span>
          <b>−{formatMoney(f.perRace.travel)}</b>
        </div>
        <div className="row">
          <span className="muted">Premio per ogni punto</span>
          <b className="ok">+{formatMoney(f.perRace.prizePerPoint)}</b>
        </div>
        <div className="row">
          <span className="muted">Gare rimaste</span>
          <b>{f.racesLeft}</b>
        </div>
      </Card>
      <Card title="Andamento della cassa" aside="saldo a fine mese, anno in corso" className="s7">
        <BalanceChart data={f.history} />
      </Card>
      <Card title="Entrate e uscite dell’anno" className="s5">
        {f.byCategory.length === 0 && <p className="muted">Ancora nessun movimento quest’anno.</p>}
        {f.byCategory.map((c) => (
          <div key={c.category} className="row">
            <span className="muted">{c.label}</span>
            <b className={c.amount < 0 ? '' : 'ok'}>
              {c.amount >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(c.amount))}
            </b>
          </div>
        ))}
      </Card>
      <Card title="Movimenti" aside="gli ultimi 60" className="s12">
        <Explain style={{ marginBottom: '.8rem' }}>
          Ogni euro qui è reale: il saldo è la somma di tutti i movimenti dall’inizio della carriera.
        </Explain>
        <div style={{ overflowX: 'auto' }}>
          <table className="std static">
            <thead>
              <tr>
                <th>Data</th>
                <th>Voce</th>
                <th>Dettaglio</th>
                <th className="r">Importo</th>
              </tr>
            </thead>
            <tbody>
              {f.movements.map((m, i) => (
                <tr key={i}>
                  <td className="t2">{m.date}</td>
                  <td>{m.label}</td>
                  <td className="muted">{m.note}</td>
                  <td className={`r ${m.amount < 0 ? '' : 'ok'}`}>
                    {m.amount >= 0 ? '+' : '−'}
                    {formatMoney(Math.abs(m.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {f.movements.length === 0 && (
            <p className="muted">Nessun movimento ancora: il primo arriva il 1° del mese.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Barre sottili del saldo a fine mese; passando sopra una barra si legge il valore. */
function BalanceChart({ data }: { data: { month: number; balance: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <p className="muted">Il grafico si riempie mese dopo mese.</p>;
  const max = Math.max(...data.map((d) => d.balance), 1);
  const min = Math.min(0, ...data.map((d) => d.balance));
  const H = 160,
    W = 600,
    bw = W / 12;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const shown = hover !== null ? data[hover]! : data[data.length - 1]!;
  return (
    <div>
      <div className="t2" style={{ marginBottom: '.4rem', minHeight: '1.4em' }}>
        {MONTHS[shown.month - 1]}: <b style={{ color: 'var(--text-1)' }}>{formatMoney(shown.balance)}</b>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H + 22}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="Saldo a fine mese"
      >
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" />
        {data.map((d, i) => {
          const top = Math.min(y(d.balance), y(0));
          const h = Math.max(2, Math.abs(y(d.balance) - y(0)));
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * bw} y={0} width={bw} height={H + 22} fill="transparent" />
              <rect
                x={i * bw + bw * 0.3}
                y={top}
                width={bw * 0.4}
                height={h}
                rx="4"
                fill={d.balance < 0 ? 'var(--bad)' : 'var(--team)'}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              <text x={i * bw + bw / 2} y={H + 16} textAnchor="middle" fontSize="12" fill="var(--text-3)">
                {MONTHS[d.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
