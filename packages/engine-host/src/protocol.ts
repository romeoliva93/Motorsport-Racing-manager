/**
 * Protocollo fra interfaccia (main thread) e motore (Web Worker). Messaggi serializzabili.
 */
import type { Command, QueryName } from '@lean-angle/game';

export type Request =
  | { id: number; op: 'newCareer'; seed: string; saveName: string; teamId?: string }
  | { id: number; op: 'previewWorld'; seed: string }
  | { id: number; op: 'dispatch'; command: Command }
  | { id: number; op: 'query'; name: QueryName; args: unknown[] }
  | { id: number; op: 'availableCommands' }
  | { id: number; op: 'save'; slot: string }
  | { id: number; op: 'load'; slot: string }
  | { id: number; op: 'listSaves' }
  | { id: number; op: 'deleteSave'; slot: string };

export type Response =
  | { id: number; ok: true; value: unknown; version: number }
  | { id: number; ok: false; error: string; version: number };

/** Notifica spontanea del motore: lo stato è cambiato (l'interfaccia rilegge le viste). */
export interface ChangeNotice {
  kind: 'changed';
  version: number;
}

export type HostMessage = Response | ChangeNotice;

export interface Transport<In, Out> {
  post(message: Out): void;
  subscribe(listener: (message: In) => void): () => void;
}
