import { useEffect, useState, useSyncExternalStore } from 'react';
import type { QueryArgs, QueryName, QueryResult } from '@lean-angle/game';
import { engine } from './engine.ts';

/** Versione dello stato del motore: cambia a ogni modifica. */
export function useEngineVersion(): number {
  return useSyncExternalStore(
    (cb) => engine.onChange(cb),
    () => engine.version,
  );
}

export type QueryState<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: string };

/** Legge una vista del motore e la aggiorna automaticamente quando lo stato cambia. */
export function useQuery<N extends QueryName>(name: N, ...args: QueryArgs<N>): QueryState<QueryResult<N>> {
  const version = useEngineVersion();
  const key = JSON.stringify(args);
  const [state, setState] = useState<QueryState<QueryResult<N>>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    engine.query(name, ...(JSON.parse(key) as QueryArgs<N>)).then(
      (data) => alive && setState({ status: 'ready', data }),
      (e: Error) => alive && setState({ status: 'error', error: e.message }),
    );
    return () => {
      alive = false;
    };
  }, [name, key, version]);
  return state;
}
