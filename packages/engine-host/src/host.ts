/**
 * Lato motore del protocollo: riceve richieste, esegue comandi e viste sul GameEngine,
 * gestisce i salvataggi tramite un SaveStore iniettato. Non dipende dal browser: il Web Worker
 * dell'app lo collega a `self.postMessage`/`onmessage`, i test a un canale in memoria.
 */
import { GameEngine, QUERIES } from '@lean-angle/game';
import type { GameState, TeamId } from '@lean-angle/data';
import { createSaveRecord, restoreSaveRecord, type SaveStore } from '@lean-angle/persistence';
import type { HostMessage, Request } from './protocol.ts';

export interface EngineHostOptions {
  store: SaveStore;
  post: (message: HostMessage) => void;
  now?: () => number;
}

export function createEngineHost(opts: EngineHostOptions) {
  let engine: GameEngine | null = null;
  /** Mondo di anteprima per la scelta della squadra (non è ancora una carriera). */
  let preview: GameEngine | null = null;
  let version = 0;
  const now = opts.now ?? (() => Date.now());

  const current = (): GameEngine => {
    if (!engine) throw new Error('Nessuna carriera caricata');
    return engine;
  };
  const changed = () => {
    version++;
    opts.post({ kind: 'changed', version });
  };
  const stateFor = (name: string): GameState => {
    if (
      !engine &&
      (name === 'categories' ||
        name === 'teamCards' ||
        name === 'createTeamOptions' ||
        name === 'supplierOffers')
    )
      return (engine ?? preview ?? failNoWorld()).state as GameState;
    return current().state as GameState;
  };

  async function handle(req: Request): Promise<unknown> {
    switch (req.op) {
      case 'previewWorld':
        preview = GameEngine.newCareer({ seed: req.seed, saveName: 'anteprima' });
        engine = null;
        changed();
        return { seed: req.seed };
      case 'newCareer': {
        engine = GameEngine.newCareer({
          seed: req.seed,
          saveName: req.saveName,
          ...(req.teamId ? { teamId: req.teamId as TeamId } : {}),
        });
        preview = null;
        changed();
        return { saveName: req.saveName };
      }
      case 'dispatch': {
        const r = current().dispatch(req.command);
        if (!r.ok) throw new Error(r.error);
        changed();
        return r.value.map((e) => ({ seq: e.seq, day: e.day, type: e.type, payload: e.payload }));
      }
      case 'query': {
        const fn = QUERIES[req.name] as (s: GameState, ...a: unknown[]) => unknown;
        if (!fn) throw new Error(`Vista sconosciuta: ${req.name}`);
        return fn(stateFor(req.name), ...req.args);
      }
      case 'availableCommands':
        return engine ? engine.availableCommands() : [];
      case 'replay':
        return engine?.lastReplay ?? null;
      case 'timing':
        return engine?.lastTiming ?? null;
      case 'liveStatus':
        return engine?.liveRace ?? null;
      case 'liveAdvance': {
        const chunk = current().liveAdvance(req.to, req.fromFrame, req.fromEvent, req.viewerT);
        if (chunk?.done) changed();
        return chunk;
      }
      case 'save': {
        current().syncLive(); // gara in corso: la fotografia della simulazione va nel salvataggio
        const record = createSaveRecord(current().state as GameState, req.slot, now());
        await opts.store.put(record);
        return record.meta;
      }
      case 'load': {
        const record = await opts.store.get(req.slot);
        if (!record) throw new Error(`Salvataggio "${req.slot}" non trovato`);
        engine = GameEngine.fromState(restoreSaveRecord(record));
        preview = null;
        changed();
        return record.meta;
      }
      case 'listSaves':
        return opts.store.list();
      case 'deleteSave':
        await opts.store.delete(req.slot);
        return true;
    }
  }

  return {
    /** Gestisce una richiesta e invia la risposta. Gli errori diventano risposte `ok: false`. */
    async receive(req: Request): Promise<void> {
      try {
        const value = await handle(req);
        opts.post({ id: req.id, ok: true, value, version });
      } catch (e) {
        opts.post({ id: req.id, ok: false, error: e instanceof Error ? e.message : String(e), version });
      }
    },
  };
}

function failNoWorld(): never {
  throw new Error("Nessun mondo disponibile: crea un'anteprima o una carriera");
}
