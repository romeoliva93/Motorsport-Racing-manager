import { Portrait } from '../../design-system/Portrait.tsx';
import { FlagName } from '../../design-system/Flag.tsx';
import { WeatherIcon, SKY_LABEL } from '../../design-system/WeatherIcon.tsx';
import { TrackMap } from './Weekend.tsx';
import type { Sky } from '@lean-angle/game';
import { Helmet } from '../../design-system/Helmet.tsx';
import { formatMoney } from '@lean-angle/core';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Pos, ratingTone } from '../../design-system/components.tsx';

import type { Section } from '../../shell/Shell.tsx';
import type { BikeTier } from '../../design-system/BikeArt.tsx';
import { TeamBike } from '../../design-system/TeamBike.tsx';

type Next = { label: string; hint: string; action: () => void } | null;

/** Home (dashboard): prossimo GP, attività, piloti, moto, classifica o preparazione, finanze, notizie. */
export function Overview({ go, next }: { go: (s: Section) => void; next: Next }) {
  const sum = useQuery('careerSummary');
  const wk = useQuery('weekendView');
  const dq = useQuery('dashboardView');
  const news = useQuery('newsFeed', 'all', 5);
  const bq = useQuery('bikeView');
  if (sum.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const s = sum.data;
  const team = s.team!;
  const w = wk.status === 'ready' ? wk.data : null;
  const d = dq.status === 'ready' ? dq.data : null;
  const bike = bq.status === 'ready' ? bq.data : null;
  const firstTime = s.roundsDone === 0;
  const empty = 2 - team.riders.length;

  return (
    <div className="grid12">
      <div className="nextstep s12">
        <div className="what">
          <small>Cosa fare adesso</small>
          <b>
            {empty > 0
              ? `Ti ${empty === 2 ? 'mancano due piloti' : 'manca un pilota'}: ingaggiali dal mercato`
              : w?.state === 'today'
                ? `Oggi si corre a ${w.round!.circuit}`
                : w?.state === 'seasonOver'
                  ? 'La stagione è finita: guarda com’è andata'
                  : w?.round
                    ? `Prossimo: Gran Premio ${w.round.number} a ${w.round.circuit}`
                    : 'Continua la carriera'}
          </b>
          {w?.round && w.state === 'upcoming' && (
            <span className="t2">
              <FlagName code={w.round.country} size={0.9} /> · {w.round.date} · tra {w.round.inDays} giorni
            </span>
          )}
        </div>
        {empty > 0 ? (
          <button className="btn primary big-cta" onClick={() => go('market')}>
            Vai al mercato ▸
          </button>
        ) : (
          next && (
            <button className="btn primary big-cta" onClick={next.action}>
              {next.label} ▸
            </button>
          )
        )}
      </div>

      {d?.nextGp && (
        <Card title={`Gran Premio ${d.nextGp.number} di ${d.nextGp.total}`} className="s8 accent">
          <div className="dash-gp">
            {d.nextGp.track && <TrackMap points={d.nextGp.track} size={11} />}
            <div className="dash-gp-main">
              <b className="dash-gp-name">{d.nextGp.circuit}</b>
              <span className="t2">
                <FlagName code={d.nextGp.country} size={0.9} /> · {d.nextGp.date} ·{' '}
                {d.nextGp.today ? <b className="or">si corre oggi</b> : `tra ${d.nextGp.inDays} giorni`}
              </span>
              <div className="dash-facts">
                <span>
                  <small>Lunghezza</small>
                  <b>{d.nextGp.lengthKm.toString().replace('.', ',')} km</b>
                </span>
                <span>
                  <small>Curve</small>
                  <b>{d.nextGp.turns}</b>
                </span>
                <span>
                  <small>Giri gara</small>
                  <b>{d.nextGp.laps}</b>
                </span>
                {d.nextGp.forecast && (
                  <span className="dash-weather" title="Previsione per la gara">
                    <WeatherIcon sky={d.nextGp.forecast.sky as Sky} size={1.6} />
                    <span>
                      <small>Previsione gara</small>
                      <b>
                        {SKY_LABEL[d.nextGp.forecast.sky as Sky]} · {d.nextGp.forecast.airTemp}° aria ·{' '}
                        {d.nextGp.forecast.trackTemp}° asfalto · pioggia {d.nextGp.forecast.rainChance}%
                      </b>
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card title="Da fare" className={d?.nextGp ? 's4' : 's12'}>
        {!d || d.tasks.length === 0 ? (
          <p className="muted">Nessuna attività in sospeso: la squadra è pronta.</p>
        ) : (
          <ul className="dash-tasks">
            {d.tasks.map((t, i) => (
              <li key={i} className={t.tone}>
                <button onClick={() => go(t.section as Section)}>
                  <span>{t.text}</span>
                  <b>▸</b>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="I tuoi piloti"
        aside={
          <button className="btn ghost" onClick={() => go('riders')}>
            Schede complete
          </button>
        }
        className="s8"
      >
        {d && d.riders.length === 0 && <p className="warn">Nessun pilota sotto contratto: vai al mercato.</p>}
        <div className="two-col">
          {d?.riders.map((r) => (
            <div key={r.id} className="tile rider-tile">
              <span className="ghost-num">{r.number}</span>
              <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center' }}>
                <Portrait
                  portrait={r.portrait}
                  name={r.name}
                  size={4.2}
                  fallback={<Helmet team={team.name} colors={team.colors} size={5.2} />}
                />
                <div>
                  <div className="display" style={{ fontSize: '1.2rem' }}>
                    {r.name}
                  </div>
                  <div className="muted" style={{ fontSize: '.85rem' }}>
                    <FlagName code={r.nationality} size={0.85} />
                  </div>
                </div>
              </div>
              <div className="rider-stats">
                <div>
                  <small className="muted">Valutazione</small>
                  <b className={ratingTone(r.rating)}>{r.rating}</b>
                </div>
                <div>
                  <small className="muted">Morale</small>
                  <b className={r.morale >= 65 ? 'ok' : r.morale >= 45 ? '' : 'warn'}>{r.morale}</b>
                </div>
                <div>
                  <small className="muted">Campionato</small>
                  <b>{r.position ? `${r.position}° · ${r.points} pt` : '—'}</b>
                </div>
                <div>
                  <small className="muted">Ultima gara</small>
                  <b style={{ fontSize: '.9rem' }}>
                    {r.lastResult
                      ? `${r.lastResult.position ? `${r.lastResult.position}°` : 'ritirato'} · ${r.lastResult.circuit}`
                      : '—'}
                  </b>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="La tua moto"
        aside={
          <button className="btn ghost" onClick={() => go('bike')}>
            Garage
          </button>
        }
        className="s4"
      >
        {bike && d?.bike ? (
          <div className="dash-bike">
            <TeamBike
              team={bike.team}
              tier={bike.tier as BikeTier}
              colors={bike.colors}
              number={bike.numbers[0] ?? null}
              width={22}
            />
            <div className="row">
              <span className="muted">Affidabilità in gara</span>
              <b className={d.bike.reliability >= 90 ? 'ok' : d.bike.reliability >= 82 ? 'warn' : 'bad'}>
                {d.bike.reliability.toString().replace('.', ',')}%
              </b>
            </div>
            <div className="row">
              <span className="muted">Qualità / avversarie</span>
              <b>
                {bike.rating} / {bike.rivalsAvg}
              </b>
            </div>
            {d.bike.critical.slice(0, 2).map((c) => (
              <div key={c.name + c.rider + c.slot} className="row">
                <span className="warn">
                  {c.name} · moto {c.slot} {c.rider.split(' ').at(-1)}
                </span>
                <b className="warn">{c.condition}%</b>
              </div>
            ))}
            {d.bike.inProduction.slice(0, 2).map((p) => (
              <div key={p.part} className="row">
                <span className="info">
                  {p.part} liv. {p.level} in arrivo
                </span>
                <b>{p.ready}</b>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card
        title={d?.standings ? 'Classifica' : 'Preparazione alla stagione'}
        aside={
          d?.standings ? (
            <button className="btn ghost" onClick={() => go('championship')}>
              Completa
            </button>
          ) : undefined
        }
        className="s5"
      >
        {d?.standings ? (
          <table className="std static">
            <tbody>
              {d.standings.map((r) => (
                <tr key={r.position} className={r.mine ? 'mine' : ''}>
                  <td style={{ width: '2.4rem' }}>
                    <Pos value={r.position} />
                  </td>
                  <td>
                    <span className="swatch" style={{ background: r.color }} />
                    {r.name}
                  </td>
                  <td className="r">
                    <b>{r.points}</b> <span className="muted">pt</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="dash-prep">
            {d?.preparation?.map((p) => (
              <li key={p.text} className={p.done ? 'ok' : ''}>
                <span>{p.done ? '✓' : '○'}</span> {p.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Finanze"
        aside={
          <button className="btn ghost" onClick={() => go('finance')}>
            Dettagli
          </button>
        }
        className="s3"
      >
        {d?.finance && (
          <>
            <div className="muted">In cassa</div>
            <div className="big" style={{ fontSize: '1.6rem', margin: '.2rem 0 .6rem' }}>
              {formatMoney(d.finance.balance)}
            </div>
            <div className="row">
              <span className="muted">Entrate al mese</span>
              <b className="ok">+{formatMoney(d.finance.income)}</b>
            </div>
            <div className="row">
              <span className="muted">
                Uscite al mese
                <Help>Stipendi e costi di gestione. Premi e diritti TV arrivano dopo ogni gara.</Help>
              </span>
              <b className="bad">−{formatMoney(d.finance.expenses)}</b>
            </div>
            <div className="row">
              <span className="muted">Sponsor</span>
              <b>{d.finance.sponsor ?? <span className="warn">da scegliere</span>}</b>
            </div>
          </>
        )}
      </Card>

      <Card
        title="Ultime notizie"
        aside={
          <button className="btn ghost" onClick={() => go('news')}>
            Tutte
          </button>
        }
        className="s4"
      >
        {news.status === 'ready' && news.data.length === 0 && (
          <p className="muted">Le notizie arrivano con le gare e il mercato.</p>
        )}
        {news.status === 'ready' &&
          news.data.slice(0, 4).map((n) => (
            <div key={n.id} className="row" style={{ display: 'block' }}>
              <div className="muted" style={{ fontSize: '.78rem' }}>
                {n.date}
              </div>
              <div className={n.mine ? '' : 't2'} style={{ fontWeight: n.mine ? 600 : 400 }}>
                {n.title}
              </div>
            </div>
          ))}
      </Card>

      {firstTime && (
        <div className="s12">
          <Explain>
            Valutazioni da 1 a 99: <b className="ok">75+</b> ottimo, <b>60–74</b> buono,{' '}
            <b className="warn">45–59</b> discreto, sotto è debole. Il potenziale (quanto può crescere un
            giovane) è una stima dei tuoi osservatori.
          </Explain>
        </div>
      )}
    </div>
  );
}
