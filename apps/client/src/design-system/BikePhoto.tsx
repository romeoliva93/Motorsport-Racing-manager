/**
 * Foto realistica della moto del costruttore (`src/assets/bikes/<costruttore>-<categoria>.webp`), generata in
 * locale con tools/portraits/bikes.py. Se il file non c'è non mostra nulla: niente immagini finte.
 */
const FILES = import.meta.glob('../assets/bikes/*.webp', { eager: true, query: '?url', import: 'default' });
const URLS = new Map(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url as string]),
);

export function BikePhoto({ manufacturer, tier }: { manufacturer: string; tier: string }) {
  const key = `${manufacturer.split(' ')[0]!.toLowerCase()}-${tier}`;
  const src = URLS.get(key);
  if (!src) return null;
  return (
    <img
      className="bike-photo"
      src={src}
      alt={`Moto ${manufacturer}`}
      width={768}
      height={432}
      loading="lazy"
    />
  );
}
