import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = join(__dirname, '..', 'assets');
const atlas = JSON.parse(readFileSync(join(ASSETS, 'atlas', 'index.json'), 'utf8')) as {
  cols: number;
  rows: Record<string, number>;
  map: Record<string, [number, number, number]>;
};
const roster = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'tools', 'portraits', 'roster.json'), 'utf8'),
) as {
  key: string;
}[];

describe('atlanti dei ritratti', () => {
  it('ogni ritratto originale è nel foglio, e solo quelli', () => {
    const files = readdirSync(join(ASSETS, 'portraits'))
      .filter((f) => f.endsWith('.webp'))
      .map((f) => f.replace('.webp', ''))
      .sort();
    expect(Object.keys(atlas.map).sort()).toEqual(files);
  });
  it('ogni personaggio del mondo fisso ha la sua casella', () => {
    for (const p of roster) expect(atlas.map[p.key], p.key).toBeDefined();
  });
  it('nessuna casella è usata due volte e tutte stanno dentro il foglio', () => {
    const seen = new Set<string>();
    for (const [sheet, c, r] of Object.values(atlas.map)) {
      const k = `${sheet}-${c}-${r}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(c).toBeLessThan(atlas.cols);
      expect(r).toBeLessThan(atlas.rows[String(sheet)]!);
      expect(existsSync(join(ASSETS, 'atlas', `sheet-${sheet}.webp`))).toBe(true);
    }
  });
});
