import { useId } from 'react';

/**
 * Placca con il numero di gara: lettering motorsport (cifre larghe e inclinate con contorno e ombra
 * sfalsata) su una tabella con i colori della scuderia e il filetto obliquo.
 */
export function NumberPlate({
  number,
  colors,
  size = 5,
}: {
  number: number | null;
  colors: { primary: string; secondary: string };
  size?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ink = luminance(colors.primary) > 0.6 ? '#141416' : '#f6f4ef';
  const edge = luminance(colors.secondary) > 0.6 ? '#141416' : colors.secondary;
  const text = number === null ? '—' : String(number);
  return (
    <svg
      viewBox="0 0 120 100"
      width={`${size * 1.2}rem`}
      height={`${size}rem`}
      role="img"
      aria-label={number === null ? 'Senza numero' : `Numero ${number}`}
      style={{ flex: 'none' }}
    >
      <defs>
        <linearGradient id={`np-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.primary} />
          <stop offset="1" stopColor={shade(colors.primary, -0.28)} />
        </linearGradient>
      </defs>
      <path
        d="M14 6 H116 L106 94 H4 Z"
        fill={`url(#np-${uid})`}
        stroke="#000"
        strokeOpacity="0.45"
        strokeWidth="1.5"
      />
      <path d="M86 6 H100 L90 94 H76 Z" fill={colors.secondary} opacity="0.9" />
      <path d="M102 6 H108 L98 94 H92 Z" fill={colors.secondary} opacity="0.55" />
      <g transform="skewX(-10) translate(14 0)" fontFamily="Archivo, system-ui, sans-serif" fontWeight="900">
        <text
          x="48"
          y="73"
          textAnchor="middle"
          fontSize={text.length > 2 ? 46 : 62}
          fill="#000"
          opacity="0.35"
          style={{ fontStretch: '125%' }}
          transform="translate(3 3)"
        >
          {text}
        </text>
        <text
          x="48"
          y="73"
          textAnchor="middle"
          fontSize={text.length > 2 ? 46 : 62}
          fill={ink}
          stroke={edge}
          strokeWidth="2.2"
          paintOrder="stroke"
          style={{ fontStretch: '125%', letterSpacing: '-0.04em' }}
        >
          {text}
        </text>
      </g>
    </svg>
  );
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, v + v * f)));
  const [r, g, b] = [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
