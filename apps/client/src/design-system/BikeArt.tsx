import { useId } from 'react';

/** Zone della moto che corrispondono ai gruppi tecnici del garage. */
export type BikeZone = 'engine' | 'chassis' | 'suspension' | 'brakes' | 'aero' | 'electronics';
export type BikeTier = 'premier' | 'intermediate' | 'lightweight' | 'rookies';

/**
 * Illustrazione originale della moto della squadra, di profilo (muso a destra), nella livrea della scuderia.
 * È l'unica rappresentazione della moto nelle schermate gestionali (garage, home): stessa moto ovunque.
 *
 * Differenze per categoria (riferimento: infografica delle quattro moto del campionato):
 *  premier       alette sul cupolino, codone alto, scarico sotto il codone, gomme larghe
 *  intermediate  carena piena senza alette, scarico laterale basso
 *  lightweight   moto più compatta e stretta, ruote più piccole
 *  rookies       come la lightweight, livrea monomarca
 *
 * Le zone (motore, telaio, sospensioni, freni, aerodinamica, elettronica) si possono evidenziare e cliccare.
 */
export function BikeArt({
  tier,
  colors,
  number,
  width = 40,
  zones = [],
  selected = null,
  onSelect,
  labels = {},
  schematic = false,
}: {
  tier: BikeTier;
  colors: { primary: string; secondary: string };
  number?: number | null;
  width?: number;
  /** Zone selezionabili (i gruppi tecnici della categoria). */
  zones?: BikeZone[];
  selected?: BikeZone | null;
  onSelect?: (z: BikeZone) => void;
  /** Nome del gruppo per ogni zona (per accessibilità). */
  labels?: Partial<Record<BikeZone, string>>;
  /** Stile da schema tecnico: disegno desaturato e scuro, così risalta solo la zona selezionata. */
  schematic?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const small = tier === 'lightweight' || tier === 'rookies';
  const wings = tier === 'premier';
  const p = colors.primary,
    s = colors.secondary;
  const ink = luminance(p) > 0.6 ? '#16171a' : '#f3f1ec';
  // Zona invisibile finché non la si indica col mouse o la si seleziona (CSS .bz / .bz.on).
  const zone = (z: BikeZone) => ({
    className: `bz ${selected === z ? 'on' : ''} ${onSelect ? 'click' : ''}`,
    onClick: () => onSelect?.(z),
  });

  const spokes = (cx: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      return (
        <line
          key={k}
          x1={cx + Math.cos(a) * 18}
          y1={470 + Math.sin(a) * 18}
          x2={cx + Math.cos(a) * 90}
          y2={470 + Math.sin(a) * 90}
          stroke="#2c2e34"
          strokeWidth={9}
          strokeLinecap="round"
        />
      );
    });

  return (
    <svg
      viewBox="0 0 1200 640"
      width={`${width}rem`}
      height={`${(width * 640) / 1200}rem`}
      className="bike-art"
      role="img"
      aria-label="Moto della squadra"
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id={id('gloss')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={id('screen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9bccd" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0b0e13" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={id('metal')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6e9ee" />
          <stop offset="0.5" stopColor="#8e949c" />
          <stop offset="1" stopColor="#c9ced5" />
        </linearGradient>
        <linearGradient id={id('ti')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9c7a8" />
          <stop offset="0.5" stopColor="#8d8a92" />
          <stop offset="1" stopColor="#4a4c55" />
        </linearGradient>
        <radialGradient id={id('tyre')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.78" stopColor="#1a1b1e" />
          <stop offset="0.93" stopColor="#0a0a0b" />
          <stop offset="1" stopColor="#2d2e33" />
        </radialGradient>
        <radialGradient id={id('rim')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3a3c42" />
          <stop offset="1" stopColor="#16171a" />
        </radialGradient>
        <pattern
          id={id('carbon')}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill="#1b1c20" />
          <rect width="4" height="8" fill="#26282d" />
        </pattern>
        <filter id={id('glow')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id('schema')}>
          <feColorMatrix type="saturate" values="0.1" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="0.55" />
            <feFuncG type="linear" slope="0.6" />
            <feFuncB type="linear" slope="0.75" />
          </feComponentTransfer>
        </filter>
      </defs>

      {/* Ombra a terra */}
      <ellipse cx={600} cy={598} rx={440} ry={14} fill="#000" opacity={0.4} />
      <g
        transform={small ? 'translate(48 48) scale(0.92)' : undefined}
        filter={schematic ? `url(#${id('schema')})` : undefined}
      >
        {/* Ruota posteriore: gomma, cerchio, corona */}
        <circle cx={300} cy={470} r={125} fill={`url(#${id('tyre')})`} />
        <circle cx={300} cy={470} r={100} fill="#0c0d0f" />
        <circle cx={300} cy={470} r={96} fill={`url(#${id('rim')})`} />
        {spokes(300)}
        <circle
          cx={300}
          cy={470}
          r={44}
          fill="none"
          stroke="#7d828a"
          strokeWidth={10}
          strokeDasharray="4 4"
        />
        <circle cx={300} cy={470} r={14} fill="#a6abb2" />

        {/* Scarico (MotoGP: sotto il codone; altre: laterale basso) */}
        {tier === 'premier' ? (
          <path
            d="M590,504 C540,504 470,474 430,414 C410,384 392,350 378,318 L414,300 C428,332 446,366 464,394 C500,446 548,470 594,474 Z"
            fill={`url(#${id('ti')})`}
            stroke="#25272c"
            strokeWidth={3}
          />
        ) : (
          <path
            d="M600,512 C540,520 470,512 420,488 L408,470 L426,462 C474,486 540,494 598,490 Z"
            fill={`url(#${id('ti')})`}
            stroke="#25272c"
            strokeWidth={3}
          />
        )}
        {/* Mono ammortizzatore */}
        <line x1={505} y1={300} x2={545} y2={396} stroke="#c99a2e" strokeWidth={16} strokeDasharray="5 4" />
        {/* Forcellone in alluminio e catena */}
        <path
          d="M562,382 C500,410 400,440 304,452 L300,488 C400,486 500,452 570,424 Z"
          fill={`url(#${id('metal')})`}
          stroke="#3b3e45"
          strokeWidth={3}
        />
        <path
          d="M300,428 L585,438 M300,512 L585,456"
          stroke="#55585f"
          strokeWidth={5}
          strokeDasharray="6 3"
        />
        <circle cx={585} cy={447} r={13} fill="#3a3c42" />

        {/* Motore (in gran parte coperto dalla carena) */}
        <path d="M560,330 L700,322 L740,420 L640,470 L566,456 Z" fill="#1c1e22" />

        {/* Ruota anteriore: gomma, cerchio, disco, forcella, pinza */}
        <circle cx={900} cy={470} r={125} fill={`url(#${id('tyre')})`} />
        <circle cx={900} cy={470} r={100} fill="#0c0d0f" />
        <circle cx={900} cy={470} r={96} fill={`url(#${id('rim')})`} />
        {spokes(900)}
        <circle cx={900} cy={470} r={78} fill="none" stroke={`url(#${id('metal')})`} strokeWidth={24} />
        <circle
          cx={900}
          cy={470}
          r={78}
          fill="none"
          stroke="#141518"
          strokeWidth={3}
          strokeDasharray="2 10"
        />
        <path d="M900,470 L812,252 L842,240 L922,462 Z" fill="#c99a2e" stroke="#6f541a" strokeWidth={3} />
        <path d="M884,430 L828,292 L846,286 L900,424 Z" fill={`url(#${id('metal')})`} opacity={0.9} />
        <rect
          x={826}
          y={392}
          width={46}
          height={30}
          rx={8}
          fill="#c99a2e"
          stroke="#6f541a"
          strokeWidth={2}
          transform="rotate(-68 849 407)"
        />
        <circle cx={900} cy={470} r={15} fill="#a6abb2" />

        {/* Codone con fianchetto sotto la sella, sella */}
        <path
          d={`M606,222 C560,212 510,208 470,208 C400,200 310,${wings ? 168 : 178} 222,${wings ? 150 : 160} C206,150 200,166 206,180 C232,196 300,214 380,240 C430,256 470,270 520,300 L556,304 Z`}
          fill={p}
          stroke="#000"
          strokeOpacity={0.45}
          strokeWidth={3}
        />
        <path
          d={`M606,222 C560,212 510,208 470,208 C400,200 310,${wings ? 168 : 178} 222,${wings ? 150 : 160} C206,150 200,166 206,180 C232,196 300,214 380,240 C430,256 470,270 520,300 L556,304 Z`}
          fill={`url(#${id('gloss')})`}
        />
        <path
          d={`M548,262 C460,246 330,${wings ? 206 : 214} 210,172 L208,182 C330,226 460,262 540,280 Z`}
          fill={s}
        />
        <path d="M606,222 C560,212 510,208 470,208 L472,220 C520,220 566,224 604,232 Z" fill="#141518" />
        {/* Parafango anteriore */}
        <path
          d="M806,372 C838,340 900,330 952,350 L948,362 C900,346 844,352 816,380 Z"
          fill={p}
          stroke="#000"
          strokeOpacity={0.4}
          strokeWidth={2}
        />

        {/* Carena laterale con pancia */}
        <path
          d="M966,298 C952,264 920,234 874,218 L772,202 C742,180 692,174 642,184 C626,192 614,206 606,222 L556,300 C540,334 536,384 550,424 L562,540 L762,540 L760,470 A140,140 0 0,1 876,332 C912,320 944,312 966,298 Z"
          fill={p}
          stroke="#000"
          strokeOpacity={0.5}
          strokeWidth={3}
        />
        {/* Livrea: fascia diagonale e pancia nel secondo colore */}
        <path
          d="M948,318 C860,338 720,372 572,404 L566,438 C720,410 840,378 900,356 C920,342 936,330 948,318 Z"
          fill={s}
        />
        <path d="M562,540 L762,540 L760,500 L560,500 Z" fill={s} opacity={0.9} />
        {/* Sfoghi laterali */}
        {[0, 1, 2].map((k) => (
          <path
            key={k}
            d={`M${742 - k * 22},${396 + k * 4} l-26,44 l9,0 l26,-44 Z`}
            fill="#0b0c0e"
            opacity={0.85}
          />
        ))}
        {/* Serbatoio in carbonio */}
        <path
          d="M772,202 C742,180 692,174 642,184 C626,192 614,206 606,222 L624,226 C644,204 690,192 744,200 Z"
          fill={`url(#${id('carbon')})`}
        />
        {/* Riflesso lucido */}
        <path
          d="M966,298 C952,264 920,234 874,218 L772,202 C742,180 692,174 642,184 C626,192 614,206 606,222 L556,300 C540,334 536,384 550,424 L562,540 L762,540 L760,470 A140,140 0 0,1 876,332 C912,320 944,312 966,298 Z"
          fill={`url(#${id('gloss')})`}
        />
        {/* Presa d'aria sul muso e cupolino */}
        <ellipse cx={958} cy={300} rx={9} ry={16} fill="#0b0c0e" />
        <path
          d="M874,218 C848,178 816,152 778,142 C772,162 770,184 772,202 Z"
          fill={`url(#${id('screen')})`}
          stroke="#0b0e13"
          strokeWidth={2}
        />

        {/* Alette aerodinamiche (solo MotoGP) */}
        {wings && (
          <g>
            <path d="M930,300 L996,282 L1004,294 L936,316 Z" fill="#141518" stroke={s} strokeWidth={3} />
            <path d="M912,326 L976,312 L982,324 L918,340 Z" fill="#141518" stroke={s} strokeWidth={3} />
          </g>
        )}

        {/* Numero di gara sul fianco */}
        {number !== null && number !== undefined && (
          <g>
            <ellipse cx={690} cy={318} rx={62} ry={44} fill={ink === '#16171a' ? '#141518' : '#f3f1ec'} />
            <text
              x={690}
              y={338}
              textAnchor="middle"
              fontFamily="Archivo, system-ui, sans-serif"
              fontWeight={900}
              fontStyle="italic"
              fontSize={56}
              fill={p}
              stroke="#000"
              strokeOpacity={0.3}
              strokeWidth={1.5}
            >
              {number}
            </text>
          </g>
        )}
      </g>

      {/* Zone selezionabili dei gruppi tecnici */}
      <g
        transform={small ? 'translate(48 48) scale(0.92)' : undefined}
        fill="#ff7a1a"
        fillOpacity={0.3}
        stroke="#ff7a1a"
        strokeWidth={5}
        filter={`url(#${id('glow')})`}
      >
        {zones.includes('engine') && (
          <path d="M560,320 L760,310 L762,470 L760,540 L562,540 L550,424 Z" {...zone('engine')}>
            <title>{labels.engine}</title>
          </path>
        )}
        {zones.includes('chassis') && (
          <path
            d="M606,222 L772,202 L700,320 L560,330 L570,424 C500,452 400,486 300,490 L304,450 C400,438 500,410 556,384 Z"
            {...zone('chassis')}
          >
            <title>{labels.chassis}</title>
          </path>
        )}
        {zones.includes('suspension') && (
          <path
            d="M900,470 L812,252 L842,240 L922,462 Z M498,298 L516,294 L556,394 L536,400 Z"
            {...zone('suspension')}
          >
            <title>{labels.suspension}</title>
          </path>
        )}
        {zones.includes('brakes') && (
          <g {...zone('brakes')}>
            <title>{labels.brakes}</title>
            <circle cx={900} cy={470} r={92} />
            <circle cx={300} cy={470} r={56} />
          </g>
        )}
        {zones.includes('aero') && (
          <path
            d="M966,298 C952,264 920,234 874,218 L848,178 L778,142 L772,202 L780,300 L876,332 L1004,294 Z"
            {...zone('aero')}
          >
            <title>{labels.aero}</title>
          </path>
        )}
        {zones.includes('electronics') && (
          <path d="M470,212 L606,222 L590,262 L470,250 Z" {...zone('electronics')}>
            <title>{labels.electronics}</title>
          </path>
        )}
      </g>
    </svg>
  );
}

function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
