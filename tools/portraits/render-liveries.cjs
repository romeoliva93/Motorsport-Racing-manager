// Disegna la moto di ogni squadra (tools/portraits/teams.json) in tools/portraits/out/liveries/<squadra>.png,
// base per teambikes.py. Avvia il server di sviluppo di Vite e usa Playwright.
//   node tools/portraits/render-liveries.cjs
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const teams = JSON.parse(fs.readFileSync(path.join(__dirname, 'teams.json'), 'utf8'));
  const out = path.join(__dirname, 'out', 'liveries');
  fs.mkdirSync(out, { recursive: true });
  const srv = spawn('npx', ['vite', '--port', '4193', '--strictPort'], {
    cwd: path.join(__dirname, '..', '..', 'apps', 'client'),
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 4000));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 800 } });
  for (const t of teams) {
    const q = `tier=${t.tier}&p=${t.primary.slice(1)}&s=${t.secondary.slice(1)}`;
    await p.goto(`http://localhost:4193/livery.html?${q}`);
    await p.locator('#shot svg').waitFor();
    await p.locator('#shot').screenshot({ path: path.join(out, `${t.key}.png`) });
  }
  await b.close();
  srv.kill();
  console.log('disegnate', teams.length);
})();
