import type { CSSProperties, ReactNode } from 'react';
import { formatCredits } from '@lean-angle/core';

export function Card({
  title,
  aside,
  children,
  className = '',
  style,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`card ${className}`} style={style}>
      {title !== undefined && (
        <h3>
          <span>{title}</span>
          {aside !== undefined && <small>{aside}</small>}
        </h3>
      )}
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="row">
      <span className="muted">{label}</span>
      <b style={{ textAlign: 'right' }}>{children}</b>
    </div>
  );
}

export function Bar({
  value,
  max = 100,
  tone,
}: {
  value: number;
  max?: number;
  tone?: 'ok' | 'warn' | 'bad' | 'info';
}) {
  const colors = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)' };
  return (
    <div className="bar" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span
        style={{
          width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
          ...(tone ? { background: colors[tone] } : {}),
        }}
      />
    </div>
  );
}

export function Kpi({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <b className={tone}>{value}</b>
    </div>
  );
}

export function Money({ value }: { value: number }) {
  return <span className={value < 0 ? 'bad' : undefined}>{formatCredits(value)}</span>;
}

/** Stemma della squadra generato dai colori ufficiali e dalla sigla (in attesa dei loghi definitivi). */
export function TeamBadge({
  colors,
  short,
  size = 2.2,
}: {
  colors: { primary: string; secondary: string };
  short: string;
  size?: number;
}) {
  const light = isLight(colors.primary);
  return (
    <div
      className="team-badge"
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        fontSize: `${size * 0.36}rem`,
        background: `linear-gradient(135deg, ${colors.primary} 0 55%, ${colors.secondary} 55%)`,
        color: light ? '#111' : '#fff',
        textShadow: light ? 'none' : undefined,
      }}
      aria-hidden
    >
      {short}
    </div>
  );
}

/** Monogramma della persona finché non sono disponibili le fotografie (ADR-0004). */
export function Monogram({
  name,
  color = '#2a6cf0',
  size = 2.4,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('');
  return (
    <div
      className="monogram"
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        fontSize: `${size * 0.36}rem`,
        background: `linear-gradient(160deg, ${color}, #0d1018)`,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function ratingTone(v: number): 'ok' | 'warn' | 'bad' | undefined {
  return v >= 75 ? 'ok' : v >= 60 ? undefined : v >= 45 ? 'warn' : 'bad';
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
