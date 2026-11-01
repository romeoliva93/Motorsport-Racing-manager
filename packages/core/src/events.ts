/**
 * Eventi di dominio (ARCHITECTURE.md §3.5): i sistemi emettono eventi, altri sistemi
 * (notizie, statistiche, morale, archivio) li consumano senza dipendenze dirette.
 */
import type { GameDay } from './time.ts';

export interface DomainEvent<T extends string = string, P = unknown> {
  readonly seq: number;
  readonly day: GameDay;
  readonly type: T;
  readonly payload: P;
}

export type EventMap = Record<string, unknown>;
type Handler<M extends EventMap, K extends keyof M & string> = (e: DomainEvent<K, M[K]>) => void;

/** Registro ordinato degli eventi + pubblicazione sincrona ai sottoscrittori. */
export class EventLog<M extends EventMap> {
  private readonly events: DomainEvent<keyof M & string, M[keyof M & string]>[] = [];
  private readonly handlers = new Map<string, Set<(e: DomainEvent) => void>>();
  private seq = 0;

  emit<K extends keyof M & string>(type: K, day: GameDay, payload: M[K]): DomainEvent<K, M[K]> {
    const e: DomainEvent<K, M[K]> = Object.freeze({ seq: ++this.seq, day, type, payload });
    this.events.push(e as DomainEvent<keyof M & string, M[keyof M & string]>);
    for (const h of this.handlers.get(type) ?? []) h(e as DomainEvent);
    for (const h of this.handlers.get('*') ?? []) h(e as DomainEvent);
    return e;
  }

  /** Sottoscrive un tipo di evento ('*' per tutti). Restituisce la funzione per annullare. */
  on<K extends keyof M & string>(type: K | '*', handler: Handler<M, K>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const h = handler as (e: DomainEvent) => void;
    set.add(h);
    return () => set.delete(h);
  }

  /** Eventi con numero di sequenza maggiore di `seq`. */
  since(seq: number): readonly DomainEvent<keyof M & string, M[keyof M & string]>[] {
    return this.events.filter((e) => e.seq > seq);
  }

  ofType<K extends keyof M & string>(type: K): readonly DomainEvent<K, M[K]>[] {
    return this.events.filter((e) => e.type === type) as unknown as DomainEvent<K, M[K]>[];
  }

  get lastSeq(): number {
    return this.seq;
  }

  get size(): number {
    return this.events.length;
  }
}
