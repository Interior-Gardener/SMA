import { state, PRESETS, setScenario, setLang, onChange, activePreset, api } from './state.js';
import { $, $$, applyChartDefaults } from './ui.js';
import * as overview from './pages/overview.js';
import * as mapPage from './pages/map.js';
import * as advisor from './pages/advisor.js';
import * as simulator from './pages/simulator.js';
import * as scheduler from './pages/scheduler.js';
import * as insights from './pages/insights.js';
import * as chat from './pages/chat.js';
import * as about from './pages/about.js';

const PAGES = {
  overview: { mod: overview, title: 'Overview', sub: 'Region-wide irrigation situation across 1,000 sugarcane plots', scenario: true },
  map: { mod: mapPage, title: 'Farm Map', sub: 'Geofenced plots coloured by model predictions', scenario: true },
  advisor: { mod: advisor, title: 'Farm Advisor', sub: 'Plot-specific irrigation, fertigation and risk advisory', scenario: true },
  simulator: { mod: simulator, title: 'What-If Simulator', sub: 'Change field conditions and watch the models respond live', scenario: false },
  scheduler: { mod: scheduler, title: 'Pump Scheduler', sub: 'Optimise who pumps when under limited 3-phase power', scenario: true },
  insights: { mod: insights, title: 'Model Insights', sub: 'How the AI works, how accurate it is and what drives it', scenario: false },
  chat: { mod: chat, title: 'Krishi Mitra', sub: 'Multilingual advisory assistant for farmers', scenario: true },
  about: { mod: about, title: 'About & Governance', sub: 'Problem, approach, responsible AI and team', scenario: false },
};

let current = null;
const stale = new Set(Object.keys(PAGES));

// ------------------------------------------------------------------ theme
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  applyChartDefaults();
}
let theme = null;
try { theme = localStorage.getItem('sma.theme'); } catch { /* ignore */ }
applyTheme(theme);
$('#themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('sma.theme', theme); } catch { /* ignore */ }
  applyTheme(theme);
  Object.keys(PAGES).forEach((p) => stale.add(p));
  show(current, true);
});

// ------------------------------------------------------------------ scenario bar
const SLIDERS = {
  forecastRain: (v) => `${v} mm`,
  tempAnomaly: (v) => `${v > 0 ? '+' : ''}${v} °C`,
  rhAnomaly: (v) => `${v > 0 ? '+' : ''}${v} %`,
  daysSinceObs: (v) => `${v} d`,
  pumpFlow: (v) => `${v} m³/h`,
};

function syncScenarioControls() {
  const s = state.scenario;
  for (const [k, f] of Object.entries(SLIDERS)) {
    $(`#s_${k}`).value = s[k];
    $(`#o_${k}`).textContent = f(s[k]);
  }
  $('#s_method').value = s.method;
  const p = activePreset();
  $$('#presetChips .chip').forEach((c) => c.classList.toggle('active', p && c.dataset.id === p.id));
  $('#scenarioDesc').textContent = p
    ? p.desc
    : `Custom scenario: ${s.forecastRain} mm rain forecast, ${SLIDERS.tempAnomaly(s.tempAnomaly)}, ${s.daysSinceObs} dry days since observation.`;
}

$('#presetChips').innerHTML = PRESETS.map((p) => `<button class="chip" data-id="${p.id}">${p.label}</button>`).join('');
$('#presetChips').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (b) setScenario(PRESETS.find((p) => p.id === b.dataset.id).s);
});
let debounce;
for (const k of Object.keys(SLIDERS)) {
  $(`#s_${k}`).addEventListener('input', (e) => {
    $(`#o_${k}`).textContent = SLIDERS[k](Number(e.target.value));
    clearTimeout(debounce);
    debounce = setTimeout(() => setScenario({ [k]: Number(e.target.value) }), 250);
  });
}
$('#s_method').addEventListener('change', (e) => setScenario({ method: e.target.value }));
$('#scenarioToggle').addEventListener('click', (e) => {
  const panel = $('#scenarioPanel');
  panel.hidden = !panel.hidden;
  e.target.setAttribute('aria-expanded', String(!panel.hidden));
  e.target.textContent = panel.hidden ? 'Adjust ▾' : 'Hide ▴';
});

$('#langSelect').value = state.lang;
$('#langSelect').addEventListener('change', (e) => setLang(e.target.value));

onChange((kind) => {
  syncScenarioControls();
  Object.keys(PAGES).forEach((p) => stale.add(p));
  if (kind === 'lang' && !['advisor', 'chat', 'map'].includes(current)) {
    stale.delete(current);
    return;
  }
  show(current, true);
});

// ------------------------------------------------------------------ routing
async function show(page, force = false) {
  if (!PAGES[page]) page = 'overview';
  const cfg = PAGES[page];
  current = page;
  $$('.page').forEach((s) => { s.hidden = s.dataset.page !== page; });
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  $('#pageTitle').textContent = cfg.title;
  $('#pageSub').textContent = cfg.sub;
  $('#scenarioBar').hidden = !cfg.scenario;
  $('#sidebar').classList.remove('open');
  if (force || stale.has(page)) {
    stale.delete(page);
    try {
      await cfg.mod.render();
    } catch (err) {
      console.error(err);
    }
  } else if (cfg.mod.shown) cfg.mod.shown();
}

window.addEventListener('hashchange', () => show(location.hash.slice(1).split('?')[0]));
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

// Other pages can ask to open a plot in the advisor
window.addEventListener('sma:open-farm', (e) => {
  advisor.open(e.detail);
  stale.add('advisor');
  if (location.hash === '#advisor') show('advisor', true);
  else location.hash = '#advisor';
});

(async function boot() {
  state.meta = await api('/meta');
  for (const mod of Object.values(PAGES).map((p) => p.mod)) mod.init?.();
  syncScenarioControls();
  show(location.hash.slice(1) || 'overview');
}());
