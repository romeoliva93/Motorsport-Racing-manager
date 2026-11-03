import type { ReactNode } from 'react';

/**
 * Ritratto fotografico del personaggio (raccolti nei fogli `src/assets/atlas/`, generati da tools/portraits).
 * Ordine: foto propria → volto di riserva (personaggi nati durante la carriera) → `fallback` (es. il casco).
 * L'elenco dei file esistenti è noto alla compilazione: il browser non chiede mai foto che non ci sono.
 */
import ATLAS from '../assets/atlas/index.json';
const SHEETS = import.meta.glob('../assets/atlas/sheet-*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const SHEET_URL = new Map(
  Object.entries(SHEETS).map(([path, url]) => [Number(/sheet-(\d+)/.exec(path)![1]), url as string]),
);
const MAP = ATLAS.map as unknown as Record<string, [number, number, number]>;
export const portraitCount = Object.keys(MAP).length;
export function Portrait({
  portrait,
  name,
  size = 4,
  round = false,
  fallback,
}: {
  portrait: { key: string; pool: string };
  name: string;
  size?: number;
  round?: boolean;
  fallback: ReactNode;
}) {
  const cell = MAP[portrait.key] ?? MAP[portrait.pool];
  if (!cell) return <>{fallback}</>;
  const [sheet, col, row] = cell;
  const rows = (ATLAS.rows as Record<string, number>)[String(sheet)]!;
  const cols = ATLAS.cols;
  // I ritratti sono raccolti in pochi fogli (atlanti): qui si inquadra la casella giusta.
  return (
    <span
      role="img"
      aria-label={`Ritratto di ${name}`}
      className={`portrait ${round ? 'round' : ''}`}
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        backgroundImage: `url(${SHEET_URL.get(sheet)})`,
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
      }}
    />
  );
}
