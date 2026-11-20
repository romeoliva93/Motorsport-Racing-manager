import type { GameState, Table, TableName } from './schema/state.ts';

type Row<N extends TableName> = GameState['tables'][N][keyof GameState['tables'][N]];

/** Inserisce una riga; errore se l'ID esiste già. */
export function insert<N extends TableName>(state: GameState, table: N, row: Row<N>): void {
  const t = state.tables[table] as Table<{ id: string }>;
  const r = row as unknown as { id: string };
  if (t[r.id]) throw new Error(`${table}: ID duplicato ${r.id}`);
  t[r.id] = r;
}

export function get<N extends TableName>(state: GameState, table: N, id: string): Row<N> | undefined {
  return (state.tables[table] as Record<string, Row<N>>)[id];
}

export function mustGet<N extends TableName>(state: GameState, table: N, id: string): Row<N> {
  const row = get(state, table, id);
  if (!row) throw new Error(`${table}: ${id} non trovato`);
  return row;
}

export function rows<N extends TableName>(state: GameState, table: N): Row<N>[] {
  return Object.values(state.tables[table]) as Row<N>[];
}

export function update<N extends TableName>(
  state: GameState,
  table: N,
  id: string,
  patch: Partial<Row<N>>,
): Row<N> {
  const current = mustGet(state, table, id);
  const next = { ...current, ...patch, id } as Row<N>;
  (state.tables[table] as Record<string, Row<N>>)[id] = next;
  return next;
}
