/**
 * Ritratti dei personaggi.
 *
 * Ogni persona dell'universo di partenza ha un ritratto proprio, identificato da nome, cognome e giorno di
 * nascita (non dall'ID interno): il volto resta lo stesso anche se il personaggio cambia squadra o se il mondo
 * viene rigenerato con un ordine diverso. Le immagini stanno negli atlanti `apps/client/src/assets/atlas/` (index.json: chiave → casella).
 *
 * I personaggi che nascono durante la carriera (nuovi rookie, giovani dai campionati nazionali) prendono il volto
 * da un archivio di volti di riserva per fascia d'età, assegnato in modo stabile.
 */
export const PORTRAIT_POOL_SIZE = { youth: 120, young: 60 } as const;

export function portraitKey(p: { firstName: string; lastName: string; birthDay: number }): string {
  const slug = `${p.firstName}-${p.lastName}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ł/g, 'l')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${p.birthDay < 0 ? `n${-p.birthDay}` : p.birthDay}`;
}

/** Volto di riserva: fascia "youth" (13–17 anni, tuta ufficiale Rookies) o "young" (18–24, polo nera neutra). */
export function poolPortraitKey(key: string, age: number): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const band = age <= 17 ? 'youth' : 'young';
  return `pool-${band}-${String((h >>> 0) % PORTRAIT_POOL_SIZE[band]).padStart(3, '0')}`;
}
