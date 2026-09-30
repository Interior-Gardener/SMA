import { api, qs } from '../state.js';
import { $, fmt, chart, axis, series, cssVar, esc, divColor, mix } from '../ui.js';

let metrics = null;

const STEPS = [
  ['01', 'Data', '1,000 geofenced plots · NDVI, LAI, soil moisture, pH, organic C, weather'],
  ['02', 'Clean', 'Impute cloud-masked NDVI, robust outlier flags, drop constant columns'],
  ['03', 'Label', 'FAO-56 water balance + FAO-33 yield response → physics-informed labels'],
  ['04', 'Train', 'Random Forest & Gradient Boosting, split by plot (no leakage)'],
  ['05', 'Serve', 'Models exported to JSON, run natively in Node.js (<1 ms / plot)'],
  ['06', 'Advise', 'Decision engine, scheduler, 4-language advisories, feedback loop'],
];

export function init() {
  $('#pipeline').innerHTML = STEPS.map(([n, t, d], i) => `${i ? '<span class="pipe-arrow">→</span>' : ''}
    <div class="pipe-step"><span class="n">STEP ${n}</span><b>${t}</b>${d}</div>`).join('');
  $('#impModel').addEventListener('change', drawModel);
}

function drawModel() {
  const name = $('#impModel').value;
  const m = metrics.models[name];
  const imp = m.importance.slice(0, 8);
  chart('impChart', {
    type: 'bar',
    data: {
      labels: imp.map((i) => i.label),
      datasets: [{ label: 'Importance', data: imp.map((i) => +(i.importance * 100).toFixed(1)), backgroundColor: series(1), maxBarThickness: 22 }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.parsed.x}% of total importance` } } },
      scales: { x: axis('% importance', { beginAtZero: true }), y: axis(null, { grid: { display: false } }) },
    },
  });

  const box = $('#evalBox');
  if (m.task === 'regression') {
    $('#evalTitle').textContent = `Predicted vs actual - ${m.title} (held-out plots)`;
    box.innerHTML = '<canvas id="evalChart"></canvas>';
    const pts = m.sample.map((s) => ({ x: s.actual, y: s.predicted }));
    const lo = Math.min(...pts.map((p) => Math.min(p.x, p.y)));
    const hi = Math.max(...pts.map((p) => Math.max(p.x, p.y)));
    chart('evalChart', {
      type: 'scatter',
      data: {
        datasets: [
          { label: 'Test plots', data: pts, backgroundColor: `${cssVar('--series-1')}99`, pointRadius: 3, pointHoverRadius: 5 },
          { label: 'Perfect prediction', type: 'line', data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: cssVar('--series-2'), borderDash: [5, 4], borderWidth: 1.5 },
        ],
      },
      options: {
        interaction: { mode: 'nearest', intersect: true },
        plugins: { legend: { position: 'top', align: 'end' } },
        scales: { x: axis('Actual', { type: 'linear' }), y: axis('Predicted') },
      },
    });
  } else {
    $('#evalTitle').textContent = `Confusion matrix - ${m.title} (held-out plots)`;
    const cm = m.confusion_matrix;
    const max = Math.max(...cm.flat());
    box.innerHTML = `<div class="table-wrap"><table class="table cm">
      <thead><tr><th>Actual ↓ / Predicted →</th>${m.classes.map((c) => `<th style="text-align:center">${c}</th>`).join('')}</tr></thead>
      <tbody>${cm.map((r, i) => `<tr><th>${m.classes[i]}</th>${r.map((v, j) => {
        const bg = mix(cssVar('--chart-surface'), i === j ? cssVar('--series-1') : cssVar('--series-2'), max ? Math.sqrt(v / max) : 0);
        const dark = max && v / max > 0.35;
        return `<td style="background:${bg};color:${dark ? '#fff' : 'inherit'}">${v}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="small muted">Diagonal = correct. Accuracy ${fmt(m.test.accuracy * 100, 1)}%, macro-F1 ${fmt(m.test.f1_macro, 3)}. Most errors are between neighbouring classes.</p>`;
  }
}

export async function render() {
  const [m, ins, fb] = await Promise.all([api('/models'), api(`/insights?${qs()}`), api('/feedback')]);
  metrics = m;

  $('#modelCards').innerHTML = Object.entries(m.models).map(([, v]) => {
    const reg = v.task === 'regression';
    const main = reg ? `R² <b>${fmt(v.test.r2, 3)}</b>` : `Accuracy <b>${fmt(v.test.accuracy * 100, 1)}%</b>`;
    const second = reg ? `MAE <b>${fmt(v.test.mae, 2)}</b>` : `Macro-F1 <b>${fmt(v.test.f1_macro, 3)}</b>`;
    const base = reg ? `R² ${fmt(v.baseline.r2, 3)}` : `acc ${fmt(v.baseline.accuracy * 100, 1)}%`;
    return `<div class="card model-card"><h4>${esc(v.title)}</h4><div class="algo">${esc(v.algorithm)}</div>
      <div class="metric"><span>${main}</span><span>${second}</span></div>
      <div class="vs">Baseline ${esc(v.baseline.algorithm)}: ${base}</div></div>`;
  }).join('');

  $('#impModel').innerHTML = Object.entries(m.models).map(([k, v]) => `<option value="${k}">${esc(v.title)}</option>`).join('');
  drawModel();

  // Correlations
  const c = ins.correlation;
  $('#corrTable').innerHTML = `<table class="table corr"><thead><tr><th></th>${c.labels.map((l) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
    <tbody>${c.matrix.map((r, i) => `<tr><th style="text-align:right">${esc(c.labels[i])}</th>${r.map((v) => `<td style="background:${divColor(v)};color:${Math.abs(v) > 0.6 ? '#fff' : 'inherit'}" title="r = ${v}">${v.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="small muted">Red = negative, blue = positive. Temperature, humidity and rainfall move together (r ≈ ±0.85-0.94) - the models are robust to this, but it is why explanations use regional medians.</p>`;

  // Zones
  $('#zonesBox').innerHTML = `<table class="table"><thead><tr><th>Zone</th><th>Profile</th><th class="num">Plots</th><th class="num">NDVI</th><th class="num">Soil moist.</th><th class="num">Rain mm</th></tr></thead>
    <tbody>${ins.zones.map((z) => `<tr><td><span class="dot" style="background:${cssVar(`--series-${z.id + 1}`)}"></span> <b>${esc(z.name)}</b></td><td>${esc(z.description)}</td>
    <td class="num">${z.currentCount}</td><td class="num">${fmt(z.centroid.ndvi, 3)}</td><td class="num">${fmt(z.centroid.soil_moisture, 3)}</td><td class="num">${fmt(z.centroid.rainfall_mm, 0)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">Unsupervised K-Means (k = 4) on standardised soil, crop and climate features. Zones let agronomists plan one strategy for many similar plots.</p>`;

  chart('ndviHist', {
    type: 'bar',
    data: {
      labels: ins.histograms.ndvi.map((b) => b.from.toFixed(2)),
      datasets: [{ label: 'Plots', data: ins.histograms.ndvi.map((b) => b.count), backgroundColor: series(3), barPercentage: 1, categoryPercentage: 0.94 }],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (i) => `NDVI ${ins.histograms.ndvi[i[0].dataIndex].from}-${ins.histograms.ndvi[i[0].dataIndex].to}` } } },
      scales: { x: axis('NDVI', { grid: { display: false } }), y: axis('Plots', { beginAtZero: true }) },
    },
  });

  const q = ins.quality;
  const ds = m.dataset;
  $('#qualityBox').innerHTML = `
    <div class="meta-grid">
      <div><b>${ds.plots}</b><span>plots in dataset</span></div>
      <div><b>${fmt(ds.scenarios)}</b><span>training scenarios</span></div>
      <div><b>${q.missingNdvi}</b><span>NDVI gaps imputed</span></div>
      <div><b>${Object.values(q.outlierCounts).reduce((a, b) => a + b, 0)}</b><span>outlier flags</span></div>
    </div>
    <div class="note" style="margin-top:10px">Constant columns ignored by the models: ${[...q.constantColumns, ...q.singleValueColumns].map(esc).join(', ')}.
      Split: ${esc(ds.split)}.</div>
    <div class="divider"></div>
    <div class="card-head"><h3>Advice acceptance</h3><span class="muted small">human-in-the-loop log</span></div>
    ${fb.total ? `<div class="meta-grid"><div><b>${fb.total}</b><span>decisions logged</span></div><div><b>${fmt(fb.acceptanceRate * 100, 0)}%</b><span>accepted</span></div><div><b>${fb.overridden}</b><span>overrides (retraining data)</span></div></div>`
    : '<p class="muted small">No feedback yet - accept or override an advisory on the Farm Advisor page.</p>'}`;
}
