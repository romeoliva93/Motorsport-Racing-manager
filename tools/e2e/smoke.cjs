/**
 * Test end-to-end dell'app: `npm run e2e` (richiede `npm run build`).
 * Avvia `vite preview`, guida un browser vero (Playwright) lungo il flusso principale e salva gli screenshot
 * in docs/images/app-*.png. Fallisce se un passo non trova i dati attesi o se ci sono errori in console.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const SHOTS = process.env.E2E_SHOTS !== '0';

async function waitForServer(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Il server di anteprima non risponde');
}

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: path.join(ROOT, 'apps/client'),
    stdio: 'ignore',
  });
  const errors = [];
  let browser;
  let page;
  try {
    await waitForServer(URL);
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name) =>
      SHOTS && page.screenshot({ path: path.join(ROOT, `docs/images/app-${name}.png`) });
    const step = (msg) => console.log('✓', msg);

    await page.goto(URL);
    await page.getByRole('button', { name: /Nuova carriera/ }).waitFor();
    await shot('01-menu');
    step('menu principale');

    await page.getByRole('button', { name: /Nuova carriera/ }).click();
    if (await page.getByLabel('Seme del mondo').count())
      throw new Error('Il campo "seme del mondo" non deve comparire');
    await page.getByLabel('Nome della carriera').fill('Carriera E2E');
    await page.getByRole('button', { name: /^MotoGP/ }).waitFor();
    const lupo = page.locator('.nc-team', { hasText: 'Scuderia Lupo Blu' });
    await lupo.waitFor();
    await lupo.click();
    await page.getByText('Teo Varriale').first().waitFor();
    await shot('02-nuova-carriera');
    step('scelta squadra con dati del mondo generato');

    await page.getByRole('button', { name: /Inizia la carriera/ }).click();
    await page.locator('.topbar h2', { hasText: 'Panoramica' }).waitFor();
    await page.getByText('Anja Kessler').first().waitFor();
    if (!(await page.locator('.topbar').innerText()).includes('mln'))
      throw new Error('Il saldo non è espresso in milioni');
    await shot('03-panoramica');
    step('panoramica con piloti e staff reali');

    for (const [label, expect, name] of [
      ['Scuderia', 'Strutture', '04-scuderia'],
      ['Piloti', 'Attributi', '05-piloti'],
      ['Personale', 'Competenze', '06-personale'],
      ['Calendario', 'Calendario della stagione', '07-calendario'],
    ]) {
      await page.locator('.nav button', { hasText: label }).click();
      await page.getByText(expect).first().waitFor();
      await shot(name);
      step(`schermata ${label}`);
    }
    if (!(await page.locator('.nav button', { hasText: 'Finanze' }).isDisabled()))
      throw new Error('Le Finanze dovrebbero essere disabilitate (non sviluppate)');
    step('voci non sviluppate disabilitate');

    await page.locator('.nav button', { hasText: 'Mercato' }).click();
    await page.getByText('Contratto attuale').waitFor();
    await page.locator('.mk-table tbody tr', { hasText: 'Team Meridian' }).first().click();
    await page.getByText('Clausola rescissoria').first().waitFor();
    await page.locator('#offer-salary').fill('0,30');
    await page.getByRole('button', { name: /Invia offerta/ }).click();
    await page.locator('.mk-round').first().waitFor();
    await shot('08-mercato');
    step('mercato: ' + (await page.locator('.mk-round').first().innerText()).split('\n').pop());

    const dateBefore = await page.locator('.topbar .kpi', { hasText: 'Data' }).locator('b').innerText();
    await page.getByRole('button', { name: /Continua/ }).click();
    await page.getByText(/Arrivati al round 1/).waitFor();
    await page.waitForFunction(
      (before) => {
        const k = [...document.querySelectorAll('.topbar .kpi')].find((e) =>
          e.textContent.startsWith('Data'),
        );
        return k && !k.textContent.includes(before);
      },
      dateBefore,
      { timeout: 5000 },
    );
    const dateAfter = await page.locator('.topbar .kpi', { hasText: 'Data' }).locator('b').innerText();
    if (dateAfter === dateBefore) throw new Error('La data non è avanzata');
    await page.locator('.nav button', { hasText: 'Calendario' }).click();
    await page.getByText('Raggiunto').first().waitFor();
    step(`avanzamento del tempo: ${dateBefore} → ${dateAfter}`);

    await page.getByRole('button', { name: 'Salva' }).click();
    await page.getByText(/Partita salvata/).waitFor();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: /Continua carriera/ }).click();
    await page.locator('.kpi', { hasText: 'Data' }).getByText(dateAfter).waitFor();
    step('salvataggio e caricamento dal menu');

    // Crea la tua squadra
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: /Crea la tua squadra/ }).click();
    await page.locator('#team-name').fill('Racing Team Vesuvio');
    await page.locator('#team-city').fill('Napoli');
    await page.getByRole('button', { name: /^Moto2$/ }).click();
    await shot('09-crea-squadra');
    await page.getByRole('button', { name: /Crea la squadra/ }).click();
    await page.locator('.topbar h2', { hasText: 'Mercato' }).waitFor();
    await page.getByRole('button', { name: 'Senza contratto' }).click();
    await page.locator('.mk-table tbody tr', { hasText: 'Libero' }).first().waitFor();
    await page.locator('.mk-table tbody tr').first().click();
    await page.getByText('Pilota senza contratto').waitFor();
    await page.locator('#offer-salary').fill('3,00');
    await page.getByRole('button', { name: /Invia offerta/ }).click();
    await page
      .getByText(/Firmato|firmare|contratto firmato/)
      .first()
      .waitFor();
    step('crea la tua squadra e ingaggio di un pilota libero');

    if (errors.length) throw new Error('Errori in console:\n' + errors.join('\n'));
    console.log('E2E OK');
  } catch (e) {
    console.error('E2E FALLITO:', e.message);
    if (page) await page.screenshot({ path: path.join(ROOT, 'e2e-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.kill();
  }
})();
