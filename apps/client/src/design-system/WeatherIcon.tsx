export type Sky = 'sun' | 'partly' | 'overcast' | 'drizzle' | 'rain';

export const SKY_LABEL: Record<Sky, string> = {
  sun: 'Sereno',
  partly: 'Poco nuvoloso',
  overcast: 'Coperto',
  drizzle: 'Pioggerella',
  rain: 'Pioggia',
};

/** Icona meteo disegnata (niente emoji, stessa resa su ogni sistema). */
export function WeatherIcon({ sky, size = 1.6 }: { sky: Sky; size?: number }) {
  const sun = (
    <g>
      <circle cx="11" cy="11" r="4.5" fill="#ffd21f" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={11 + Math.cos(r) * 6.5}
            y1={11 + Math.sin(r) * 6.5}
            x2={11 + Math.cos(r) * 8.5}
            y2={11 + Math.sin(r) * 8.5}
            stroke="#ffd21f"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
  const cloud = (fill: string) => (
    <path
      d="M8 22 a5 5 0 0 1 0.6-9.95 a6.5 6.5 0 0 1 12.4 1.7 a4.2 4.2 0 0 1 0.5 8.25 Z"
      fill={fill}
      stroke="#0b0b0c"
      strokeOpacity="0.25"
    />
  );
  const drops = (n: number) => (
    <g stroke="#6aa8ff" strokeWidth="1.8" strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1={10 + i * 4.5} y1={25} x2={8.8 + i * 4.5} y2={28.5} />
      ))}
    </g>
  );
  return (
    <svg
      viewBox="0 0 30 30"
      width={`${size}rem`}
      height={`${size}rem`}
      role="img"
      aria-label={SKY_LABEL[sky]}
      style={{ flex: 'none' }}
    >
      {sky === 'sun' && <g transform="translate(4 4)">{sun}</g>}
      {sky === 'partly' && (
        <>
          <g transform="translate(-1 -2)">{sun}</g>
          <g transform="translate(3 4)">{cloud('#d9dbe0')}</g>
        </>
      )}
      {sky === 'overcast' && (
        <>
          <g transform="translate(-3 -3) scale(0.85)">{cloud('#8a8e97')}</g>
          <g transform="translate(2 1)">{cloud('#c3c6cc')}</g>
        </>
      )}
      {(sky === 'drizzle' || sky === 'rain') && (
        <>
          <g transform="translate(0 -3)">{cloud(sky === 'rain' ? '#7d828c' : '#b4b8bf')}</g>
          {drops(sky === 'rain' ? 4 : 2)}
        </>
      )}
    </svg>
  );
}
