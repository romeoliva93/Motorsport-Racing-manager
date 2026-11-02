import type { PartKey } from '../schema/upgrades.ts';

/**
 * I 14 componenti del garage. Ognuno si consuma con i chilometri percorsi dalla moto su cui è montato; oltre metà
 * vita perde affidabilità e la moto rischia di più il guasto in gara. Una revisione lo riporta a nuovo (costo
 * pagato alla voce "Riparazioni"). `upgrade` collega il componente al reparto che lo sviluppa (livelli 0–3).
 * `life` è la vita in weekend tipici di gara (≈ GARAGE_WEEKEND_KM ciascuno), `cost` la frazione del costo base
 * di un upgrade della categoria spesa per una revisione.
 */
export const GARAGE_PARTS = [
  { key: 'engine', name: 'Motore', group: 'Motore', upgrade: 'engine', life: 3, cost: 0.2 },
  { key: 'gearbox', name: 'Cambio', group: 'Motore', upgrade: 'engine', life: 5, cost: 0.08 },
  { key: 'clutch', name: 'Frizione', group: 'Motore', upgrade: 'engine', life: 2, cost: 0.03 },
  { key: 'chain', name: 'Catena e corona', group: 'Motore', upgrade: 'engine', life: 2, cost: 0.015 },
  { key: 'cooling', name: 'Radiatori', group: 'Motore', upgrade: 'engine', life: 8, cost: 0.03 },
  { key: 'exhaust', name: 'Scarico', group: 'Motore', upgrade: 'exhaust', life: 6, cost: 0.04 },
  { key: 'chassis', name: 'Telaio', group: 'Ciclistica', upgrade: 'chassis', life: 30, cost: 0.25 },
  { key: 'swingarm', name: 'Forcellone', group: 'Ciclistica', upgrade: 'chassis', life: 20, cost: 0.08 },
  { key: 'fork', name: 'Forcella', group: 'Ciclistica', upgrade: 'suspension', life: 4, cost: 0.05 },
  { key: 'shock', name: 'Ammortizzatore', group: 'Ciclistica', upgrade: 'suspension', life: 4, cost: 0.04 },
  { key: 'frontBrake', name: 'Freno anteriore', group: 'Freni', upgrade: 'brakes', life: 2, cost: 0.04 },
  { key: 'rearBrake', name: 'Freno posteriore', group: 'Freni', upgrade: 'brakes', life: 3, cost: 0.02 },
  { key: 'ecu', name: 'Centralina', group: 'Elettronica', upgrade: 'electronics', life: 15, cost: 0.06 },
  { key: 'fairing', name: 'Carena e alette', group: 'Aerodinamica', upgrade: 'aero', life: 5, cost: 0.05 },
] as const satisfies readonly {
  key: string;
  name: string;
  group: string;
  upgrade: PartKey;
  life: number;
  cost: number;
}[];

export type GarageKey = (typeof GARAGE_PARTS)[number]['key'];
export const GARAGE_KEYS = GARAGE_PARTS.map((p) => p.key) as GarageKey[];

/** Chilometri di un weekend tipico per una moto (unità della vita dei componenti). */
export const GARAGE_WEEKEND_KM = 280;

/** Giri nominali percorsi in ogni tipo di sessione a tempo (la gara usa i giri veri). */
export const SESSION_KM_LAPS: Record<string, number> = {
  fp1: 12,
  practice: 12,
  fp2: 12,
  warmup: 4,
  q1: 6,
  q2: 6,
  qualifying: 8,
};
