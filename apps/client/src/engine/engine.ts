/** Istanza unica del client del motore per l'app. */
import { EngineClient, type HostMessage, type Request, type Transport } from '@lean-angle/engine-host';

function createWorkerClient(): EngineClient {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const transport: Transport<HostMessage, Request> = {
    post: (m) => worker.postMessage(m),
    subscribe: (listener) => {
      const h = (e: MessageEvent<HostMessage>) => listener(e.data);
      worker.addEventListener('message', h);
      return () => worker.removeEventListener('message', h);
    },
  };
  return new EngineClient(transport);
}

export const engine = createWorkerClient();
