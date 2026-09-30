import { api, qs, state, setFarm } from '../state.js';
import { $, fmt, chart, axis, series, cssVar, esc, stressBadge, riskBadge, hbars, STRESS, RISK, toast } from '../ui.js';

let ageOverride = null;
let lastAdv = null;

const ICONS = { irrigation: '💧', drip: '🚿', stress: '🌡️', delay: '⏳', yield: '🌾', fertigation: '🧪', disease: '🐛' };
const VOICE = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN', mr: 'mr-IN' };

export function open(id) {
  setFarm(id);
  ageOverride = null;
}

export function init() {
  $('#farmGo').addEventListener('click', () => {
    const id = $('#farmSearch').value.trim().toUpperCase();
    if (!id) return;
    open(id);
    render();
  });
  $('#farmSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#farmGo').click(); });
  $('#farmRandom').addEventListener('click', async () => {
    const list = await api(`/farms?${qs()}`);
    const top = list.farms.filter((f) => f.status !== 'rain_skip')
      .sort((a, b) => b.stressProbability + b.tonnesAtRisk - (a.stressProbability + a.tonnesAtRisk))[0];
    open(top.id);
    render();
  });
  $('#cropAge').addEventListener('input', (e) => { $('#o_cropAge').textContent = `${e.target.value} d`; });
  $('#cropAge').addEventListener('change', (e) => { ageOverride = Number(e.target.value); render(); });
}

function heroClass(a) {
  if (a.status === 'rain_skip') return 'rain';
  if (a.status === 'today') return 'urgent';
  if (a.status === 'tomorrow' || a.dueInDays <= 3) return 'soon';
  return '';
}
function heroTitle(a) {
  if (a.status === 'rain_skip') return 'Rain expected - skip irrigation';
  if (a.status === 'today') return 'Irrigate today';
  if (a.status === 'tomorrow') return 'Irrigate tomorrow';
  return `Next irrigation in ${a.dueInDays} days`;
}

export async function render() {
  const body = $('#advisorBody');
  if (!$('#farmList').options.length) {
    const list = await api(`/farms?${qs()}`);
    $('#farmList').innerHTML = list.farms.map((f) => `<option value="${f.id}">${esc(f.village)} · ${esc(f.taluk)}</option>`).join('');
    if (!state.farmId) setFarm(list.farms[0].id);
  }
  if (!state.farmId) return;
  $('#farmSearch').value = state.farmId;
  body.innerHTML = '<div class="loading">Generating advisory…</div>';
  let a;
  try {
    a = await api(`/farms/${encodeURIComponent(state.farmId)}?${qs({ lang: state.lang, ...(ageOverride !== null ? { cropAge: ageOverride } : {}) })}`);
  } catch (err) {
    body.innerHTML = `<div class="card">Plot <b>${esc(state.farmId)}</b> not found. Try an ID like MM-MD-0110.</div>`;
    return;
  }
  lastAdv = a;
  $('#cropAge').value = a.inputs.crop_age_days;
  $('#o_cropAge').textContent = `${a.inputs.crop_age_days} d`;

  const x = a.inputs;
  const stagePos = Math.min(100, (x.crop_age_days / 365) * 100);
  const stageIdx = ['Germination', 'Tillering', 'Grand growth', 'Maturity'].indexOf(a.stage);

  body.innerHTML = `
  <div class="hero ${heroClass(a)}">
    <div class="hero-icon">${a.status === 'rain_skip' ? '🌧️' : '💧'}</div>
    <div>
      <div class="small" style="opacity:.85">${a.id} · ${esc(a.village)}, ${esc(a.taluk)} · ${fmt(a.areaHa, 2)} ha · ${esc(a.methodLabel)} irrigation</div>
      <h2>${heroTitle(a)}</h2>
      <div class="hero-sub">${a.status === 'rain_skip' ? `Effective rain replaces ~${fmt(a.weekly.rainSavedM3)} m³ of pumping` : `Target date ${a.irrigationDate} · ±${fmt(a.daysUncertainty, 1)} days model uncertainty`}</div>
    </div>
    <div class="hero-stats">
      <div><b>${fmt(a.hours, 1)} h</b><span>pump run-time</span></div>
      <div><b>${fmt(a.volumeM3)} m³</b><span>water (${fmt(a.grossDepthMm, 0)} mm)</span></div>
      <div><b>${fmt(a.waterRequirementMm, 2)}</b><span>ETc mm/day</span></div>
    </div>
  </div>

  <div class="grid g-2-1">
    <div class="card">
      <div class="card-head"><h3>Farmer advisory</h3>
        <div style="display:flex;gap:6px">
          <button class="btn ghost small" id="speakBtn" title="Read aloud">🔊 Read aloud</button>
          <button class="btn ghost small" id="copyBtn" title="Copy as SMS">📋 Copy SMS</button>
        </div></div>
      <ul class="advice-list">${a.advisory.map((l) => `<li><span class="ai">${ICONS[l.key] || '•'}</span><span>${esc(l.text)}</span></li>`).join('')}</ul>
      ${a.advisoryEnglish ? `<details style="margin-top:10px"><summary class="small muted">English translation</summary><ul class="advice-list" style="margin-top:8px">${a.advisoryEnglish.map((l) => `<li><span class="ai">${ICONS[l.key] || '•'}</span><span>${esc(l.text)}</span></li>`).join('')}</ul></details>` : ''}
      ${a.explanation?.reasons?.length ? `<div class="note" style="margin-top:12px"><b>Why?</b> ${a.explanation.reasons.map(esc).join(' ')}</div>` : ''}
    </div>
    <div class="card">
      <div class="card-head"><h3>Water stress probability</h3>${stressBadge(a.stressClass)}</div>
      <div id="advStress"></div>
      <div class="divider"></div>
      <div class="card-head"><h3>Disease &amp; pest risk</h3>${riskBadge(a.riskClass)}</div>
      <div id="advRisk"></div>
      ${a.riskClass > 0 ? `<div class="note warn-note">${a.riskType === 'borer' ? 'Hot, dry spell favours early shoot borer.' : 'Humid conditions favour fungal diseases (rust, red rot, smut).'}</div>` : ''}
    </div>
  </div>

  <div class="grid g-1-1">
    <div class="card">
      <div class="card-head"><h3>Root-zone moisture - next 14 days</h3><span class="muted small">% of plant-available water</span></div>
      <div class="chart-box h260"><canvas id="projChart"></canvas></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Yield loss if irrigation is delayed</h3><span class="muted small">Gradient-boosting model</span></div>
      <div class="chart-box h260"><canvas id="lossChart"></canvas></div>
    </div>
  </div>

  <div class="grid g-1-1">
    <div class="card">
      <div class="card-head"><h3>Fertigation plan · ${esc(a.fertigation.stage)}</h3><span class="muted small">package ${a.fertigation.package.n}:${a.fertigation.package.p}:${a.fertigation.package.k} kg NPK/ha</span></div>
      <table class="table">
        <thead><tr><th>This week (whole plot)</th><th class="num">N</th><th class="num">P₂O₅</th><th class="num">K₂O</th></tr></thead>
        <tbody><tr><td>Nutrients (kg)</td><td class="num">${a.fertigation.weeklyNutrientsKg.n}</td><td class="num">${a.fertigation.weeklyNutrientsKg.p2o5}</td><td class="num">${a.fertigation.weeklyNutrientsKg.k2o}</td></tr></tbody>
      </table>
      <div class="meta-grid" style="margin-top:10px">
        <div><b>${a.fertigation.weeklyProductsKg.urea} kg</b><span>Urea (46% N)</span></div>
        <div><b>${a.fertigation.weeklyProductsKg.map_12_61_0} kg</b><span>12-61-0 (MAP)</span></div>
        <div><b>${a.fertigation.weeklyProductsKg.mop} kg</b><span>MOP (60% K₂O)</span></div>
      </div>
      ${a.fertigation.notes.map((n) => `<div class="note" style="margin-top:8px">${esc(n)}</div>`).join('')}
    </div>
    <div class="card">
      <div class="card-head"><h3>Why this advice? (days to irrigation)</h3><span class="muted small">vs regional median plot</span></div>
      <div id="contribBox"></div>
      <div class="muted small" style="margin-top:8px"><span style="color:${cssVar('--div-pos')}">■</span> delays irrigation &nbsp; <span style="color:${cssVar('--div-neg')}">■</span> brings it forward</div>
    </div>
  </div>

  <div class="grid g-1-1">
    <div class="card">
      <div class="card-head"><h3>Plot conditions</h3><span class="badge">Zone ${esc(a.zone.name.slice(-1))} · ${esc(a.zone.description)}</span></div>
      <div class="meta-grid">
        <div><b>${fmt(x.ndvi, 3)}</b><span>NDVI (expected ${fmt(a.expectedNdvi, 2)})</span></div>
        <div><b>${fmt(x.lai, 2)}</b><span>LAI</span></div>
        <div><b>${fmt(x.soil_moisture, 3)}</b><span>Soil moisture m³/m³</span></div>
        <div><b>${fmt(x.soil_ph, 2)}</b><span>Soil pH</span></div>
        <div><b>${fmt(x.organic_carbon, 1)}</b><span>Organic C g/kg</span></div>
        <div><b>${fmt(x.temperature_c, 1)} °C</b><span>Temperature</span></div>
        <div><b>${fmt(x.relative_humidity, 0)}%</b><span>Humidity</span></div>
        <div><b>${fmt(x.rainfall_mm, 0)} mm</b><span>Seasonal rainfall</span></div>
      </div>
      <div style="margin-top:14px" class="small muted">Crop stage · ${x.crop_age_days} days after planting</div>
      <div class="stage-track">
        ${['Germination', 'Tillering', 'Grand growth', 'Maturity'].map((s, i) => `<div class="${i === stageIdx ? 'on' : ''}">${s}</div>`).join('')}
        <span class="stage-marker" style="left:${stagePos}%"></span>
      </div>
      ${a.quality?.length ? `<div class="note warn-note" style="margin-top:12px"><b>Data quality:</b> ${a.quality.map(esc).join('; ')}</div>` : ''}
    </div>
    <div class="card">
      <div class="card-head"><h3>Human in the loop</h3><span class="muted small">accept or override - feeds model retraining</span></div>
      <p class="small muted" style="margin-top:0">Agronomists, field supervisors and farmers stay in control. Every decision is logged so the models can learn from local expertise.</p>
      <div class="feedback-row">
        <label>Role <select id="fbRole"><option value="farmer">Farmer</option><option value="supervisor">Field supervisor</option><option value="agronomist">Agronomist</option></select></label>
        <label>Actual irrigation in (days) <input type="number" id="fbDays" min="0" max="30" value="${a.dueInDays}" style="width:110px"></label>
        <label style="flex:1;min-width:160px">Reason (optional) <input id="fbReason" placeholder="e.g. canal water only on Friday"></label>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn" id="fbAccept">✓ Accept advice</button>
        <button class="btn ghost" id="fbOverride">✎ Override</button>
      </div>
    </div>
  </div>`;

  hbars($('#advStress'), a.stressProbabilities.map((p, i) => ({ label: STRESS[i], value: Math.round(p * 100), cls: `st-${i}` })), 100);
  hbars($('#advRisk'), a.riskProbabilities.map((p, i) => ({ label: RISK[i], value: Math.round(p * 100), cls: `st-${[0, 1, 3][i]}` })), 100);
  document.querySelectorAll('#advStress .v, #advRisk .v').forEach((v) => { v.textContent += '%'; });

  // Moisture projection
  const pr = a.projection;
  chart('projChart', {
    type: 'line',
    data: {
      labels: pr.series.map((p) => (p.day === 0 ? 'Today' : `+${p.day}`)),
      datasets: [
        { label: 'Following SMA advice', data: pr.series.map((p) => p.advice), borderColor: series(1), backgroundColor: series(1), tension: 0.15, stepped: false },
        { label: 'No irrigation', data: pr.series.map((p) => p.none), borderColor: series(2), backgroundColor: series(2), borderDash: [5, 4], tension: 0.15 },
        { label: 'Stress threshold', data: pr.series.map(() => pr.stressThreshold), borderColor: cssVar('--critical'), borderWidth: 1, borderDash: [2, 3], pointRadius: 0 },
      ],
    },
    options: {
      plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y}%` } } },
      scales: { x: axis('Days from today', { grid: { display: false } }), y: axis('% available water', { min: 0, max: 100 }) },
    },
  });

  // Yield loss curve
  chart('lossChart', {
    type: 'line',
    data: {
      labels: a.lossCurve.map((p) => `${p.delay}d`),
      datasets: [{
        label: 'Expected yield loss %', data: a.lossCurve.map((p) => p.lossPct), borderColor: series(8), backgroundColor: `${cssVar('--series-8')}22`, fill: true, tension: 0.25,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `Loss ${c.parsed.y}% ≈ ${fmt((c.parsed.y / 100) * a.yieldTotalT, 2)} t cane` } },
      },
      scales: { x: axis('Delay from today', { grid: { display: false } }), y: axis('% of yield', { beginAtZero: true }) },
    },
  });

  // Contributions
  const contrib = a.explanation.nextIrrigation.filter((c) => Math.abs(c.effect) >= 0.01).slice(0, 7);
  const maxAbs = Math.max(0.5, ...contrib.map((c) => Math.abs(c.effect)));
  $('#contribBox').innerHTML = contrib.length ? contrib.map((c) => `
    <div class="contrib" title="value ${fmt(c.value, 3)} vs median ${fmt(c.baseline, 3)}">
      <span>${esc(c.label)}</span>
      <div class="contrib-track"><span class="mid"></span><span class="contrib-fill ${c.effect >= 0 ? 'pos' : 'neg'}" style="width:${(50 * Math.abs(c.effect)) / maxAbs}%"></span></div>
      <span class="tabular" style="text-align:right">${c.effect > 0 ? '+' : ''}${fmt(c.effect, 1)} d</span>
    </div>`).join('') : '<p class="muted">This plot is close to the regional median on every input.</p>';

  // Actions
  $('#speakBtn').onclick = () => {
    if (!('speechSynthesis' in window)) return toast('Speech is not supported in this browser');
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(a.advisory.map((l) => l.text).join(' '));
    u.lang = VOICE[a.lang] || 'en-IN';
    u.rate = 0.95;
    speechSynthesis.speak(u);
    return undefined;
  };
  $('#copyBtn').onclick = async () => {
    const sms = `SMA ${a.id}: ${a.advisory.slice(0, 3).map((l) => l.text).join(' ')}`;
    try { await navigator.clipboard.writeText(sms); toast('Advisory copied - ready to send as SMS/WhatsApp'); } catch { toast(sms.slice(0, 120)); }
  };
  const send = async (action) => {
    try {
      await api('/feedback', {
        method: 'POST',
        body: { farmId: a.id, action, recommendedDays: a.dueInDays, actualDays: Number($('#fbDays').value), reason: $('#fbReason').value, role: $('#fbRole').value },
      });
      toast(action === 'accepted' ? 'Advice accepted - logged for monitoring' : 'Override recorded - will be used for retraining');
    } catch (err) { toast(err.message); }
  };
  $('#fbAccept').onclick = () => send('accepted');
  $('#fbOverride').onclick = () => send('overridden');
}

export function current() { return lastAdv; }
