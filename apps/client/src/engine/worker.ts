/** Web Worker del motore: la simulazione gira fuori dal thread dell'interfaccia. */
import { createEngineHost, type Request } from '@lean-angle/engine-host';
import { MemorySaveStore } from '@lean-angle/persistence';
import { IndexedDbSaveStore } from './idbStore.ts';

const ctx = self as unknown as {
  postMessage(m: unknown): void;
  onmessage: ((e: MessageEvent<Request>) => void) | null;
};
const store = typeof indexedDB !== 'undefined' ? new IndexedDbSaveStore() : new MemorySaveStore();
const host = createEngineHost({ store, post: (m) => ctx.postMessage(m) });
ctx.onmessage = (e) => void host.receive(e.data);
