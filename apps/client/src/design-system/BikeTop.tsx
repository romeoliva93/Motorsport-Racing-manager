import { useId } from 'react';
import type { BikeTier } from './BikeArt.tsx';

/**
 * Moto della squadra vista dall'alto (muso in alto), illustrazione originale per il garage: la stessa moto,
 * nella livrea reale della scuderia e con il numero del pilota, al centro delle schede dei gruppi tecnici.
 * Proporzioni per categoria (infografica di riferimento): MotoGP larga con alette e codone alto, Moto2 piena
 * senza alette, Moto3 e Rookies più strette e corte.
 */
export function BikeTop({
  tier,
  colors,
  number,
  height = 30,
}: {
  tier: BikeTier;
  colors: { primary: string; secondary: string };
  number?: number | null;
  height?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const wide = tier === 'premier' ? 1 : tier === 'intermediate' ? 0.96 : tier === 'lightweight' ? 0.84 : 0.82;
  const long = tier === 'premier' ? 1 : tier === 'intermediate' ? 0.98 : 0.92;
  const wings = tier === 'premier';
  const p = colors.primary,
    s = colors.secondary;
  const ink = lum(p) > 0.6 ? '#141518' : '#f3f1ec';
  const sideExhaust = tier !== 'premier';
  // Carena: forma a goccia, larga all'altezza delle ginocchia del pilota, stretta su sella e codone.
  const body =
    'M200,92 C232,98 264,158 274,230 C282,300 270,380 252,440 C242,480 238,520 238,560 C238,622 230,690 215,728 L185,728 C170,690 162,622 162,560 C162,520 158,480 148,440 C130,380 118,300 126,230 C136,158 168,98 200,92 Z';

  return (
    <svg
      viewBox="0 0 400 900"
      height={`${height}rem`}
      width={`${(height * 400) / 900}rem`}
      className="bike-top"
      role="img"
      aria-label="Moto della squadra vista dall'alto"
      style={{ maxHeight: '100%' }}
    >
      <defs>
        <radialGradient id={id('shine')} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id={id('side')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <stop offset="0.25" stopColor="#000" stopOpacity="0" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={id('tyre')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#050506" />
          <stop offset="0.5" stopColor="#2a2b30" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <linearGradient id={id('metal')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7d838c" />
          <stop offset="0.5" stopColor="#e3e7ec" />
          <stop offset="1" stopColor="#6b7078" />
        </linearGradient>
        <linearGradient id={id('screen')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fb4c6" stopOpacity="0.75" />
          <stop offset="1" stopColor="#0c1016" stopOpacity="0.95" />
        </linearGradient>
        <pattern
          id={id('carbon')}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" fill="#1a1b1f" />
          <rect width="3.5" height="7" fill="#26282e" />
        </pattern>
        <pattern id={id('tread')} width="10" height="14" patternUnits="userSpaceOnUse">
          <rect width="10" height="14" fill="transparent" />
          <rect y="6" width="10" height="2" fill="#000" opacity="0.35" />
        </pattern>
        <filter id={id('blur')} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      {/* Ombra a terra */}
      <ellipse
        cx={212}
        cy={470}
        rx={110 * wide}
        ry={400 * long}
        fill="#000"
        opacity={0.55}
        filter={`url(#${id('blur')})`}
      />

      <g transform={`translate(200 470) scale(${wide} ${long}) translate(-200 -470)`}>
        {/* Gomma posteriore (più larga) e forcellone */}
        <rect x={170} y={640} width={60} height={196} rx={28} fill={`url(#${id('tyre')})`} />
        <rect x={170} y={640} width={60} height={196} rx={28} fill={`url(#${id('tread')})`} />
        <path
          d="M166,560 L156,742 L170,744 L178,566 Z M234,560 L244,742 L230,744 L222,566 Z"
          fill={`url(#${id('metal')})`}
          stroke="#33363d"
          strokeWidth={2}
        />
        {/* Scarico: sotto il codone (MotoGP) o laterale basso (altre) */}
        {sideExhaust ? (
          <rect
            x={244}
            y={520}
            width={22}
            height={120}
            rx={10}
            fill={`url(#${id('metal')})`}
            stroke="#2b2d33"
            strokeWidth={2}
            transform="rotate(-6 255 580)"
          />
        ) : (
          <rect
            x={186}
            y={712}
            width={28}
            height={40}
            rx={8}
            fill="#8c8f97"
            stroke="#2b2d33"
            strokeWidth={2}
          />
        )}
        {/* Gomma anteriore, dischi, piedini forcella */}
        <rect x={180} y={30} width={40} height={180} rx={20} fill={`url(#${id('tyre')})`} />
        <rect x={180} y={30} width={40} height={180} rx={20} fill={`url(#${id('tread')})`} />
        <rect x={170} y={84} width={8} height={70} rx={3} fill="#9aa0a8" />
        <rect x={222} y={84} width={8} height={70} rx={3} fill="#9aa0a8" />
        <rect x={164} y={100} width={10} height={40} rx={3} fill="#c99a2e" />
        <rect x={226} y={100} width={10} height={40} rx={3} fill="#c99a2e" />

        {/* Alette (MotoGP) */}
        {wings && (
          <g fill="#141518" stroke={s} strokeWidth={3}>
            <path d="M136,196 L84,214 L86,230 L134,222 Z" />
            <path d="M264,196 L316,214 L314,230 L266,222 Z" />
          </g>
        )}
        {/* Semimanubri e leve */}
        <path
          d="M150,262 L110,276 M250,262 L290,276"
          stroke="#1a1b1f"
          strokeWidth={9}
          strokeLinecap="round"
        />
        <path
          d="M112,274 L104,268 M288,274 L296,268"
          stroke="#9aa0a8"
          strokeWidth={5}
          strokeLinecap="round"
        />

        {/* Carena nel colore della squadra */}
        <path d={body} fill={p} stroke="#000" strokeOpacity={0.55} strokeWidth={3} />
        {/* Fascia centrale e filetti nel secondo colore */}
        <path d="M188,100 L212,100 L224,300 L216,470 L184,470 L176,300 Z" fill={s} opacity={0.95} />
        <path d="M200,560 L222,566 L214,724 L186,724 L178,566 Z" fill={s} opacity={0.95} />
        <path
          d="M140,300 C150,360 160,410 172,446 L162,450 C148,410 136,360 130,304 Z M260,300 C250,360 240,410 228,446 L238,450 C252,410 264,360 270,304 Z"
          fill={s}
          opacity={0.85}
        />
        {/* Cupolino */}
        <path
          d="M200,118 C226,124 246,170 250,236 L150,236 C154,170 174,124 200,118 Z"
          fill={`url(#${id('screen')})`}
          stroke="#0b0e13"
          strokeWidth={2}
        />
        {/* Serbatoio in carbonio e sella */}
        <path
          d="M156,300 C170,290 230,290 244,300 L238,420 C224,432 176,432 162,420 Z"
          fill={`url(#${id('carbon')})`}
        />
        <path d="M168,452 C182,444 218,444 232,452 L230,560 L170,560 Z" fill="#121316" />
        <path d="M176,466 L224,466 M178,500 L222,500 M178,534 L222,534" stroke="#26282d" strokeWidth={3} />
        {/* Tabella col numero sul codone */}
        {number !== null && number !== undefined && (
          <g>
            <rect
              x={168}
              y={604}
              width={64}
              height={70}
              rx={10}
              fill={ink === '#141518' ? '#141518' : '#f3f1ec'}
            />
            <text
              x={200}
              y={654}
              textAnchor="middle"
              fontFamily="Archivo, system-ui, sans-serif"
              fontWeight={900}
              fontStyle="italic"
              fontSize={44}
              fill={p}
            >
              {number}
            </text>
          </g>
        )}
        {/* Volumi e riflessi */}
        <path d={body} fill={`url(#${id('side')})`} />
        <path d={body} fill={`url(#${id('shine')})`} opacity={0.75} />
      </g>
    </svg>
  );
}

function lum(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
