/**
 * Test end-to-end dell'app: `npm run e2e` (richiede `npm run build`).
 * Avvia `vite preview`, guida un browser vero (Playwright) lungo il flusso principale e salva gli screenshot
 * in test-results/screenshots/ (cartella ignorata da Git: artefatti temporanei, non nel repository). Fallisce se un passo non trova i dati attesi o se ci sono errori in console.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const SHOTS = process.env.E2E_SHOTS !== '0';
const SHOT_DIR = path.join(__dirname, '..', '..', 'test-results', 'screenshots');
require('node:fs').mkdirSync(SHOT_DIR, { recursive: true });

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
    // WebGL software (SwiftShader): la vista 3D funziona anche senza scheda grafica.
    browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const warnings = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
      if (m.type() === 'warning' && /WebGL/i.test(m.text())) warnings.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name) => SHOTS && page.screenshot({ path: path.join(SHOT_DIR, `app-${name}.png`) });
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
    await page.locator('.topbar h2', { hasText: 'Home' }).waitFor();
    await page.getByText('Teo Varriale').first().waitFor();
    if (!(await page.locator('.topbar').innerText()).includes('mln'))
      throw new Error('Il saldo non è espresso in milioni');
    await page.getByText('Preparazione alla stagione').waitFor();
    await shot('03-home');
    step('home con piloti reali e guida per iniziare');

    for (const [label, expect, name] of [
      ['Scuderia', 'Strutture', '04-scuderia'],
      ['Piloti', 'Attributi', '05-piloti'],
      ['Personale tecnico', 'Competenze', '06-personale'],
      ['Calendario', 'Calendario della stagione', '07-calendario'],
      ['Finanze', 'Soldi in cassa', '10-finanze'],
    ]) {
      await page.locator('.nav').getByRole('button', { name: label, exact: true }).click();
      await page.locator('.main').getByText(expect).first().waitFor();
      await shot(name);
      step(`schermata ${label}`);
    }

    // Scheda piloti: switch fra i titolari e schede.
    await page.locator('.nav').getByRole('button', { name: 'Piloti', exact: true }).click();
    const cards = page.locator('.rs-card');
    await page.locator('.rh-id h1').waitFor();
    if ((await cards.count()) < 2) throw new Error('Mancano i due titolari nel selettore');
    const first = await page.locator('.rh-id h1').innerText();
    await cards.nth(1).click();
    await page.waitForFunction(
      (f) => document.querySelector('.rh-id h1')?.textContent !== f.replace('\n', ''),
      first,
    );
    const second = await page.locator('.rh-id h1').innerText();
    if (first === second) throw new Error('Lo switch non cambia pilota');
    if ((await page.locator('.rider-hero img.flag').count()) < 1) throw new Error('Bandiera mancante');
    for (const t of [
      'Attributi',
      'Risultati',
      'Contratto',
      'Relazioni',
      'Preferenze tecniche',
      'Storico',
      'Panoramica',
    ])
      await page.getByRole('tab', { name: t, exact: true }).click();
    await shot('05-piloti');
    step(`switch piloti: ${first.replace('\n', ' ')} → ${second.replace('\n', ' ')}`);

    await page.locator('.nav').getByRole('button', { name: 'Sponsor' }).click();
    await page.locator('.offers .btn.primary').waitFor();
    await shot('16-sponsor');
    await page.locator('.offers .btn.primary').click();
    await page.getByText('Sponsor della stagione').waitFor();
    step('sponsor con obiettivo firmato');

    await page.locator('.nav').getByRole('button', { name: 'Moto e upgrade' }).click();
    await page.locator('.gx-card', { hasText: 'Motore e trasmissione' }).click();
    await page.getByRole('button', { name: /^Sviluppa: ordina livello 1/ }).click();
    await page.getByText(/ordinato alla fabbrica/).waitFor();
    await page.getByText('In produzione').first().waitFor();
    await shot('17-moto');
    step('upgrade ordinato alla fabbrica');

    await page.locator('.nav').getByRole('button', { name: 'Mercato piloti' }).click();
    await page.getByText('Contratto attuale').waitFor();
    await page.locator('.mk-table tbody tr', { hasText: 'Team Meridian' }).first().click();
    await page.getByText('Clausola rescissoria').first().waitFor();
    await page.locator('#offer-salary').fill('0,30');
    await page.getByRole('button', { name: /Invia offerta/ }).click();
    await page.locator('.mk-round').first().waitFor();
    await shot('08-mercato');
    step('mercato: ' + (await page.locator('.mk-round').first().innerText()).split('\n').pop());

    // Weekend di gara completo.
    const today = () => page.locator('.topbar .kpi', { hasText: 'Oggi' }).locator('b').innerText();
    const dateBefore = await today();
    await page
      .locator('.topbar')
      .getByRole('button', { name: /Vai al Gran Premio/ })
      .click();
    await page.getByRole('button', { name: 'Corri Prove libere 1' }).waitFor();
    const dateAfter = await today();
    if (dateAfter === dateBefore) throw new Error('La data non è avanzata');
    step(`avanzamento al Gran Premio: ${dateBefore} → ${dateAfter}`);
    await page.locator('.wx-box').waitFor();
    await shot('11-weekend');
    // Prove libere 1 con programma "Assetto", poi riunione tecnica con il capotecnico.
    await page.getByRole('button', { name: 'Programma Assetto' }).first().click();
    await page.getByRole('button', { name: 'Corri Prove libere 1', exact: true }).click();
    await page.locator('.wk-sess.done', { hasText: 'Prove libere 1' }).first().waitFor();
    await page.getByText('Riunione tecnica').waitFor();
    await page.getByText('Confidenza col circuito').waitFor();
    const logBefore = await page.locator('.brief-log li').count();
    const applyBtn = page.getByRole('button', { name: /^Applica: / });
    if ((await applyBtn.count()) > 0 && (await applyBtn.isEnabled())) {
      await applyBtn.click();
      await page.waitForFunction((n) => document.querySelectorAll('.brief-log li').length > n, logBefore);
      step('riunione tecnica: consiglio del capotecnico applicato, minuti scalati e cronologia aggiornata');
    } else step('riunione tecnica: nessuna modifica consigliata');
    await shot('11-briefing');
    for (const name of ['Prove', 'Prove libere 2', 'Qualifiche 1', 'Qualifiche 2']) {
      await page.getByRole('button', { name: `Corri ${name}`, exact: true }).click();
      await page.locator('.wk-sess.done', { hasText: name }).first().waitFor();
    }
    await page.getByText('Griglia di partenza').waitFor();
    await page.getByText('Consiglio dell’ingegnere').first().waitFor();
    await shot('11-strategia');
    step('prove libere, Prove, Q1 e Q2 con gomme a scelta');
    await page.getByRole('button', { name: 'Via alla Sprint!' }).click();
    await page.locator('.rv-canvas').waitFor();
    await page.getByRole('button', { name: '16×' }).click();
    await page.waitForFunction(
      () => parseInt(document.querySelector('.rv-lap b')?.textContent ?? '0', 10) >= 2,
      null,
      { timeout: 20000 },
    );
    await shot('12-gara');

    // --- Cambio 2D ↔ 3D: la gara non si riavvia e non cambia ---
    const snap = async () => ({
      clock: await page.locator('.rv-clock').innerText(),
      lap: await page.locator('.rv-lap b').innerText(),
      board: await page.locator('.rv-board li .num').allInnerTexts(),
    });
    await page.getByRole('button', { name: '❚❚' }).click();
    await page.waitForTimeout(300);
    const before = await snap();
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await page.locator('.rv-3d canvas').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const in3d = await snap();
    if (JSON.stringify(in3d) !== JSON.stringify(before))
      throw new Error('Il passaggio al 3D ha cambiato la gara: ' + JSON.stringify({ before, in3d }));
    if (!(await page.getByRole('button', { name: '❚❚' }).evaluate((b) => b.classList.contains('on'))))
      throw new Error('La pausa non è stata mantenuta');
    await shot('12-gara-3d');
    await page.getByRole('button', { name: '2D', exact: true }).click();
    await page.waitForTimeout(500);
    if (JSON.stringify(await snap()) !== JSON.stringify(before))
      throw new Error('Il ritorno al 2D ha cambiato la gara');
    // Velocità mantenuta e tempo che continua a scorrere dopo il cambio.
    await page.getByRole('button', { name: '4×' }).click();
    await page.getByRole('button', { name: '3D', exact: true }).click();
    await page.locator('.rv-3d canvas').waitFor({ timeout: 30000 });
    if (!(await page.getByRole('button', { name: '4×' }).evaluate((b) => b.classList.contains('on'))))
      throw new Error('La velocità è cambiata passando al 3D');
    await page.waitForTimeout(2000);
    if ((await snap()).clock === before.clock) throw new Error('Il tempo di gara non scorre in 3D');
    // Cambi ripetuti: niente contesti 3D accumulati, una sola tela per volta, memoria stabile.
    const heap = () => page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    const h0 = await heap();
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: '2D', exact: true }).click();
      await page.waitForTimeout(150);
      await page.getByRole('button', { name: '3D', exact: true }).click();
      await page.locator('.rv-3d canvas').waitFor({ timeout: 30000 });
      await page.waitForTimeout(250);
    }
    const canv = await page.locator('.rv-stage canvas').count();
    const h1 = await heap();
    if (canv !== 1) throw new Error(`Tele sovrapposte dopo i cambi: ${canv}`);
    if (warnings.some((w) => /too many active WebGL contexts/i.test(w)))
      throw new Error('Contesti WebGL non liberati');
    await page.getByRole('button', { name: '2D', exact: true }).click();
    step(
      `2D↔3D: stessa gara in pausa (${before.clock}, giro ${before.lap.replace('\n', '')}), velocità mantenuta, ` +
        `10 cambi senza perdite (memoria JS ${Math.round(h0 / 1e6)} → ${Math.round(h1 / 1e6)} MB)`,
    );
    if ((await page.locator('.rv-rider').count()) !== 2) throw new Error('Pannelli piloti mancanti');
    step('Sprint in 2D: giro ' + (await page.locator('.rv-lap b').innerText()) + ', 2 pannelli piloti');

    // --- Strategia in diretta: il cambio arriva al motore e vale per il resto della gara ---
    const panel = page.locator('.rv-rider').first();
    await panel.getByRole('button', { name: 'Attacco massimo' }).click();
    await panel.getByRole('button', { name: 'Prestazione' }).first().click();
    await page.getByRole('button', { name: '4×' }).click();
    await page.waitForTimeout(2500);
    if (
      !(await panel
        .getByRole('button', { name: 'Attacco massimo' })
        .evaluate((b) => b.classList.contains('on')))
    )
      throw new Error('La strategia scelta non è attiva');
    await panel.getByText(/Carburante per/).waitFor();
    await page.getByRole('button', { name: '❚❚' }).click();
    await shot('12-gara-strategia');
    const lapBefore = parseInt(await page.locator('.rv-lap b').innerText(), 10);
    // --- Salvataggio a metà gara, ritorno al menu, caricamento: la gara riprende da lì ---
    await page.getByRole('button', { name: 'Salva' }).click();
    await page.getByText(/Partita salvata/).waitFor();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: /Continua carriera/ }).click();
    await page.locator('.nav button', { hasText: 'Weekend di gara' }).click();
    await page.locator('.rv-lap b').waitFor({ timeout: 20000 });
    const lapAfter = parseInt(await page.locator('.rv-lap b').innerText(), 10);
    if (Math.abs(lapAfter - lapBefore) > 1)
      throw new Error(`Ripresa a un giro diverso: ${lapBefore} → ${lapAfter}`);
    if (
      !(await page
        .locator('.rv-rider')
        .first()
        .getByRole('button', { name: 'Attacco massimo' })
        .evaluate((b) => b.classList.contains('on')))
    )
      throw new Error('Dopo il caricamento la strategia non è quella salvata');
    step(
      `gara in diretta: strategia cambiata, salvata a metà (giro ${lapBefore}) e ripresa (giro ${lapAfter})`,
    );
    await page.getByRole('button', { name: 'Salta alla fine' }).click();
    await page.getByRole('button', { name: 'Corri Warm Up', exact: true }).click();
    await page.getByRole('button', { name: 'Via alla gara!' }).click();
    await page.locator('.rv-canvas').waitFor();
    await page.getByRole('button', { name: 'Salta alla fine' }).click();
    await page.getByRole('button', { name: 'Rivedi la gara' }).first().waitFor();
    await shot('13-risultati');
    step('gara e risultati');

    await page.locator('.nav button', { hasText: 'Moto e upgrade' }).click();
    await page.locator('.gx-card').first().waitFor();
    const nCards = await page.locator('.gx-card').count();
    if (nCards !== 6) throw new Error(`Il garage MotoGP deve mostrare 6 schede, ne mostra ${nCards}`);
    if ((await page.locator('.bike-photo').count()) !== 0)
      throw new Error('Foto esterna della moto ancora presente');
    await page.getByRole('button', { name: 'Moto B', exact: true }).click();
    await page.getByRole('button', { name: 'Moto A', exact: true }).click();
    await page.locator('.gx-card', { hasText: 'Freni' }).click();
    await page.locator('.gx-detail h3', { hasText: 'Freni' }).waitFor();
    // La zona dei freni si illumina nello schema tecnico; cliccando la zona del motore si seleziona quel gruppo.
    await page.locator('.gx-schema .bz.on').waitFor();
    await page.locator('.gx-schema', { hasText: 'Freni' }).waitFor();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    await shot('18-garage');
    await page.getByRole('button', { name: /^Ordina ricambio/ }).click();
    await page.getByText(/ricambio ordinato/).waitFor();
    await page.getByRole('button', { name: /Sostituisci con ricambio \(1 in magazzino\)/ }).click();
    await page.getByText(/sostituito con un ricambio/).waitFor();
    await page.getByRole('tab', { name: 'Assetto' }).click();
    const slider = page.locator('.gx-sliders input').first();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Applica assetto' }).click();
    await page.getByText(/Assetto asciutto di .* salvato/).waitFor();
    await shot('18-garage-assetto');
    if ((await page.getByRole('button', { name: 'Versione attuale' }).count()) !== 0)
      throw new Error('Il selettore del vecchio garage è ancora presente');
    step('garage: 6 schede, schema tecnico, Moto A/B, ricambio ordinato e montato, assetto salvato');

    await page.locator('.nav button', { hasText: 'Classifiche' }).click();
    await page.getByText('Classifica piloti').waitFor();
    if ((await page.locator('table.std tbody tr').count()) < 10) throw new Error('Classifica vuota');
    await shot('14-classifiche');
    await page.locator('.nav button', { hasText: 'Notizie' }).click();
    await page.getByText(/vince/).first().waitFor();
    await shot('15-notizie');
    step('classifiche e notizie aggiornate');

    await page.getByRole('button', { name: 'Salva' }).click();
    await page.getByText(/Partita salvata/).waitFor();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('button', { name: /Continua carriera/ }).click();
    await page.locator('.kpi', { hasText: 'Oggi' }).getByText(dateAfter).waitFor();
    step('salvataggio e caricamento dal menu');

    // Crea la tua squadra
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
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
    if (errors.length) console.error('Errori in pagina:\n' + errors.join('\n'));
    if (page) await page.screenshot({ path: path.join(SHOT_DIR, 'e2e-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server.kill();
  }
})();
