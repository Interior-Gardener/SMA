import { api, state } from '../state.js';
import { $, $$, fmt, chart, axis, series, cssVar, esc, hbars, STRESS, stressBadge, riskBadge } from '../ui.js';

const FIELDS = [
  { k: 'soil_moisture', label: 'Soil moisture (m³/m³)', min: 0.08, max: 0.4, step: 0.005, d: 3 },
  { k: 'crop_age_days', label: 'Crop age (days after planting)', min: 0, max: 365, step: 5, d: 0 },
  { k: 'temperature_c', label: 'Temperature (°C)', min: 15, max: 40, step: 0.5, d: 1 },
  { k: 'relative_humidity', label: 'Relative humidity (%)', min: 25, max: 98, step: 1, d: 0 },
  { k: 'forecast_rain_mm', label: 'Forecast rain, next 3 days (mm)', min: 0, max: 80, step: 1, d: 0 },
  { k: 'ndvi', label: 'NDVI (crop vigour)', min: 0.15, max: 0.85, step: 0.01, d: 2 },
  { k: 'lai', label: 'Leaf Area Index', min: 0.1, max: 1.5, step: 0.05, d: 2 },
  { k: 'soil_ph', label: 'Soil pH', min: 5, max: 8.5, step: 0.1, d: 1 },
  { k: 'organic_carbon', label: 'Organic carbon (g/kg)', min: 3, max: 20, step: 0.5, d: 1 },
  { k: 'rainfall_mm', label: 'Seasonal rainfall (mm)', min: 400, max: 900, step: 10, d: 0 },
];

const PRESETS = [
  { label: 'Healthy grand growth', v: { soil_moisture: 0.24, crop_age_days: 200, temperature_c: 27, relative_humidity: 72, forecast_rain_mm: 0, ndvi: 0.66 } },
  { label: 'Heat wave, dry soil', v: { soil_moisture: 0.15, crop_age_days: 180, temperature_c: 36, relative_humidity: 40, forecast_rain_mm: 0, ndvi: 0.55 } },
  { label: 'Young crop, drying', v: { soil_moisture: 0.19, crop_age_days: 40, temperature_c: 31, relative_humidity: 55, forecast_rain_mm: 0, ndvi: 0.3 } },
  { label: 'Heavy rain coming', v: { soil_moisture: 0.18, crop_age_days: 150, temperature_c: 29, relative_humidity: 80, forecast_rain_mm: 45, ndvi: 0.6 } },
  { label: 'Humid & waterlogged', v: { soil_moisture: 0.33, crop_age_days: 220, temperature_c: 27, relative_humidity: 92, forecast_rain_mm: 30, ndvi: 0.62 } },
];

let values = null;
const extra = { method: 'furrow', pumpFlow: 50, area_ha: 0.74 };
let timer;

export function init() {
  const b = state.meta.baseline;
  values = Object.fromEntries(FIELDS.map((f) => [f.k, b[f.k] ?? 0]));
  $('#simPresets').innerHTML = PRESETS.map((p, i) => `<button class="chip" data-i="${i}">${p.label}</button>`).join('');
  $('#simPresets').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c) return;
    Object.assign(values, PRESETS[c.dataset.i].v);
    $$('#simPresets .chip').forEach((x) => x.classList.toggle('active', x === c));
    syncInputs();
    run();
  });

  $('#simInputs').innerHTML = FIELDS.map((f) => `
    <label>${f.label} <output id="so_${f.k}"></output>
      <input type="range" id="si_${f.k}" min="${f.min}" max="${f.max}" step="${f.step}"></label>`).join('') + `
    <div class="row2">
      <label>Method <select id="si_method"><option value="flood">Flood</option><option value="furrow" selected>Furrow</option><option value="sprinkler">Sprinkler</option><option value="drip">Drip</option></select></label>
      <label>Plot area (ha) <input type="number" id="si_area" value="0.74" min="0.1" max="20" step="0.05"></label>
    </div>`;
  for (const f of FIELDS) {
    $(`#si_${f.k}`).addEventListener('input', (e) => {
      values[f.k] = Number(e.target.value);
      $(`#so_${f.k}`).textContent = fmt(values[f.k], f.d);
      $$('#simPresets .chip').forEach((x) => x.classList.remove('active'));
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    });
  }
  $('#si_method').addEventListener('change', (e) => { extra.method = e.target.value; run(); });
  $('#si_area').addEventListener('change', (e) => { extra.area_ha = Number(e.target.value) || 0.74; run(); });
  syncInputs();
}

function syncInputs() {
  for (const f of FIELDS) {
    $(`#si_${f.k}`).value = values[f.k];
    $(`#so_${f.k}`).textContent = fmt(values[f.k], f.d);
  }
}

async function run() {
  const a = await api('/predict', { method: 'POST', body: { ...values, ...extra, lang: state.lang } });
  const out = $('#simOutput');
  const dueTxt = a.status === 'rain_skip' ? 'Skip (rain)' : a.dueInDays === 0 ? 'Today' : `${a.dueInDays} days`;
  out.innerHTML = `
    <div class="big-stats">
      <div class="big-stat"><span>Next irrigation</span><b>${dueTxt}</b><span>${fmt(a.daysToIrrigation, 1)} ± ${fmt(a.daysUncertainty, 1)} d (Random Forest)</span></div>
      <div class="big-stat"><span>Crop water requirement</span><b>${fmt(a.waterRequirementMm, 2)} mm/d</b><span>${esc(a.stage)} stage</span></div>
      <div class="big-stat"><span>Irrigation</span><b>${fmt(a.hours, 1)} h</b><span>${fmt(a.volumeM3)} m³ · ${fmt(a.netDepthMm, 0)} mm net</span></div>
      <div class="big-stat"><span>Expected yield</span><b>${fmt(a.yieldTHa, 1)} t/ha</b><span>loss if delayed 5 d: ${fmt(a.yieldLoss5DaysPct, 2)}%</span></div>
    </div>
    <div class="grid g-1-1" style="margin-top:16px">
      <div class="card">
        <div class="card-head"><h3>Water stress</h3>${stressBadge(a.stressClass)}</div>
        <div id="simStress"></div>
        <div class="card-head" style="margin-top:12px"><h3>Disease &amp; pest risk</h3>${riskBadge(a.riskClass)}</div>
        <ul class="advice-list">${a.advisory.map((l) => `<li><span>${esc(l.text)}</span></li>`).join('')}</ul>
      </div>
      <div class="card">
        <div class="card-head"><h3>Yield loss vs delay</h3></div>
        <div class="chart-box h240"><canvas id="simLoss"></canvas></div>
        <div class="card-head" style="margin-top:12px"><h3>Top drivers (stress probability)</h3></div>
        <div id="simDrivers"></div>
      </div>
    </div>`;
  hbars($('#simStress'), a.stressProbabilities.map((p, i) => ({ label: STRESS[i], value: Math.round(p * 100), cls: `st-${i}` })), 100);
  document.querySelectorAll('#simStress .v').forEach((v) => { v.textContent += '%'; });
  chart('simLoss', {
    type: 'line',
    data: {
      labels: a.lossCurve.map((p) => `${p.delay}d`),
      datasets: [{ label: 'Yield loss %', data: a.lossCurve.map((p) => p.lossPct), borderColor: series(8), backgroundColor: `${cssVar('--series-8')}22`, fill: true, tension: 0.25 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { x: axis('Delay', { grid: { display: false } }), y: axis('%', { beginAtZero: true }) } },
  });
  const drivers = a.explanation.waterStress.filter((c) => Math.abs(c.effect) >= 0.005).slice(0, 5);
  const maxAbs = Math.max(0.05, ...drivers.map((c) => Math.abs(c.effect)));
  $('#simDrivers').innerHTML = drivers.length ? drivers.map((c) => `
    <div class="contrib"><span>${esc(c.label)}</span>
      <div class="contrib-track"><span class="mid"></span><span class="contrib-fill ${c.effect >= 0 ? 'neg' : 'pos'}" style="width:${(50 * Math.abs(c.effect)) / maxAbs}%"></span></div>
      <span class="tabular" style="text-align:right">${c.effect > 0 ? '+' : ''}${fmt(c.effect * 100, 0)} pts</span></div>`).join('')
    : '<p class="muted small">Inputs are close to the regional median - no single driver stands out.</p>';
}

export async function render() {
  await run();
}
