import { api, qs } from '../state.js';
import { $, fmt, chart, axis, series, cssVar, hbars, STRESS, RISK, esc, stressBadge, statusBadge } from '../ui.js';

let showVillages = false;
let last = null;

function kpi(label, value, sub, cls = '') {
  return `<div class="kpi ${cls}"><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;
}

export function init() {
  $('#talukTableToggle').addEventListener('click', () => {
    showVillages = !showVillages;
    $('#talukTableToggle').textContent = showVillages ? 'Show taluks' : 'Show villages';
    if (last) renderTable(last);
  });
}

function renderTable(d) {
  const rows = showVillages ? d.byVillage : d.byTaluk;
  $('#talukTable').innerHTML = `
    <thead><tr><th>${showVillages ? 'Village' : 'Taluk'}</th><th class="num">Plots</th><th class="num">Avg NDVI</th><th class="num">Soil moisture</th>
    <th class="num">ETc mm/day</th><th class="num">Due ≤2 days</th><th class="num">Stressed</th><th class="num">Water/week m³</th>
    <th class="num">Saved/week m³</th><th class="num">Yield t/ha</th><th class="num">Cane at risk t</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.plots}</td><td class="num">${fmt(r.avgNdvi, 3)}</td>
    <td class="num">${fmt(r.avgSoilMoisture, 3)}</td><td class="num">${fmt(r.avgWaterRequirement, 2)}</td><td class="num">${r.dueIn2Days}</td>
    <td class="num">${fmt(r.stressedPct, 1)}%</td><td class="num">${fmt(r.weeklyWaterM3)}</td><td class="num">${fmt(r.weeklySavedM3)}</td>
    <td class="num">${fmt(r.avgYield, 1)}</td><td class="num">${fmt(r.tonnesAtRisk, 1)}</td></tr>`).join('')}</tbody>`;
}

export async function render() {
  $('#kpis').innerHTML = '<div class="loading">Running 7 models on 1,000 plots…</div>';
  const [d, farms] = await Promise.all([api(`/insights?${qs()}`), api(`/farms?${qs()}`)]);
  last = d;
  const k = d.kpi;

  $('#kpis').innerHTML = [
    kpi('Plots monitored', fmt(k.plots), `${fmt(k.areaHa, 0)} ha · ${k.villages} villages · ${k.taluks} taluks`),
    kpi('Irrigate today / tomorrow', `${fmt(k.dueToday)} / ${fmt(k.dueTomorrow)}`, `${fmt(k.dueThisWeek)} plots due within 7 days`),
    kpi('Moderate or severe stress', fmt(k.moderateOrWorse), `${fmt(k.severeStress)} severe · ${fmt(k.tonnesAtRisk, 0)} t cane at risk if delayed 5 days`),
    kpi('Water saved this week', `${fmt(k.weeklySavedM3 / 1000, 1)}k m³`, `<span>${fmt(k.weeklySavedPct, 1)}% less than fixed 8-day irrigation</span>`, 'accent'),
    kpi('Pump energy saved', `${fmt(k.weeklySavedKwh)} kWh`, `≈ ₹${fmt(k.weeklySavedRs)} of farm power this week`),
    kpi('Rain-adjusted skips', fmt(k.rainSkips), k.rainSavedM3 ? `${fmt(k.rainSavedM3 / 1000, 1)}k m³ of rain used instead of pumping` : 'No rain in forecast'),
    kpi('Expected cane production', `${fmt(k.totalCaneT / 1000, 1)}k t`, `average ${fmt(k.avgYieldTHa, 1)} t/ha`),
    kpi('Disease / pest alerts', fmt(k.highDiseaseRisk), `${fmt(d.riskDistribution[1])} plots at medium risk`),
  ].join('');

  // Irrigation calendar
  const days = d.calendar.map((c) => (c.day === 0 ? 'Today' : c.day === 1 ? 'Tmrw' : `+${c.day}d`));
  chart('calendarChart', {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Plots due',
        data: d.calendar.map((c) => c.plots),
        backgroundColor: d.calendar.map((c) => (c.day === 0 ? cssVar('--critical') : c.day <= 2 ? cssVar('--serious') : series(1))),
        borderSkipped: 'start',
        maxBarThickness: 36,
      }],
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { afterLabel: (ctx) => `Water: ${fmt(d.calendar[ctx.dataIndex].volumeM3)} m³` } },
      },
      scales: { x: axis(null, { grid: { display: false } }), y: axis('Plots', { beginAtZero: true }) },
    },
  });

  const total = d.stressDistribution.reduce((a, b) => a + b, 0);
  hbars($('#stressBars'), d.stressDistribution.map((v, i) => ({ label: `${['✓', '!', '!!', '✕'][i]} ${STRESS[i]}`, value: v, cls: `st-${i}` })), total);
  hbars($('#riskBars'), d.riskDistribution.map((v, i) => ({ label: RISK[i], value: v, cls: `st-${[0, 1, 3][i]}` })), total);

  // Water by taluk
  chart('waterChart', {
    type: 'bar',
    data: {
      labels: d.byTaluk.map((t) => t.name),
      datasets: [
        { label: 'SMA recommendation', data: d.byTaluk.map((t) => t.weeklyWaterM3), backgroundColor: series(1), maxBarThickness: 26 },
        { label: 'Fixed 8-day practice', data: d.byTaluk.map((t) => t.weeklyWaterM3 + t.weeklySavedM3), backgroundColor: series(2), maxBarThickness: 26 },
      ],
    },
    options: {
      plugins: { legend: { position: 'top', align: 'end' } },
      datasets: { bar: { borderColor: cssVar('--surface'), borderWidth: { left: 1, right: 1 } } },
      scales: { x: axis(null, { grid: { display: false } }), y: axis('m³ / week', { beginAtZero: true, ticks: { callback: (v) => `${v / 1000}k`, color: cssVar('--muted') } }) },
    },
  });

  // Priority plots
  const top = [...farms.farms]
    .filter((f) => f.status !== 'rain_skip')
    .sort((a, b) => b.stressProbability + b.tonnesAtRisk / 2 - (a.stressProbability + a.tonnesAtRisk / 2))
    .slice(0, 8);
  $('#priorityTable').innerHTML = `<thead><tr><th>Plot</th><th>Village</th><th>Stress</th><th>Irrigation</th><th class="num">Hours</th><th class="num">At risk t</th></tr></thead>
    <tbody>${top.map((f) => `<tr class="clickable" data-id="${f.id}"><td><b>${f.id}</b></td><td>${esc(f.village)}</td><td>${stressBadge(f.stressClass)}</td>
    <td>${statusBadge(f)}</td><td class="num">${fmt(f.hours, 1)}</td><td class="num">${fmt(f.tonnesAtRisk, 2)}</td></tr>`).join('')}</tbody>`;
  $('#priorityTable').onclick = (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) window.dispatchEvent(new CustomEvent('sma:open-farm', { detail: tr.dataset.id }));
  };

  renderTable(d);
}
