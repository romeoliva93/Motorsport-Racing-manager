import { useEffect, useMemo, useState } from 'react';
import type { CategoryTab, CreateTeamOptionsView, TeamCard } from '@lean-angle/game';
import type { ManufacturerId } from '@lean-angle/data';
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

/** Il mondo di ogni carriera è generato in modo casuale (il seme resta interno al salvataggio). */
const newSeed = () => Math.random().toString(36).slice(2, 10);
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'carriera';

export type CareerMode = 'existing' | 'create';

export function NewCareer({
  go,
  initialMode = 'existing',
}: {
  go: (s: AppScreen) => void;
  initialMode?: CareerMode;
}) {
  const [seed] = useState(newSeed);
  const [mode, setMode] = useState<CareerMode>(initialMode);
  const [name, setName] = useState('La mia carriera');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    engine.previewWorld(seed).then(
      () => setReady(true),
      (e: Error) => setError(e.message),
    );
  }, [seed]);

  async function startWith(run: () => Promise<unknown>, section: 'overview' | 'market') {
    setBusy(true);
    setError(null);
    try {
      await engine.newCareer(seed, name.trim() || 'La mia carriera');
      await run();
      const slot = slug(name);
      await engine.save(slot);
      go({ name: 'game', slot, section });
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
        <div className="nc-mode" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'existing'}
            className={`btn ${mode === 'existing' ? 'sel' : ''}`}
            onClick={() => setMode('existing')}
          >
            Scegli una squadra
          </button>
          <button
            role="tab"
            aria-selected={mode === 'create'}
            className={`btn ${mode === 'create' ? 'sel' : ''}`}
            onClick={() => setMode('create')}
          >
            Crea la tua squadra
          </button>
        </div>
        <div className="spacer" />
        <label className="field">
          <span>Nome della carriera</span>
          <input id="career-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
      </header>
      {!ready ? (
        <div className="loading">Preparazione del mondo di gioco…</div>
      ) : mode === 'existing' ? (
        <ChooseTeam
          busy={busy}
          onStart={(teamId) =>
            startWith(
              () => engine.dispatch({ type: 'SetPlayerTeam', teamId: teamId as `tem_${string}` }),
              'overview',
            )
          }
        />
      ) : (
        <CreateTeam
          busy={busy}
          onStart={(team) => startWith(() => engine.dispatch({ type: 'CreateTeam', team }), 'market')}
        />
      )}
      {error && <div className="toast err">{error}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function ChooseTeam({ busy, onStart }: { busy: boolean; onStart: (teamId: string) => void }) {
  const cats = useQuery('categories');
  const list: CategoryTab[] = cats.status === 'ready' ? cats.data : [];
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const activeCat = categoryId ?? list.find((c) => c.tier === 'premier')?.id ?? null;
  return (
    <>
      <div className="nc-tabs">
        {list.map((c) => (
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
        {activeCat ? (
          <TeamGrid categoryId={activeCat} selected={teamId} onSelect={setTeamId} />
        ) : (
          <div className="loading">Caricamento…</div>
        )}
        <SelectedTeam
          categoryId={activeCat}
          teamId={teamId}
          busy={busy}
          onStart={() => teamId && onStart(teamId)}
        />
      </div>
    </>
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
  busy,
  onStart,
}: {
  categoryId: string | null;
  teamId: string | null;
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
          Seleziona la scuderia che vuoi guidare. Prima dell'inizio del campionato potrai trattare con tutti i
          piloti dal Mercato.
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
      <button className="btn primary" disabled={busy} onClick={onStart}>
        {busy ? 'Creazione…' : 'Inizia la carriera ▸'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
type Tier = CreateTeamOptionsView['categories'][number]['tier'];
type CustomType = 'private' | 'independent' | 'satellite';

function CreateTeam({
  busy,
  onStart,
}: {
  busy: boolean;
  onStart: (team: {
    name: string;
    shortName: string;
    nationality: string;
    baseCity: string;
    colors: { primary: string; secondary: string };
    type: CustomType;
    tier: Tier;
    manufacturerId: ManufacturerId;
  }) => void;
}) {
  const q = useQuery('createTeamOptions');
  const [teamName, setTeamName] = useState('');
  const [shortName, setShortName] = useState('');
  const [nationality, setNationality] = useState('ITA');
  const [city, setCity] = useState('');
  const [primary, setPrimary] = useState('#e5322d');
  const [secondary, setSecondary] = useState('#14171f');
  const [tier, setTier] = useState<Tier>('premier');
  const [type, setType] = useState<CustomType>('independent');
  const [mfr, setMfr] = useState<string | null>(null);
  if (q.status !== 'ready')
    return <div className="loading">{q.status === 'error' ? q.error : 'Caricamento…'}</div>;
  const cat = q.data.categories.find((c) => c.tier === tier)!;
  const manufacturer = cat.manufacturers.find((m) => m.id === mfr) ?? cat.manufacturers[0]!;
  const typeOpt = cat.types.find((t) => t.type === type) ?? cat.types[0]!;
  const autoShort = (
    teamName
      .replace(/[^A-Za-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('') || teamName.slice(0, 3)
  )
    .toUpperCase()
    .slice(0, 4);
  const sigla = (shortName || autoShort).toUpperCase();
  const valid = teamName.trim().length >= 3 && /^[A-Z0-9]{2,4}$/.test(sigla) && city.trim().length >= 2;

  return (
    <div className="nc-body">
      <div className="nc-form">
        <Card title="Identità">
          <div className="form-grid">
            <label className="field">
              <span>Nome della squadra</span>
              <input
                id="team-name"
                value={teamName}
                maxLength={40}
                placeholder="Es. Racing Team Vesuvio"
                onChange={(e) => setTeamName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Sigla (2–4)</span>
              <input
                id="team-short"
                value={sigla}
                maxLength={4}
                onChange={(e) => setShortName(e.target.value.toUpperCase())}
              />
            </label>
            <label className="field">
              <span>Nazionalità</span>
              <select id="team-nat" value={nationality} onChange={(e) => setNationality(e.target.value)}>
                {q.data.nationalities.map((n) => (
                  <option key={n} value={n}>
                    {country(n)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Sede</span>
              <input
                id="team-city"
                value={city}
                maxLength={30}
                placeholder="Città"
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Colore principale</span>
              <input id="team-c1" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            </label>
            <label className="field">
              <span>Colore secondario</span>
              <input
                id="team-c2"
                type="color"
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
              />
            </label>
          </div>
        </Card>
        <Card title="Categoria">
          <div className="choice-row">
            {q.data.categories.map((c) => (
              <button
                key={c.tier}
                className={`btn ${c.tier === tier ? 'sel' : ''}`}
                onClick={() => {
                  setTier(c.tier);
                  setMfr(null);
                  if (!c.types.some((t) => t.type === type)) setType(c.types[0]!.type);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Tipologia di squadra">
          <div className="choice-cards">
            {cat.types.map((t) => (
              <button
                key={t.type}
                className={`choice ${t.type === typeOpt.type ? 'sel' : ''}`}
                onClick={() => setType(t.type)}
              >
                <b>{TEAM_TYPE[t.type]}</b>
                <span className="muted">{TYPE_HINT[t.type]}</span>
                <span>
                  Budget iniziale{' '}
                  <b>
                    <Money value={t.budget[0]} />
                  </b>
                </span>
              </button>
            ))}
            <div className="choice disabled" aria-disabled>
              <b>Ufficiale / Nuovo costruttore</b>
              <span className="muted">Richiede lo sviluppo della moto e le concessioni regolamentari.</span>
              <span className="soon">In sviluppo</span>
            </div>
          </div>
        </Card>
        <Card title="Costruttore della moto">
          <div className="choice-cards">
            {cat.manufacturers.map((m) => (
              <button
                key={m.id}
                className={`choice ${m.id === manufacturer.id ? 'sel' : ''}`}
                onClick={() => setMfr(m.id)}
              >
                <b>{m.name}</b>
                <span className="muted">{country(m.country)}</span>
                <span>
                  Livello tecnico <b>{m.strength}</b>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>
      <div className="nc-side">
        <Card title="Anteprima">
          <div className="hero" style={{ marginBottom: '.8rem' }}>
            <TeamBadge colors={{ primary, secondary }} short={sigla || '—'} size={3.6} />
            <div>
              <div className="nm" style={{ fontSize: '1.4rem' }}>
                {teamName.trim() || 'Nome della squadra'}
              </div>
              <div className="muted" style={{ fontSize: '.8rem' }}>
                {country(nationality)}
                {city ? ` · ${city}` : ''}
              </div>
            </div>
          </div>
          <Row label="Categoria">{cat.name}</Row>
          <Row label="Tipologia">{TEAM_TYPE[typeOpt.type]}</Row>
          <Row label="Costruttore">{manufacturer.name}</Row>
          <Row label="Budget iniziale">
            <Money value={typeOpt.budget[0]} />
          </Row>
          <p className="muted" style={{ fontSize: '.78rem', lineHeight: 1.45 }}>
            La squadra parte con lo staff tecnico (direttore tecnico, due capotecnici, due ingegneri di pista,
            meccanici) e due posti in griglia liberi: i piloti li ingaggi dal Mercato prima del primo Gran
            Premio.
          </p>
        </Card>
        <button
          className="btn primary"
          disabled={busy || !valid}
          onClick={() =>
            onStart({
              name: teamName.trim(),
              shortName: sigla,
              nationality,
              baseCity: city.trim(),
              colors: { primary, secondary },
              type: typeOpt.type,
              tier,
              manufacturerId: manufacturer.id as ManufacturerId,
            })
          }
        >
          {busy ? 'Creazione…' : 'Crea la squadra ▸'}
        </button>
        {!valid && (
          <p className="muted" style={{ fontSize: '.76rem' }}>
            Inserisci nome (almeno 3 lettere), sigla e sede.
          </p>
        )}
      </div>
    </div>
  );
}
