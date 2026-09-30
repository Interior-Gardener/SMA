import { $ } from '../ui.js';

const COVERAGE = [
  ['Next Irrigation Date Prediction', 'Random Forest regressor (40 trees) + tree-spread uncertainty', 'Advisor, Map, Overview'],
  ['Irrigation Duration Prediction', 'Gradient Boosting depth model → hydraulics (method efficiency, pump flow)', 'Advisor, Scheduler'],
  ['Crop Water Requirement Prediction', 'Gradient Boosting regressor for ETc (mm/day)', 'Advisor, Overview'],
  ['Water Stress Probability Model', 'Random Forest classifier → 4-class probabilities', 'All pages'],
  ['Rainfall-Adjusted Recommendation', 'Forecast rain as model input + counterfactual "no-rain" prediction', 'Scenario bar, Advisor'],
  ['Yield Loss Due to Delayed Irrigation', 'Gradient Boosting regressor with delay as input (0-21 days)', 'Advisor, Scheduler'],
  ['Pump Scheduling Optimisation', 'WSPT list scheduling under power windows & feeder capacity', 'Pump Scheduler'],
  ['Fertigation Recommendation', 'Stage-wise NPK engine adjusted for organic carbon, pH and vigour', 'Advisor'],
  ['Disease and Water Stress Forecasting', 'Random Forest risk classifier + rule-based pest/fungal typing', 'Advisor, Map'],
  ['Yield Prediction Model', 'Gradient Boosting regressor (t/ha)', 'Advisor, Overview'],
  ['Farmer-Friendly Advisory (LLM-ready)', 'Template NLG in EN/KN/HI/MR, speech output, chatbot; structured output ready for an LLM', 'Advisor, Krishi Mitra'],
  ['Management Zones (extra)', 'K-Means clustering of plots', 'Map, Insights'],
];

const GOV = [
  ['Privacy & data protection', 'Plots are addressed by anonymised IDs; no farmer names or phone numbers are stored. Feedback logs hold only plot ID, role and decision (DPDP-friendly data minimisation).'],
  ['Explainability', 'Every advisory shows "why": per-feature effects vs the regional median, probability bars instead of bare labels, and uncertainty (±days).'],
  ['Human in the loop', 'Farmers, supervisors and agronomists can accept or override each advisory; overrides are logged as retraining data.'],
  ['Fairness', 'Models are evaluated on plots never seen in training, across all 6 taluks; management zones reveal where soil/climate differ.'],
  ['Security', 'Strict input validation and clamping on every API, no secrets in the code, small attack surface (no database or login in the prototype).'],
  ['Honest limitations', 'The dataset has no irrigation logs or yield records, so labels are generated from FAO-56/FAO-33 agronomy with field noise. The pipeline retrains unchanged once KIAAR/GBL ground truth arrives.'],
];

export async function render() {
  $('#aboutBody').innerHTML = `
  <div class="about-hero">
    <div class="small" style="opacity:.8">Use case KJS-AGR-01 · K J Somaiya Institute of Technology × KIAAR × Godavari Biorefineries</div>
    <h2 style="margin-top:6px">SMA - Smart Moisture Advisor</h2>
    <p>Sugarcane is one of India's thirstiest crops, and most farmers still irrigate by habit - too much, too late, or both.
    SMA turns satellite, soil and weather data into plot-specific advice: <b>when</b> to irrigate, <b>how long</b> to run the pump,
    <b>how much fertiliser</b> to add, and <b>what is at stake</b> if irrigation is delayed - in the farmer's own language.</p>
  </div>
  <div class="grid g-3" style="margin-top:16px">
    <div class="card"><h3>The problem</h3><p class="small">Over-irrigation wastes water and electricity and leaches nutrients; delayed irrigation causes moisture stress and yield loss. 18,000-25,000 GBL/KIAAR farmers across thousands of spatially scattered plots cannot be monitored manually.</p></div>
    <div class="card"><h3>Our approach</h3><p class="small">A physics-informed ML pipeline: agronomic science (FAO-56 water balance, FAO-33 yield response) creates labels, tree-ensemble models learn fast surrogates with uncertainty, and a decision engine turns predictions into actions.</p></div>
    <div class="card"><h3>Impact (this dataset)</h3><p class="small">≈38% less irrigation water than fixed 8-day practice under normal conditions, rain-aware postponement, optimised pump timetables under limited power, and early alerts for stress and disease.</p></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><h3>Use-case models → what we built</h3></div>
    <div class="table-wrap"><table class="table coverage"><thead><tr><th>Required model</th><th>Implementation</th><th>Where to see it</th></tr></thead>
    <tbody>${COVERAGE.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><h3>Responsible AI &amp; governance</h3></div>
    <div class="grid g-3">${GOV.map(([t, d]) => `<div><h4 style="font-size:14px">${t}</h4><p class="small muted">${d}</p></div>`).join('')}</div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-head"><h3>Team</h3></div>
    <div class="team">
      <div class="person"><div class="avatar">KV</div><div><b>Kartik Verma</b><div class="small muted">Design, ML &amp; full-stack development</div></div></div>
      <div class="person"><div class="avatar">KS</div><div><b>Kushal Soni</b><div class="small muted">Design, ML &amp; full-stack development</div></div></div>
    </div>
  </div>`;
}
