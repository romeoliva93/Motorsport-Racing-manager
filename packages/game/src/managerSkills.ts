/** Livello (0–3) di un'abilità del manager: usata da mercato, sponsor e prove. */
import type { GameState, ManagerSkill } from '@lean-angle/data';

export function managerSkill(s: GameState, skill: ManagerSkill): number {
  return s.manager?.skills[skill] ?? 0;
}
