import { useState } from 'react';
import { useQuery } from '../../engine/hooks.ts';
import { Card, Tabs } from '../../design-system/components.tsx';

const TAG: Record<string, { label: string; tone: string }> = {
  gara: { label: 'Gara', tone: 'or' },
  mercato: { label: 'Mercato', tone: 'info' },
  squadra: { label: 'Squadra', tone: 'ok' },
  campionato: { label: 'Campionato', tone: 'warn' },
  finanze: { label: 'Finanze', tone: '' },
};

export function NewsScreen() {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const q = useQuery('newsFeed', filter, 80);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '52rem' }}>
      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'Tutte le notizie' },
          { id: 'mine', label: 'La mia squadra' },
        ]}
      />
      {q.status !== 'ready' ? (
        <div className="loading">Caricamento…</div>
      ) : q.data.length === 0 ? (
        <Card>
          <p className="muted" style={{ margin: 0 }}>
            Ancora nessuna notizia: arriveranno con le gare, il mercato e la fine della stagione.
          </p>
        </Card>
      ) : (
        q.data.map((n) => (
          <Card key={n.id} className={n.mine ? 'accent' : ''}>
            <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', marginBottom: '.3rem' }}>
              <span className={`pill ${TAG[n.tag]?.tone ?? ''}`}>{TAG[n.tag]?.label ?? n.tag}</span>
              <span className="muted" style={{ fontSize: '.82rem' }}>
                {n.date}
              </span>
            </div>
            <h3 style={{ margin: '0 0 .25rem', fontSize: '1.1rem' }}>{n.title}</h3>
            <div className="t2">{n.body}</div>
          </Card>
        ))
      )}
    </div>
  );
}
