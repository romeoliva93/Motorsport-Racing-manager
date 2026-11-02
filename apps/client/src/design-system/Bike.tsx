import { useId } from 'react';

export type BikePart = 'engine' | 'brakes' | 'suspension' | 'chassis' | 'aero' | 'electronics' | 'exhaust';

/**
 * Moto da corsa di profilo (muso a destra), sulla sagoma dello schema fornito dall'utente: codino rialzato,
 * sella, serbatoio, cupolino alto, carena lunga, forcellone e scarico sotto il codino.
 *
 * La moto di serie è tutta nera. Ogni componente potenziato si colora con il suo colore, più acceso a ogni
 * livello (1 → 3), così si vede a colpo d'occhio dove si è investito. Unico tocco della squadra: il filetto
 * sulla carena e la tabella con il numero.
 */
export function Bike({
  team,
  colors,
  number,
  levels = {},
  partColors = {},
  width = 22,
  highlight,
  pending = [],
}: {
  team: string;
  colors: { primary: string; secondary: string };
  number?: number | null;
  levels?: Partial<Record<BikePart, number>>;
  partColors?: Partial<Record<BikePart, string>>;
  width?: number;
  /** Componente da evidenziare (es. al passaggio del mouse sulla sua scheda). */
  highlight?: BikePart | null;
  /** Componenti in produzione in fabbrica: contorno tratteggiato. */
  pending?: BikePart[];
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}-${uid}-${hash(team).toString(36)}`;
  const BASE = '#1b1c1f';
  const OFF = '#2a2b30';
  const fill = (k: BikePart) => {
    const l = levels[k] ?? 0;
    return l > 0 ? (partColors[k] ?? colors.primary) : OFF;
  };
  const op = (k: BikePart) => {
    const l = levels[k] ?? 0;
    return l === 0 ? 1 : [0, 0.62, 0.82, 1][l]!;
  };
  const glow = (k: BikePart) => ((levels[k] ?? 0) > 0 || highlight === k ? `url(#${id('glow')})` : undefined);
  const ring = (k: BikePart) =>
    highlight === k
      ? { stroke: '#fff', strokeWidth: 4 }
      : pending.includes(k)
        ? { stroke: partColors[k] ?? '#fff', strokeWidth: 3, strokeDasharray: '8 6' }
        : { stroke: '#000', strokeWidth: 3 };
  const plate = colors.primary;
  const plateInk = luminance(plate) > 0.6 ? '#16171a' : '#f3f1ec';

  return (
    <svg
      viewBox="0 0 1000 600"
      width={`${width}rem`}
      height={`${(width * 600) / 1000}rem`}
      className="bike"
      role="img"
      aria-label="Moto della squadra: i componenti potenziati sono colorati"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id={id('light')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={id('screen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8fa6bd" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0b0e13" stopOpacity="0.92" />
        </linearGradient>
        <radialGradient id={id('tyre')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.8" stopColor="#141517" />
          <stop offset="0.95" stopColor="#09090a" />
          <stop offset="1" stopColor="#26272b" />
        </radialGradient>
        <filter id={id('glow')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={id('body')}>
          <path d={BODY} />
        </clipPath>
      </defs>

      <ellipse cx="500" cy="580" rx="450" ry="12" fill="#000" opacity="0.5" />

      {/* Ruote */}
      <Wheel cx={155} cy={420} r={150} tyre={`url(#${id('tyre')})`} />
      <Wheel cx={850} cy={435} r={140} tyre={`url(#${id('tyre')})`} />
      {/* Freni: dischi e pinze */}
      <g opacity={op('brakes')} filter={glow('brakes')}>
        <circle cx="850" cy="435" r="72" fill="none" stroke={fill('brakes')} strokeWidth="14" />
        <circle cx="155" cy="420" r="56" fill="none" stroke={fill('brakes')} strokeWidth="11" />
        <path d="M806 372 L842 362 L854 398 L818 408 Z" fill={fill('brakes')} {...ring('brakes')} />
        <path d="M196 376 L226 370 L234 398 L204 404 Z" fill={fill('brakes')} {...ring('brakes')} />
      </g>

      {/* Scarico */}
      <g opacity={op('exhaust')} filter={glow('exhaust')}>
        <path d="M74 92 L232 148 L220 178 L60 120 Z" fill={fill('exhaust')} {...ring('exhaust')} />
        <ellipse cx="66" cy="106" rx="13" ry="18" fill="#0b0b0c" stroke="#000" strokeWidth="2" />
      </g>

      {/* Forcellone */}
      <path d="M155 420 L448 345 L466 390 L172 452 Z" fill={BASE} stroke="#000" strokeWidth="3" />
      {/* Carrozzeria */}
      <path d={BODY} fill={BASE} stroke="#000" strokeWidth="3.5" strokeLinejoin="round" />
      <g clipPath={`url(#${id('body')})`}>
        {/* Motore (carter visibile sotto la carena) */}
        <path
          d="M440 380 L562 362 L562 506 L440 508 C446 470 452 425 440 380 Z"
          fill={fill('engine')}
          opacity={op('engine')}
          filter={glow('engine')}
          {...ring('engine')}
        />
        {/* Carena laterale (aerodinamica) */}
        <path
          d="M566 250 C622 202 680 146 722 116 C782 132 850 172 884 214 C880 240 850 262 795 290 C766 320 744 410 726 506 L566 506 C580 420 572 330 566 250 Z"
          fill={fill('aero')}
          opacity={op('aero')}
          filter={glow('aero')}
          {...ring('aero')}
        />
        {/* Telaio */}
        <path
          d="M466 334 L706 198 L726 222 L486 358 Z"
          fill={fill('chassis')}
          opacity={op('chassis')}
          filter={glow('chassis')}
          {...ring('chassis')}
        />
        {/* Filetto della squadra */}
        <path d="M70 92 C300 120 520 250 880 232" stroke={colors.primary} strokeWidth="7" fill="none" />
        <rect x="0" y="0" width="1000" height="600" fill={`url(#${id('light')})`} />
      </g>
      {/* Forcella anteriore e ammortizzatore posteriore */}
      <g opacity={op('suspension')} filter={glow('suspension')}>
        <path d="M726 206 L750 198 L866 428 L842 440 Z" fill={fill('suspension')} {...ring('suspension')} />
        <path d="M398 242 L418 236 L458 338 L438 345 Z" fill={fill('suspension')} {...ring('suspension')} />
      </g>
      <path d="M800 340 L822 334 L866 428 L842 440 Z" fill="#111214" stroke="#000" strokeWidth="2" />

      {/* Aletta aerodinamica */}
      <path
        d="M752 236 L826 224 L830 240 L756 250 Z"
        fill={fill('aero')}
        opacity={op('aero')}
        filter={glow('aero')}
        {...ring('aero')}
      />
      {/* Sella */}
      <path d="M300 128 L405 170 L398 188 L296 146 Z" fill="#0d0d0f" stroke="#000" strokeWidth="2" />
      {/* Cupolino */}
      <path d={SCREEN} fill={`url(#${id('screen')})`} stroke="#000" strokeWidth="3" />
      {/* Strumentazione/centralina (elettronica) */}
      <path
        d="M614 116 L694 104 L698 126 L618 138 Z"
        fill={fill('electronics')}
        opacity={op('electronics')}
        filter={glow('electronics')}
        {...ring('electronics')}
      />
      {/* Prese d'aria e parafango */}
      <path
        d="M600 330 L628 300 M618 362 L650 326 M636 394 L672 354"
        stroke="#000"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M772 300 C812 284 862 284 902 300 L898 316 C860 302 814 304 778 318 Z"
        fill={BASE}
        stroke="#000"
        strokeWidth="2.5"
      />
      <path
        d="M460 120 C540 104 630 100 696 106"
        stroke="#fff"
        strokeOpacity="0.28"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Tabella portanumero */}
      {number !== null && number !== undefined && (
        <g>
          <ellipse cx="806" cy="186" rx="42" ry="30" fill={plate} stroke="#000" strokeWidth="3" />
          <text
            x="806"
            y="201"
            textAnchor="middle"
            fontFamily="Archivo, system-ui, sans-serif"
            fontWeight="900"
            fontSize="42"
            fill={plateInk}
            style={{ fontStretch: '112%' }}
          >
            {number}
          </text>
        </g>
      )}
    </svg>
  );
}

function Wheel({ cx, cy, r, tyre }: { cx: number; cy: number; r: number; tyre: string }) {
  const spokes = [0, 72, 144, 216, 288];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={tyre} stroke="#000" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r * 0.74} fill="#0e0f11" stroke="#2f3035" strokeWidth="6" />
      {spokes.map((d) => {
        const a = (d * Math.PI) / 180;
        return (
          <line
            key={d}
            x1={cx + Math.cos(a) * r * 0.13}
            y1={cy + Math.sin(a) * r * 0.13}
            x2={cx + Math.cos(a + 0.22) * r * 0.7}
            y2={cy + Math.sin(a + 0.22) * r * 0.7}
            stroke="#2f3035"
            strokeWidth="9"
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.11} fill="#3a3b40" stroke="#000" strokeWidth="2" />
    </g>
  );
}

const BODY =
  'M65 68 L295 78 L300 128 L405 170 L445 112 C540 98 640 96 700 102 C715 70 730 38 745 8 C805 70 865 140 888 205 C892 228 860 262 795 290 C765 320 740 410 722 505 L440 508 C445 470 455 430 470 400 C440 360 410 330 380 300 C330 260 270 215 215 180 C160 145 110 110 65 68 Z';
const SCREEN =
  'M700 102 C715 70 730 38 745 8 C805 70 865 140 888 205 C850 175 800 140 760 120 C740 108 720 102 700 102 Z';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
