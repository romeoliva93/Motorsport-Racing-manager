import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Stessa regola del componente TeamBike (non importato: usa import.meta.glob, solo nel browser).
const teamSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const teams = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'tools', 'portraits', 'teams.json'), 'utf8'),
) as { key: string; name: string }[];

describe('foto delle moto per squadra', () => {
  it('ogni squadra del mondo fisso ha la sua foto, trovata dal nome', () => {
    expect(teams.length).toBe(41);
    for (const t of teams) {
      expect(teamSlug(t.name), t.name).toBe(t.key);
      expect(existsSync(join(__dirname, '..', 'assets', 'teambikes', `${t.key}.webp`)), t.key).toBe(true);
    }
  });
  it('lo stesso nome nel componente e nel file', () => {
    const src = readFileSync(join(__dirname, 'TeamBike.tsx'), 'utf8');
    expect(src).toContain(".normalize('NFD')");
  });
});
