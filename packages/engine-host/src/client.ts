/**
 * Lato interfaccia del protocollo: richieste con Promise, notifiche di cambiamento.
 */
import type { Command, CommandType, QueryArgs, QueryName, QueryResult, ReplayData } from '@lean-angle/game';
import type { SaveMeta } from '@lean-angle/persistence';
import type { HostMessage, Request, Transport } from './protocol.ts';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export class EngineClient {
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Set<(version: number) => void>();
  private versionValue = 0;
  private readonly transport: Transport<HostMessage, Request>;

  constructor(transport: Transport<HostMessage, Request>) {
    this.transport = transport;
    transport.subscribe((msg) => {
      if ('kind' in msg) {
        this.versionValue = msg.version;
        for (const l of this.listeners) l(msg.version);
        return;
      }
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.value);
      else p.reject(new Error(msg.error));
    });
  }

  get version(): number {
    return this.versionValue;
  }

  /** Avvisa quando lo stato del motore cambia. Restituisce la funzione per annullare. */
  onChange(listener: (version: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private request<T>(req: DistributiveOmit<Request, 'id'>): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.transport.post({ ...req, id } as Request);
    });
  }

  previewWorld(seed: string) {
    return this.request<{ seed: string }>({ op: 'previewWorld', seed });
  }
  newCareer(seed: string, saveName: string, teamId?: string) {
    return this.request<{ saveName: string }>({
      op: 'newCareer',
      seed,
      saveName,
      ...(teamId ? { teamId } : {}),
    });
  }
  dispatch(command: Command) {
    return this.request<{ seq: number; day: number; type: string; payload: unknown }[]>({
      op: 'dispatch',
      command,
    });
  }
  query<N extends QueryName>(name: N, ...args: QueryArgs<N>): Promise<QueryResult<N>> {
    return this.request<QueryResult<N>>({ op: 'query', name, args });
  }
  /** Dati per rivedere l'ultima gara del giocatore (null se non disponibile). */
  replay() {
    return this.request<ReplayData | null>({ op: 'replay' });
  }
  availableCommands() {
    return this.request<CommandType[]>({ op: 'availableCommands' });
  }
  save(slot: string) {
    return this.request<SaveMeta>({ op: 'save', slot });
  }
  load(slot: string) {
    return this.request<SaveMeta>({ op: 'load', slot });
  }
  listSaves() {
    return this.request<SaveMeta[]>({ op: 'listSaves' });
  }
  deleteSave(slot: string) {
    return this.request<boolean>({ op: 'deleteSave', slot });
  }
}
