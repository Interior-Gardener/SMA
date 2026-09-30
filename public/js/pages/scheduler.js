import { api, state } from '../state.js';
import { $, fmt, esc, STRESS } from '../ui.js';

let view = 'optimised';
let last = null;

export function init() {
  const taluks = Object.keys(state.meta.taluks).sort();
  $('#schTaluk').innerHTML = `<option value="">All taluks</option>${taluks.map((t) => `<option>${esc(t)}</option>`).join('')}`;
  const fillVillages = () => {
    const t = $('#schTaluk').value;
    const villages = t ? state.meta.taluks[t] : Object.values(state.meta.taluks).flat().sort();
    $('#schVillage').innerHTML = `<option value="">All villages</option>${villages.map((v) => `<option>${esc(v)}</option>`).join('')}`;
  };
  $('#schTaluk').addEventListener('change', fillVillages);
  fillVillages();
  $('#schVillage').value = 'Hosur';
  $('#schRun').addEventListener('click', render);
}

function hhmm(min) {
  const d = Math.floor(min / 1440);
  const m = min % 1440;
  return `${d ? `D${d + 1} ` : ''}${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
}

function row(label, o, f, fmtFn, lowerIsBetter = true) {
  const better = o === f ? '' : (lowerIsBetter ? o < f : o > f) ? 'better' : '';
  return `<div>${label}</div><div class="${better}">${fmtFn(o)}</div><div>${fmtFn(f)}</div>
    <div class="${better}">${o === null || f === null || o === f ? '-' : `${o > f ? '+' : ''}${fmtFn(o - f)}`}</div>`;
}

function gantt(d, segments) {
  const total = d.days * 1440;
  const lanesUsed = Math.min(d.lanes, Math.max(1, ...segments.map((s) => s.lane + 1)));
  const offBands = [];
  let cursor = 0;
  for (const [s, e] of d.slots) {
    if (s > cursor) offBands.push([cursor, s]);
    cursor = e;
  }
  if (cursor < total) offBands.push([cursor, total]);
  const off = offBands.map(([s, e]) => `<span class="gantt-off" style="left:${(100 * s) / total}%;width:${(100 * (e - s)) / total}%"></span>`).join('');
  const ticks = [];
  for (let t = 0; t <= total; t += 360) ticks.push(`<span style="position:absolute;left:${(100 * t) / total}%;transform:translateX(-50%)">${hhmm(t)}</span>`);
  const lanes = [];
  for (let l = 0; l < lanesUsed; l++) {
    const segs = segments.filter((s) => s.lane === l).map((s) => `<span class="gantt-seg st-${s.stressClass}"
      style="left:${(100 * s.start) / total}%;width:${Math.max(0.2, (100 * (s.end - s.start)) / total)}%"
      title="${s.id} · ${hhmm(s.start)}-${hhmm(s.end)} · stress ${STRESS[s.stressClass]}"></span>`).join('');
    lanes.push(`<div class="gantt-row"><span class="lane">Pump ${l + 1}</span><div class="gantt-track">${off}${segs}</div></div>`);
  }
  return `<div class="gantt"><div class="gantt-inner">
    <div class="gantt-axis">${ticks.join('')}</div>${lanes.join('')}</div></div>`;
}

function draw() {
  const d = last;
  const o = d.optimised.kpi;
  const f = d.fcfs.kpi;
  const segs = view === 'optimised' ? d.optimised.segments : d.fcfs.segments;
  $('#schOut').innerHTML = `
  <div class="kpis">
    <div class="kpi"><div class="k-label">Plots needing water</div><div class="k-value">${d.jobs}</div><div class="k-sub">${fmt(d.demandPumpHours, 0)} pump-hours of demand</div></div>
    <div class="kpi"><div class="k-label">Feeder capacity</div><div class="k-value">${fmt(d.capacityPumpHoursPerDay, 0)} h/day</div><div class="k-sub">${d.lanes} pumps × ${fmt(d.powerMinutesPerDay / 60, 1)} h of 3-phase power</div></div>
    <div class="kpi accent"><div class="k-label">Cane loss avoided vs rotation</div><div class="k-value">${fmt(Math.max(0, f.estimatedLossT - o.estimatedLossT), 2)} t</div><div class="k-sub">by watering high-risk plots first</div></div>
    <div class="kpi"><div class="k-label">High-stress plots served</div><div class="k-value">${o.highStressServed}/${o.highStressPlots}</div><div class="k-sub">rotation serves ${f.highStressServed}/${f.highStressPlots}</div></div>
  </div>
  <div class="grid g-1-2">
    <div class="card">
      <div class="card-head"><h3>SMA optimised vs first-come rotation</h3></div>
      <div class="compare">
        <div class="h">Metric (${d.days}-day horizon)</div><div class="h">SMA (WSPT)</div><div class="h">Rotation</div><div class="h">Δ</div>
        ${row('Estimated cane loss (t)', o.estimatedLossT, f.estimatedLossT, (v) => fmt(v, 2))}
        ${row('Plots fully irrigated', o.plotsCompleted, f.plotsCompleted, (v) => fmt(v), false)}
        ${row('Cane at risk still waiting (t)', o.tonnesAtRiskPending, f.tonnesAtRiskPending, (v) => fmt(v, 1))}
        ${row('High-stress plots: avg finish (h)', o.avgHighStressCompletionHours, f.avgHighStressCompletionHours, (v) => fmt(v, 1))}
        ${row('Pump energy (kWh)', o.energyKwh, f.energyKwh, (v) => fmt(v))}
      </div>
      <p class="small muted" style="margin-top:12px">Weighted-Shortest-Processing-Time: plots are ordered by <i>cane at risk ÷ pumping hours</i>
      (Smith's rule, optimal for weighted completion time), then packed into the power windows without exceeding the feeder's pump limit.
      Pumps pause when power goes off and resume in the next window.</p>
    </div>
    <div class="card">
      <div class="card-head"><h3>Pump timetable</h3>
        <div class="chips">
          <button class="chip ${view === 'optimised' ? 'active' : ''}" data-v="optimised">SMA optimised</button>
          <button class="chip ${view === 'fcfs' ? 'active' : ''}" data-v="fcfs">Rotation (FCFS)</button>
        </div></div>
      ${d.jobs ? gantt(d, segs) : '<p class="muted">No plots in this area need irrigation within the horizon. Try the <b>Summer dry spell</b> scenario.</p>'}
      <div class="legend" style="margin-top:10px;margin-left:0">
        ${STRESS.map((s, i) => `<span><i class="dot st-${i}" style="background:var(--st)"></i>${s} stress</span>`).join('')}
        <span><i class="dot" style="background:repeating-linear-gradient(45deg,transparent 0 2px,var(--muted) 2px 3px)"></i>No power</span>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-head"><h3>Schedule (SMA optimised)</h3><span class="muted small">first ${Math.min(40, d.optimised.results.length)} of ${d.optimised.results.length}</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>#</th><th>Plot</th><th>Village</th><th>Stress</th><th class="num">Due in</th><th class="num">Pump h</th><th class="num">Cane at risk t</th><th>Start</th><th>Finish</th></tr></thead>
      <tbody>${d.optimised.results.slice(0, 40).map((r, i) => `<tr class="clickable" data-id="${r.id}"><td>${i + 1}</td><td><b>${r.id}</b></td><td>${esc(r.village)}</td>
        <td><span class="badge st-${r.stressClass}"><span class="dot"></span>${STRESS[r.stressClass]}</span></td>
        <td class="num">${r.dueInDays} d</td><td class="num">${fmt(r.hours, 1)}</td><td class="num">${fmt(r.tonnesAtRisk, 2)}</td>
        <td>${r.start === null ? '-' : hhmm(r.start)}</td><td>${r.complete ? hhmm(r.end) : '<span class="muted">continues later</span>'}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;
  $('#schOut').querySelectorAll('.chip[data-v]').forEach((c) => c.addEventListener('click', () => { view = c.dataset.v; draw(); }));
  $('#schOut').querySelector('tbody')?.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) window.dispatchEvent(new CustomEvent('sma:open-farm', { detail: tr.dataset.id }));
  });
}

export async function render() {
  $('#schOut').innerHTML = '<div class="loading">Optimising…</div>';
  last = await api('/schedule', {
    method: 'POST',
    body: {
      ...state.scenario,
      taluk: $('#schTaluk').value,
      village: $('#schVillage').value,
      capacity: Number($('#schCap').value),
      days: Number($('#schDays').value),
      windows: [
        { start: $('#w1s').value, end: $('#w1e').value },
        { start: $('#w2s').value, end: $('#w2e').value },
      ],
    },
  });
  draw();
}
