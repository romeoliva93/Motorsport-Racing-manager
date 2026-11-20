/** Salvataggi nel browser con IndexedDB (disponibile anche dentro il Web Worker). */
import { MemorySaveStore, type SaveMeta, type SaveRecord, type SaveStore } from '@lean-angle/persistence';

const DB = 'lean-angle';
const STORE = 'saves';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'meta.slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export class IndexedDbSaveStore implements SaveStore {
  async list(): Promise<SaveMeta[]> {
    const all = await run<SaveRecord[]>('readonly', (s) => s.getAll());
    return all.map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
  }
  async put(record: SaveRecord): Promise<void> {
    await run('readwrite', (s) => s.put(record));
  }
  async get(slot: string): Promise<SaveRecord | null> {
    return (await run<SaveRecord | undefined>('readonly', (s) => s.get(slot))) ?? null;
  }
  async delete(slot: string): Promise<void> {
    await run('readwrite', (s) => s.delete(slot));
  }
}

/**
 * Archivio del browser con ripiego: se IndexedDB non è disponibile o fallisce (finestra privata, dati del sito
 * bloccati, pagina incorporata), passa a un archivio in memoria valido per la sessione corrente.
 */
export class BrowserSaveStore implements SaveStore {
  private impl: SaveStore;
  /** true quando i salvataggi non sopravvivono alla chiusura della pagina. */
  temporary = false;

  constructor() {
    let ok: boolean;
    try {
      ok = typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      ok = false;
    }
    this.impl = ok ? new IndexedDbSaveStore() : new MemorySaveStore();
    this.temporary = !ok;
  }

  private async attempt<T>(fn: (s: SaveStore) => Promise<T>): Promise<T> {
    try {
      return await fn(this.impl);
    } catch (e) {
      if (this.temporary) throw e;
      this.impl = new MemorySaveStore();
      this.temporary = true;
      return fn(this.impl);
    }
  }
  list() {
    return this.attempt((s) => s.list());
  }
  put(r: SaveRecord) {
    return this.attempt((s) => s.put(r));
  }
  get(slot: string) {
    return this.attempt((s) => s.get(slot));
  }
  delete(slot: string) {
    return this.attempt((s) => s.delete(slot));
  }
}
