import { Portrait } from '../../design-system/Portrait.tsx';
import { FlagName } from '../../design-system/Flag.tsx';
import { Helmet } from '../../design-system/Helmet.tsx';
import { formatMoney } from '@lean-angle/core';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Help, Pos, ratingTone } from '../../design-system/components.tsx';

import type { Section } from '../../shell/Shell.tsx';
import { Bike } from '../../design-system/Bike.tsx';

type Next = { label: string; hint: string; action: () => void } | null;

/** Home: cosa fare adesso, i tuoi piloti, la classifica, i soldi e le ultime notizie. */
export function Overview({ go, next }: { go: (s: Section) => void; next: Next }) {
  const sum = useQuery('careerSummary');
  const wk = useQuery('weekendView');
  const ch = useQuery('championship');
  const fin = useQuery('financeView');
  const news = useQuery('newsFeed', 'all', 5);
  const bq = useQuery('bikeView');
  const sq = useQuery('sponsorView');
  if (sum.status !== 'ready') return <div className="loading">Caricamento…</div>;
  const s = sum.data;
  const team = s.team!;
  const w = wk.status === 'ready' ? wk.data : null;
  const c = ch.status === 'ready' ? ch.data : null;
  const f = fin.status === 'ready' ? fin.data : null;
  const bike = bq.status === 'ready' ? bq.data : null;
  const sp = sq.status === 'ready' ? sq.data : null;
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

      {firstTime && (
        <Card title="Come si gioca" className="s12">
          <div className="howto">
            <div>
              <span>1</span>
              <b>Prepara la squadra</b>
              <p className="t2">
                Controlla i tuoi due piloti e, finché il campionato non parte, usa il mercato per migliorare
                la squadra.
              </p>
            </div>
            <div>
              <span>2</span>
              <b>Corri i Gran Premi</b>
              <p className="t2">
                Ogni weekend: qualifiche per l’ordine di partenza, poi scegli gomme e ritmo e guarda la gara
                dall’alto.
              </p>
            </div>
            <div>
              <span>3</span>
              <b>Fai quadrare i conti</b>
              <p className="t2">
                Sponsor e premi portano soldi, stipendi e trasferte li consumano. A fine anno rinnova i
                contratti e riparti.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="I tuoi piloti"
        aside={
          <button className="btn ghost" onClick={() => go('riders')}>
            Schede complete
          </button>
        }
        className="s8"
      >
        <RiderCards teamId={team.id} teamName={team.name} colors={team.colors} standings={c} />
      </Card>

      <Card
        title="La tua moto"
        aside={
          <button className="btn ghost" onClick={() => go('bike')}>
            Upgrade
          </button>
        }
        className="s4"
      >
        {bike ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.4rem' }}>
            <Bike
              team={bike.team}
              colors={bike.colors}
              number={bike.numbers[0] ?? null}
              levels={Object.fromEntries(bike.parts.map((p) => [p.key, p.level]))}
              partColors={Object.fromEntries(bike.parts.map((p) => [p.key, p.color]))}
              width={19}
            />
            <span className="muted">
              Qualità {bike.rating} · media avversarie {bike.rivalsAvg}
            </span>
          </div>
        ) : null}
      </Card>

      {sp?.windowOpen && (
        <div className="nextstep s12" style={{ marginBottom: 0 }}>
          <div className="what">
            <small>Prima del primo Gran Premio</small>
            <b>Scegli lo sponsor della stagione: più soldi in cambio di un obiettivo</b>
          </div>
          <button className="btn primary" onClick={() => go('sponsors')}>
            Vedi le offerte ▸
          </button>
        </div>
      )}

      <Card
        title="Classifica"
        aside={
          <button className="btn ghost" onClick={() => go('championship')}>
            Completa
          </button>
        }
        className="s5"
      >
        {!c || c.riders.length === 0 ? (
          <p className="muted">La classifica appare dopo la prima gara.</p>
        ) : (
          <table className="std static">
            <tbody>
              {c.riders.slice(0, 6).map((r, i) => (
                <tr key={r.riderId} className={r.teamId === c.myTeamId ? 'mine' : ''}>
                  <td style={{ width: '2.4rem' }}>
                    <Pos value={i + 1} />
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
        )}
      </Card>

      <Card
        title="Soldi"
        aside={
          <button className="btn ghost" onClick={() => go('finance')}>
            Finanze
          </button>
        }
        className="s3"
      >
        {f && (
          <>
            <div className="muted">In cassa</div>
            <div className="big" style={{ fontSize: '1.6rem', margin: '.2rem 0 .7rem' }}>
              {formatMoney(f.balance)}
            </div>
            <div className="row">
              <span className="muted">
                Ogni mese
                <Help>
                  Sponsor meno stipendi e costi di gestione. Premi e diritti TV arrivano dopo ogni gara.
                </Help>
              </span>
              <b className={f.monthly.net < 0 ? 'bad' : 'ok'}>
                {f.monthly.net >= 0 ? '+' : '−'}
                {formatMoney(Math.abs(f.monthly.net))}
              </b>
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

function RiderCards({
  teamId,
  teamName,
  colors,
  standings,
}: {
  teamId: string;
  teamName: string;
  colors: { primary: string; secondary: string };
  standings: { riders: { riderId: string; points: number }[] } | null;
}) {
  const q = useQuery('teamRiders', teamId as `tem_${string}`);
  const riders = q.status === 'ready' ? q.data.filter((r) => r.role === 'race') : [];
  if (q.status === 'ready' && riders.length === 0)
    return <p className="warn">Nessun pilota sotto contratto: vai al mercato.</p>;
  return (
    <div className="two-col">
      {riders.map((r) => {
        const pos = standings ? standings.riders.findIndex((x) => x.riderId === r.id) : -1;
        return (
          <div key={r.id} className="tile rider-tile">
            <span className="ghost-num">{r.number}</span>
            <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center' }}>
              <Portrait
                portrait={r.portrait}
                name={r.name}
                size={4.2}
                fallback={<Helmet team={teamName} colors={colors} size={5.2} />}
              />
              <div>
                <div className="display" style={{ fontSize: '1.2rem' }}>
                  {r.name}
                </div>
                <div className="muted" style={{ fontSize: '.85rem' }}>
                  <FlagName code={r.nationality} size={0.85} /> · {r.age} anni
                </div>
              </div>
            </div>
            <div className="rider-stats">
              <div>
                <small className="muted">Valutazione</small>
                <b className={ratingTone(r.rating)}>{r.rating}</b>
              </div>
              <div>
                <small className="muted">In classifica</small>
                <b>{pos >= 0 ? `${pos + 1}° · ${standings!.riders[pos]!.points} pt` : '—'}</b>
              </div>
              <div>
                <small className="muted">Contratto fino al</small>
                <b style={{ fontSize: '.9rem' }}>{r.contractEnd}</b>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
