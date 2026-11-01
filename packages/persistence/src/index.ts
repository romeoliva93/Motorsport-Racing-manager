/**
 * Salvataggi (ADR-0002). Il formato è indipendente dal supporto: gli adapter (IndexedDB nel browser,
 * filesystem con Tauri, memoria nei test) implementano `SaveStore`.
 * Compressione (fflate) e autosalvataggi a rotazione arriveranno con M2.8.
 */
import { GameCalendar } from '@lean-angle/core';
import { deserializeState, serializeState, SCHEMA_VERSION, type GameState } from '@lean-angle/data';

export interface SaveMeta {
  slot: string;
  saveName: string;
  teamName: string | null;
  gameDate: string;
  schemaVersion: number;
  /** Momento reale del salvataggio (ms dal 1970), solo informativo. */
  savedAt: number;
}

export interface SaveRecord {
  meta: SaveMeta;
  data: string;
}

export interface SaveStore {
  list(): Promise<SaveMeta[]>;
  put(record: SaveRecord): Promise<void>;
  get(slot: string): Promise<SaveRecord | null>;
  delete(slot: string): Promise<void>;
}

const SLOT_PATTERN = /^[a-z0-9-]{1,40}$/;

export function createSaveRecord(state: GameState, slot: string, now: number): SaveRecord {
  if (!SLOT_PATTERN.test(slot)) throw new Error(`Nome dello slot non valido: "${slot}"`);
  const teamId = state.meta.playerTeamId;
  return {
    meta: {
      slot,
      saveName: state.meta.saveName,
      teamName: teamId ? (state.tables.teams[teamId]?.name ?? null) : null,
      gameDate: new GameCalendar(state.meta.startYear).format(state.meta.currentDay),
      schemaVersion: SCHEMA_VERSION,
      savedAt: now,
    },
    data: serializeState(state),
  };
}

export function restoreSaveRecord(record: SaveRecord): GameState {
  return deserializeState(record.data);
}

/** Archivio in memoria (test e fallback quando lo storage del browser non è disponibile). */
export class MemorySaveStore implements SaveStore {
  private readonly records = new Map<string, SaveRecord>();

  async list(): Promise<SaveMeta[]> {
    return [...this.records.values()].map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
  }
  async put(record: SaveRecord): Promise<void> {
    this.records.set(record.meta.slot, structuredCloneRecord(record));
  }
  async get(slot: string): Promise<SaveRecord | null> {
    const r = this.records.get(slot);
    return r ? structuredCloneRecord(r) : null;
  }
  async delete(slot: string): Promise<void> {
    this.records.delete(slot);
  }
}

const structuredCloneRecord = (r: SaveRecord): SaveRecord => ({ meta: { ...r.meta }, data: r.data });
