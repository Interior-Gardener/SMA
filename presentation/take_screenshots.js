/**
 * Captures screenshots of every page of the running app (used in the slides).
 *   npm start            # in one terminal
 *   npm run screenshots  # in another (needs: npm i -D playwright && npx playwright install chromium)
 */
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.SMA_URL || 'http://localhost:3000';
const OUT = path.join(__dirname, 'screenshots');
const DRY = { forecastRain: 0, tempAnomaly: 8, rhAnomaly: 0, daysSinceObs: 7, method: 'furrow', pumpFlow: 50 };

const SHOTS = [
  { name: '01_overview', hash: 'overview', scenario: DRY },
  { name: '02_map', hash: 'map', scenario: DRY, wait: 3000 },
  { name: '02b_map_zoom', hash: 'map', scenario: DRY, wait: 2500, taluk: 'Maddur', layer: 'stress' },
  { name: '03_advisor', hash: 'advisor', scenario: DRY, farm: 'MM-MD-0110', full: true },
  { name: '04_advisor_kannada', hash: 'advisor', scenario: DRY, farm: 'MM-MD-0110', lang: 'kn' },
  { name: '05_rain', hash: 'overview', scenario: { ...DRY, forecastRain: 40 } },
  { name: '06_simulator', hash: 'simulator', scenario: DRY, preset: 'Heat wave, dry soil' },
  { name: '07_scheduler', hash: 'scheduler', scenario: DRY, run: true },
  { name: '08_insights', hash: 'insights', scenario: DRY, full: true },
  { name: '09_chat', hash: 'chat', scenario: DRY, chat: ['When should I irrigate MM-MD-0110?', 'MM-MD-0110 ಗೆ ಯಾವಾಗ ನೀರು ಹಾಯಿಸಬೇಕು?'] },
  { name: '10_about', hash: 'about', scenario: DRY },
];

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: s.dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${s.name}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/tile|Failed to load resource/.test(m.text())) errors.push(`${s.name}: ${m.text()}`); });
    await page.addInitScript(({ scenario, farm, lang }) => {
      localStorage.setItem('sma.scenario', JSON.stringify(scenario));
      localStorage.setItem('sma.lang', JSON.stringify(lang || 'en'));
      if (farm) localStorage.setItem('sma.farm', JSON.stringify(farm));
      localStorage.setItem('sma.theme', 'light');
    }, s);
    await page.goto(`${BASE}/#${s.hash}`);
    await page.waitForTimeout(s.wait || 1800);
    if (s.taluk) { await page.selectOption('#mapTaluk', s.taluk); await page.waitForTimeout(800); }
    if (s.layer) { await page.selectOption('#mapLayer', s.layer); await page.waitForTimeout(500); }
    if (s.clickPlot) {
      await page.evaluate(() => document.querySelector('#map').scrollIntoView());
      const shapes = await page.$$('.leaflet-interactive');
      if (shapes.length) await shapes[Math.floor(shapes.length / 2)].click({ force: true });
      await page.waitForTimeout(600);
    }
    if (s.preset) { await page.click(`#simPresets .chip:has-text("${s.preset}")`); await page.waitForTimeout(900); }
    if (s.run) { await page.click('#schRun'); await page.waitForTimeout(1200); }
    if (s.chat) {
      for (const q of s.chat) { await page.fill('#chatInput', q); await page.press('#chatInput', 'Enter'); await page.waitForTimeout(700); }
    }
    await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: !!s.full });
    await ctx.close();
    console.log('saved', s.name);
  }
  await browser.close();
  if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exitCode = 1; }
})();
