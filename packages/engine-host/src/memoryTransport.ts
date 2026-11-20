/**
 * Collega client e host nello stesso thread (test, ambienti senza Web Worker).
 * I messaggi passano da JSON per riprodurre la serializzazione reale del Worker.
 */
import type { SaveStore } from '@lean-angle/persistence';
import { EngineClient } from './client.ts';
import { createEngineHost } from './host.ts';
import type { HostMessage, Request, Transport } from './protocol.ts';

export function createInProcessEngine(store: SaveStore, now?: () => number): EngineClient {
  const toClient = new Set<(m: HostMessage) => void>();
  const host = createEngineHost({
    store,
    ...(now ? { now } : {}),
    post: (m) => {
      const copy = JSON.parse(JSON.stringify(m)) as HostMessage;
      queueMicrotask(() => toClient.forEach((l) => l(copy)));
    },
  });
  const transport: Transport<HostMessage, Request> = {
    post: (m) => {
      const copy = JSON.parse(JSON.stringify(m)) as Request;
      queueMicrotask(() => void host.receive(copy));
    },
    subscribe: (l) => {
      toClient.add(l);
      return () => toClient.delete(l);
    },
  };
  return new EngineClient(transport);
}
