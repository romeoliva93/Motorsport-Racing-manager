/**
 * Squadre e piloti della categoria, raggruppati per costruttore (scuderia): la squadra ufficiale e le squadre
 * clienti, con piloti, valutazione, punti e l'accordo di fornitura di ogni costruttore.
 */
import { useState } from 'react';
import type { TeamCard } from '@lean-angle/game';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Explain, Money, TeamBadge } from '../../design-system/components.tsx';
import { FlagName } from '../../design-system/Flag.tsx';
import { Portrait } from '../../design-system/Portrait.tsx';
import { Helmet } from '../../design-system/Helmet.tsx';
import { TEAM_TYPE } from '../../i18n/it.ts';
import './paddock.css';

const ORDER: Record<string, number> = { factory: 0, satellite: 1, independent: 2, private: 3 };

export function PaddockScreen({ categoryId, myTeamId }: { categoryId: string; myTeamId: string }) {
  const teams = useQuery('teamCards', categoryId);
  const offers = useQuery('supplierOffers', categoryId);
  const ch = useQuery('championship', categoryId);
  const [open, setOpen] = useState<string | null>(null);
  if (teams.status !== 'ready' || offers.status !== 'ready')
    return <div className="loading">Caricamento squadre…</div>;
  const st = ch.status === 'ready' ? ch.data : null;
  const riderPts = new Map(st?.riders.map((r, i) => [r.riderId, { pts: r.points, pos: i + 1 }]) ?? []);
  const teamPts = new Map(st?.teams.map((t, i) => [t.teamId, { pts: t.points, pos: i + 1 }]) ?? []);
  const mfrPts = new Map(
    st?.constructors.map((c, i) => [c.manufacturerId, { pts: c.points, pos: i + 1 }]) ?? [],
  );
  const groups = offers.data
    .map((o) => ({
      offer: o,
      teams: teams.data
        .filter((t) => t.manufacturerId === o.manufacturerId)
        .sort((a, b) => (ORDER[a.type] ?? 9) - (ORDER[b.type] ?? 9) || b.reputation - a.reputation),
    }))
    .filter((g) => g.teams.length > 0);

  return (
    <div className="paddock">
      <Explain>
        Ogni scuderia (costruttore) ha la sua squadra ufficiale e fornisce le moto alle squadre clienti
        (satellite, indipendenti, private). Le squadre clienti pagano un canone e ricevono le agevolazioni
        indicate. Clicca una squadra per vederne i piloti.
      </Explain>
      {groups.map(({ offer, teams: list }) => {
        const mp = mfrPts.get(offer.manufacturerId);
        return (
          <Card
            key={offer.manufacturerId}
            title={offer.name}
            aside={mp ? `${mp.pos}° scuderia · ${mp.pts} punti` : `livello tecnico ${offer.strength}`}
          >
            <div className="pd-deal">
              <FlagName code={offer.country} size={0.85} />
              <span>
                Livello tecnico <b>{offer.strength}</b>
              </span>
              <span className="or">{offer.headline}</span>
              {offer.perks.map((p) => (
                <span key={p} className="pill">
                  {p}
                </span>
              ))}
              {offer.feeYearly > 0 && (
                <span className="muted">
                  Canone clienti <Money value={offer.feeYearly} />
                  /anno
                </span>
              )}
            </div>
            <div className="pd-teams">
              {list.map((t) => (
                <TeamBlock
                  key={t.id}
                  t={t}
                  mine={t.id === myTeamId}
                  open={open === t.id}
                  onToggle={() => setOpen(open === t.id ? null : t.id)}
                  pts={teamPts.get(t.id)}
                  riderPts={riderPts}
                />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TeamBlock({
  t,
  mine,
  open,
  onToggle,
  pts,
  riderPts,
}: {
  t: TeamCard;
  mine: boolean;
  open: boolean;
  onToggle: () => void;
  pts: { pts: number; pos: number } | undefined;
  riderPts: Map<string, { pts: number; pos: number }>;
}) {
  return (
    <div
      className={`pd-team ${t.type} ${mine ? 'mine' : ''}`}
      style={{ ['--tc' as string]: t.colors.primary }}
    >
      <button className="pd-head" onClick={onToggle} aria-expanded={open}>
        <TeamBadge colors={t.colors} short={t.shortName} size={2.4} />
        <span className="pd-name">
          <b>{t.name}</b>
          <small className="muted">
            {TEAM_TYPE[t.type]} · {t.baseCity}
            {mine ? ' · la tua squadra' : ''}
          </small>
        </span>
        <span className="pd-pts">
          {pts ? (
            <>
              <b>{pts.pts}</b>
              <small>{pts.pos}° team</small>
            </>
          ) : (
            <small className="muted">—</small>
          )}
        </span>
        <span className="pd-riders-mini">
          {t.riders.map((r) => (
            <span key={r.id}>
              #{r.number} {r.name.split(' ').slice(-1)[0]}
            </span>
          ))}
        </span>
      </button>
      {open && (
        <div className="pd-riders">
          {t.riders.length === 0 && <p className="muted">Nessun pilota sotto contratto.</p>}
          {t.riders.map((r) => {
            const rp = riderPts.get(r.id);
            return (
              <div key={r.id} className="pd-rider">
                <Portrait
                  portrait={r.portrait}
                  name={r.name}
                  size={3.2}
                  fallback={<Helmet team={t.name} colors={t.colors} size={3.6} />}
                />
                <div>
                  <b>
                    #{r.number} {r.name}
                  </b>
                  <div className="muted">
                    <FlagName code={r.nationality} size={0.8} /> · {r.age} anni
                  </div>
                </div>
                <div className="pd-stat">
                  <small>Valutazione</small>
                  <b>{r.rating}</b>
                </div>
                <div className="pd-stat">
                  <small>Campionato</small>
                  <b>{rp ? `${rp.pos}° · ${rp.pts} pt` : '—'}</b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
