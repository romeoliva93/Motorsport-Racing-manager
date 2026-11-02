import { BikeArt, type BikeTier } from './BikeArt.tsx';

/**
 * La moto della squadra: foto realistica nella livrea della scuderia (assets/teambikes/<squadra>.webp, generata
 * con tools/portraits/teambikes.py) con la tabella del numero del pilota. Per le squadre senza foto (es. create dal
 * giocatore) si usa l'illustrazione originale nei colori della squadra.
 */
const FILES = Object.fromEntries(
  Object.entries(
    import.meta.glob('../assets/teambikes/*.webp', { eager: true, query: '?url', import: 'default' }),
  ).map(([p, u]) => [p.split('/').pop()!.replace('.webp', ''), u as string]),
);

export const teamSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function hasTeamBikePhoto(team: string) {
  return !!FILES[teamSlug(team)];
}

export function TeamBike({
  team,
  tier,
  colors,
  number,
  rider,
  width = 40,
}: {
  team: string;
  tier: BikeTier;
  colors: { primary: string; secondary: string };
  number?: number | null;
  rider?: string;
  width?: number;
}) {
  const src = FILES[teamSlug(team)];
  return (
    <figure className="team-bike" style={{ width: `${width}rem` }}>
      {src ? (
        <img src={src} alt={`Moto della squadra ${team}`} width={768} height={432} />
      ) : (
        <BikeArt tier={tier} colors={colors} number={number} width={width} />
      )}
      {number !== null && number !== undefined && (
        <figcaption
          className="team-bike-plate"
          style={{
            ['--p' as string]: colors.primary,
            ['--s' as string]: colors.secondary,
            ['--ink' as string]: lum(colors.primary) > 0.6 ? '#14161b' : '#ffffff',
          }}
        >
          <b>{number}</b>
          {rider && <span>{rider}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function lum(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
