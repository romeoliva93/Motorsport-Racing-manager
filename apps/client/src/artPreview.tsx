import './design-system/tokens.css';
import './design-system/app.css';
import { createRoot } from 'react-dom/client';
import { BikeArt } from './design-system/BikeArt.tsx';
import { BikeTop } from './design-system/BikeTop.tsx';
const q = new URLSearchParams(location.search);
const tier = (q.get('tier') ?? 'premier') as never;
const colors = { primary: '#' + (q.get('p') ?? '1f5fd6'), secondary: '#' + (q.get('s') ?? 'f3f3f3') };
const view = q.get('view') ?? 'side';
createRoot(document.getElementById('r')!).render(
  <div
    id="shot"
    style={{
      width: view === 'side' ? 1200 : 512,
      height: view === 'side' ? 640 : 1024,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#2a2c31',
    }}
  >
    {view === 'side' ? (
      <BikeArt tier={tier} colors={colors} number={null} width={75} />
    ) : (
      <BikeTop tier={tier} colors={colors} number={null} height={62} />
    )}
  </div>,
);
