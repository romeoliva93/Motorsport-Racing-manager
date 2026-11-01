/**
 * Istanza unica del client del motore per l'app.
 * Preferisce un Web Worker; se il Worker non si avvia (browser o pagina che lo bloccano), lo stesso motore
 * gira nel thread della pagina e le richieste già inviate vengono ripetute: per l'interfaccia non cambia nulla.
 */
import {
  EngineClient,
  createEngineHost,
  type HostMessage,
  type Request,
  type Transport,
} from '@lean-angle/engine-host';
import { BrowserSaveStore } from './idbStore.ts';

function createResilientTransport(): Transport<HostMessage, Request> {
  const listeners = new Set<(m: HostMessage) => void>();
  const deliver = (m: HostMessage) => listeners.forEach((l) => l(m));
  /** Richieste inviate al Worker prima della sua prima risposta: da ripetere se il Worker fallisce. */
  const unconfirmed: Request[] = [];
  let workerAlive = false;
  let post: (m: Request) => void;

  const useInPage = () => {
    const host = createEngineHost({
      store: new BrowserSaveStore(),
      post: (m) => queueMicrotask(() => deliver(m)),
    });
    post = (m) => queueMicrotask(() => void host.receive(m));
    for (const m of unconfirmed.splice(0)) post(m);
  };

  try {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<HostMessage>) => {
      workerAlive = true;
      unconfirmed.length = 0;
      deliver(e.data);
    };
    worker.onerror = () => {
      if (workerAlive) return;
      worker.terminate();
      useInPage();
    };
    post = (m) => {
      if (!workerAlive) unconfirmed.push(m);
      worker.postMessage(m);
    };
  } catch {
    useInPage();
  }

  return {
    post: (m) => post(m),
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export const engine = new EngineClient(createResilientTransport());
