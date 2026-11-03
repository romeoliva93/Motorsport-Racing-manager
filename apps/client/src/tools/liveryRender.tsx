/**
 * Strumento di sviluppo usato da tools/portraits/render-liveries.cjs (non incluso nel gioco).
 * Disegna la moto di una squadra (categoria, colori) senza numero, su fondo da studio, 1200×675: è la base che il
 * generatore rende fotorealistica mantenendo forma e livrea. La geometria coincide con quella di BikeArt, così le
 * zone dei gruppi tecnici si possono sovrapporre alla foto (vedi TeamBike).
 */
import { createRoot } from 'react-dom/client';
import { BikeArt, type BikeTier } from '../design-system/BikeArt.tsx';

const q = new URLSearchParams(location.search);
createRoot(document.getElementById('r')!).render(
  <div
    id="shot"
    style={{
      width: 1200,
      height: 675,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(#3a3d44, #1d1f24)',
    }}
  >
    <BikeArt
      tier={(q.get('tier') ?? 'premier') as BikeTier}
      colors={{ primary: `#${q.get('p') ?? 'ffffff'}`, secondary: `#${q.get('s') ?? '000000'}` }}
      number={null}
      width={72}
    />
  </div>,
);
