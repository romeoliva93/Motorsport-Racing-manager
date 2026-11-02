import type { ReactNode } from 'react';

/**
 * Ritratto fotografico del personaggio (`src/assets/portraits/<chiave>.webp`).
 * Ordine: foto propria → volto di riserva (personaggi nati durante la carriera) → `fallback` (es. il casco).
 * L'elenco dei file esistenti è noto alla compilazione: il browser non chiede mai foto che non ci sono.
 */
const FILES = import.meta.glob('../assets/portraits/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});
const URLS = new Map(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url as string]),
);
export const portraitCount = URLS.size;
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
  const src = URLS.get(portrait.key) ?? URLS.get(portrait.pool) ?? null;
  if (!src) return <>{fallback}</>;
  return (
    <img
      className={`portrait ${round ? 'round' : ''}`}
      src={src}
      alt={`Ritratto di ${name}`}
      width={Math.round(size * 16)}
      height={Math.round(size * 16)}
      style={{ width: `${size}rem`, height: `${size}rem` }}
      loading="lazy"
      decoding="async"
    />
  );
}
