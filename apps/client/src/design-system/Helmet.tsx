import { useId } from 'react';

/**
 * Casco da gara di profilo, nella livrea della scuderia.
 *
 * Ogni scuderia ha un suo disegno ricavato dal nome (motivo grafico, colore della visiera, finitura), così
 * i due piloti della stessa squadra hanno lo stesso casco. Il numero non è sul casco: lo mostra la
 * placca (NumberPlate) accanto al ritratto.
 * Illustrazione vettoriale con luci e ombre (lucido della vernice, visiera a specchio, bordo in gomma),
 * pensata per sostituire i monogrammi finché non ci saranno fotografie.
 */
export function Helmet({
  team,
  colors,
  number,
  size = 4,
}: {
  /** Nome o ID della scuderia: decide il disegno. Vuoto = pilota senza squadra (casco neutro). */
  team: string;
  colors: { primary: string; secondary: string };
  number?: number | null;
  size?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = hash(team || 'free');
  const pattern = team ? h % 5 : -1;
  const visor = VISORS[(h >>> 3) % VISORS.length]!;
  const p = team ? colors.primary : '#6b6e75';
  const s = team ? colors.secondary : '#3a3c42';
  const accent = luminance(p) > 0.6 ? '#16171a' : '#f3f1ec';
  const id = (n: string) => `${n}-${uid}-${h.toString(36)}`;
  return (
    <svg
      viewBox="0 0 140 100"
      width={`${size}rem`}
      height={`${(size * 100) / 140}rem`}
      className="helmet"
      role="img"
      aria-label={number ? `Casco del numero ${number}` : 'Casco'}
    >
      <defs>
        <clipPath id={id('shell')}>
          <path d={SHELL} />
        </clipPath>
        <linearGradient id={id('metal')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id={id('gloss')} cx="0.36" cy="0.2" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('visor')} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={visor[0]} />
          <stop offset="0.5" stopColor={visor[1]} />
          <stop offset="1" stopColor={visor[2]} />
        </linearGradient>
      </defs>
      <ellipse cx="72" cy="93" rx="54" ry="4" fill="#000" opacity="0.4" />
      {/* Spoiler posteriore */}
      <path d="M26 28 L6 33 L12 41 L30 41 Z" fill={s} stroke="#000" strokeOpacity="0.45" strokeWidth="0.8" />
      <g clipPath={`url(#${id('shell')})`}>
        <rect x="0" y="0" width="140" height="100" fill={p} />
        {pattern === 0 && <path d="M0 56 C50 48 90 50 140 62 L140 76 C90 64 50 64 0 72 Z" fill={s} />}
        {pattern === 1 && <path d="M0 26 L70 56 L0 86 L0 73 L44 56 L0 39 Z" fill={s} />}
        {pattern === 2 && <path d="M0 0 L140 0 L140 20 C95 28 45 50 0 78 Z" fill={s} />}
        {pattern === 3 && (
          <g fill={s}>
            <path d="M6 38 L82 28 L83 33 L8 44 Z" />
            <path d="M4 52 L86 44 L87 50 L6 58 Z" />
            <path d="M6 66 L92 61 L93 67 L8 73 Z" />
          </g>
        )}
        {pattern === 4 && <circle cx="42" cy="64" r="19" fill={s} />}
        {/* Cucitura centrale e filetto sotto la visiera */}
        <path
          d="M66 48 C52 40 40 30 26 26"
          stroke="#000"
          strokeOpacity="0.22"
          strokeWidth="0.8"
          fill="none"
        />
        <path
          d="M64 64 C84 61 108 61 130 66"
          stroke={accent}
          strokeOpacity="0.6"
          strokeWidth="1.4"
          fill="none"
        />
        <rect x="0" y="0" width="140" height="100" fill={`url(#${id('metal')})`} />
        <rect x="0" y="0" width="140" height="100" fill={`url(#${id('gloss')})`} />
      </g>
      <path d={SHELL} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="1" />
      {/* Riflesso della vernice */}
      <path
        d="M30 30 C46 17 70 12 96 16"
        stroke="#fff"
        strokeOpacity="0.7"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Presa d'aria superiore */}
      <path d="M70 13 L86 12 L85 17 L71 18 Z" fill="#111" opacity="0.85" />
      {/* Visiera */}
      <path d={VISOR} fill={`url(#${id('visor')})`} stroke="#0b0b0c" strokeWidth="1.6" />
      <path
        d="M72 36 C88 31 108 32 121 40"
        stroke="#fff"
        strokeOpacity="0.6"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M76 52 C92 48 108 48 124 52"
        stroke="#fff"
        strokeOpacity="0.15"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="67" cy="48" r="3" fill="#2a2b2e" stroke="#000" strokeOpacity="0.6" strokeWidth="0.8" />
      {/* Prese d'aria sulla mentoniera */}
      <g fill="#0e0e10">
        <rect x="112" y="70" width="12" height="2" rx="1" />
        <rect x="110" y="74.5" width="12" height="2" rx="1" />
        <rect x="108" y="79" width="12" height="2" rx="1" />
      </g>
      {/* Bordo in gomma */}
      <path
        d="M24 82 C44 89 86 91 116 86"
        stroke="#0e0e10"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SHELL =
  'M16 60 C12 34 36 11 70 10 C104 9 126 30 129 54 L130 70 C130 80 122 87 111 88 L44 90 C28 90 18 78 16 60 Z';
const VISOR = 'M62 34 C82 25 112 27 127 40 L129 60 C110 56 88 57 66 62 C60 54 59 42 62 34 Z';

/** Tinte della visiera: fumé, iridio blu, oro, rosso, argento. */
const VISORS: [string, string, string][] = [
  ['#5a5f6a', '#22252b', '#0a0a0c'],
  ['#8cc8ff', '#2a62d6', '#0d1f55'],
  ['#ffe9a3', '#d49a2a', '#5a3a08'],
  ['#ffb09a', '#d8402c', '#4a0d08'],
  ['#ffffff', '#a9b1bd', '#3a3f48'],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
