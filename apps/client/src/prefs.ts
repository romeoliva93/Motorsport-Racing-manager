/**
 * Preferenze del giocatore (salvate nel browser, valgono per tutte le carriere).
 * - raceView: vista con cui si apre ogni Sprint/gara ('2d' | '3d'); si può sempre cambiare durante la gara.
 * - quality: dettaglio della vista 3D (bassa per PC poco potenti).
 */
import { useSyncExternalStore } from 'react';

export type Quality = 'low' | 'medium' | 'high';
export interface Prefs {
  raceView: '2d' | '3d';
  quality: Quality;
  /** La guida per i nuovi giocatori è già stata vista (o saltata). */
  tutorialSeen: boolean;
}

const KEY = 'lean-angle.prefs';
const DEFAULTS: Prefs = { raceView: '2d', quality: 'medium', tutorialSeen: false };
let current: Prefs = load();
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      raceView: p.raceView === '3d' ? '3d' : '2d',
      quality: p.quality === 'low' || p.quality === 'high' ? p.quality : 'medium',
      tutorialSeen: p.tutorialSeen === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export function getPrefs(): Prefs {
  return current;
}

export function setPrefs(patch: Partial<Prefs>): void {
  current = { ...current, ...patch };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // Archivio del browser non disponibile (navigazione privata): la scelta vale fino alla chiusura.
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

let gl: boolean | null = null;
/** Il browser sa disegnare in 3D (WebGL)? Se no, la gara resta in 2D. */
export function webglAvailable(): boolean {
  if (gl !== null) return gl;
  try {
    const c = document.createElement('canvas');
    gl = !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    gl = false;
  }
  return gl;
}
