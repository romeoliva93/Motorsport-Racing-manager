import { useEffect, useMemo, useState } from 'react';
import type { CategoryTab, TeamCard } from '@lean-angle/game';
import { engine } from '../engine/engine.ts';
import { useQuery } from '../engine/hooks.ts';
import type { AppScreen } from '../App.tsx';
import { Card, Money, Monogram, Row, TeamBadge, ratingTone } from '../design-system/components.tsx';
import { TEAM_TYPE, country } from '../i18n/it.ts';
import './newCareer.css';

const TYPE_HINT: Record<string, string> = {
  factory: 'Rappresenta il costruttore: budget alto, sviluppo completo, aspettative elevate.',
  satellite: 'Usa moto e assistenza tecnica di un costruttore: buon equilibrio fra risorse e pressione.',
  independent: 'Maggiore autonomia gestionale, risorse più limitate.',
  private: 'Budget contenuto e maggiori limitazioni tecniche: la sfida più difficile.',
};

const randomSeed = () => Math.random().toString(36).slice(2, 10);
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'carriera';

export function NewCareer({ go }: { go: (s: AppScreen) => void }) {
  const [seed, setSeed] = useState(randomSeed);
  const [name, setName] = useState('La mia carriera');
  const [ready, setReady] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setTeamId(null);
    engine.previewWorld(seed).then(
      () => setReady(true),
      (e: Error) => setError(e.message),
    );
  }, [seed]);

  const cats = useQuery('categories');
  const categoriesList: CategoryTab[] = ready && cats.status === 'ready' ? cats.data : [];
  const activeCat = categoryId ?? categoriesList.find((c) => c.tier === 'premier')?.id ?? null;

  async function start() {
    if (!teamId) return;
    setBusy(true);
    try {
      await engine.newCareer(seed, name.trim() || 'La mia carriera', teamId);
      const slot = slug(name);
      await engine.save(slot);
      go({ name: 'game', slot });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="nc">
      <header className="nc-head">
        <button className="btn ghost" onClick={() => go({ name: 'menu' })}>
          ◂ Menu principale
        </button>
        <h1 className="display">Nuova carriera</h1>
        <div className="spacer" />
        <label className="field">
          <span>Nome della carriera</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Seme del mondo</span>
          <span style={{ display: 'flex', gap: '.4rem' }}>
            <input
              value={seed}
              maxLength={32}
              onChange={(e) => setSeed(e.target.value.trim() || randomSeed())}
              style={{ width: '9rem' }}
            />
            <button className="btn" onClick={() => setSeed(randomSeed())} title="Genera un mondo diverso">
              Casuale
            </button>
          </span>
        </label>
      </header>

      <div className="nc-tabs">
        {categoriesList.map((c) => (
          <button
            key={c.id}
            className={`btn ${c.id === activeCat ? 'sel' : ''}`}
            disabled={!c.managed}
            onClick={() => {
              setCategoryId(c.id);
              setTeamId(null);
            }}
            title={
              c.managed
                ? undefined
                : "Competizione gestita dall'organizzatore: i suoi piloti si seguono tramite l'accademia"
            }
          >
            {c.name}{' '}
            <span className="muted">
              · {c.bikesPerRider === 2 ? 'Moto A/B' : '1 moto'} · {c.rounds} round
            </span>
          </button>
        ))}
      </div>

      <div className="nc-body">
        {activeCat && ready ? (
          <TeamGrid categoryId={activeCat} selected={teamId} onSelect={setTeamId} />
        ) : (
          <div className="loading">Generazione del mondo…</div>
        )}
        <SelectedTeam categoryId={activeCat} teamId={teamId} ready={ready} busy={busy} onStart={start} />
      </div>
      {error && <div className="toast err">{error}</div>}
    </div>
  );
}

function TeamGrid({
  categoryId,
  selected,
  onSelect,
}: {
  categoryId: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const q = useQuery('teamCards', categoryId);
  if (q.status !== 'ready')
    return <div className="loading">{q.status === 'error' ? q.error : 'Caricamento squadre…'}</div>;
  return (
    <div className="nc-grid">
      {q.data.map((t) => (
        <button
          key={t.id}
          className={`nc-team ${t.id === selected ? 'sel' : ''}`}
          onClick={() => onSelect(t.id)}
          style={{ ['--tc' as string]: t.colors.primary }}
        >
          <div className="stripe" />
          <div className="head">
            <TeamBadge colors={t.colors} short={t.shortName} size={2.6} />
            <div>
              <b>{t.name}</b>
              <span className="muted">
                {TEAM_TYPE[t.type]} · {t.manufacturer}
              </span>
            </div>
          </div>
          <div className="riders">
            {t.riders.map((r) => (
              <span key={r.id}>
                <i>#{r.number}</i> {r.name} <em className={ratingTone(r.rating)}>{r.rating}</em>
              </span>
            ))}
          </div>
          <div className="foot">
            <span>
              Budget <b>{t.balance !== null ? <Money value={t.balance} /> : '—'}</b>
            </span>
            <span>
              Reputazione <b>{t.reputation}</b>
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function SelectedTeam({
  categoryId,
  teamId,
  ready,
  busy,
  onStart,
}: {
  categoryId: string | null;
  teamId: string | null;
  ready: boolean;
  busy: boolean;
  onStart: () => void;
}) {
  const q = useQuery('teamCards', categoryId ?? '');
  const team: TeamCard | undefined = useMemo(
    () => (q.status === 'ready' ? q.data.find((t) => t.id === teamId) : undefined),
    [q, teamId],
  );
  if (!team) {
    return (
      <Card title="Scegli una squadra" className="nc-side">
        <p className="muted" style={{ fontSize: '.85rem', lineHeight: 1.5 }}>
          Seleziona la scuderia che vuoi guidare. Budget, piloti e reputazione sono quelli del mondo generato
          dal seme: cambiando seme ottieni un mondo diverso.
        </p>
      </Card>
    );
  }
  return (
    <div className="nc-side">
      <Card>
        <div className="hero" style={{ marginBottom: '.8rem' }}>
          <TeamBadge colors={team.colors} short={team.shortName} size={3.6} />
          <div>
            <div className="nm" style={{ fontSize: '1.4rem' }}>
              {team.name}
            </div>
            <div className="muted" style={{ fontSize: '.8rem' }}>
              {country(team.nationality)} · {team.baseCity} · dal {team.founded}
            </div>
          </div>
        </div>
        <Row label="Tipologia">{TEAM_TYPE[team.type]}</Row>
        <Row label="Costruttore">{team.manufacturer}</Row>
        <Row label="Proprietà">{team.ownerName}</Row>
        <Row label="Budget iniziale">{team.balance !== null ? <Money value={team.balance} /> : '—'}</Row>
        <Row label="Reputazione">{team.reputation}</Row>
        <p className="muted" style={{ fontSize: '.78rem', lineHeight: 1.45 }}>
          {TYPE_HINT[team.type]}
        </p>
      </Card>
      <Card title="Piloti">
        {team.riders.map((r) => (
          <div key={r.id} className="row" style={{ justifyContent: 'flex-start', gap: '.7rem' }}>
            <Monogram name={r.name} color={team.colors.primary} size={2.2} />
            <span style={{ flex: 1 }}>
              <b>
                #{r.number} {r.name}
              </b>
              <br />
              <span className="muted">
                {country(r.nationality)} · {r.age} anni
              </span>
            </span>
            <b className={ratingTone(r.rating)}>{r.rating}</b>
          </div>
        ))}
      </Card>
      <button className="btn primary" disabled={!ready || busy} onClick={onStart}>
        {busy ? 'Creazione…' : 'Inizia la carriera ▸'}
      </button>
    </div>
  );
}
