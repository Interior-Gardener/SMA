// UI helpers: formatting, DOM, colours, chart defaults
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const fmt = (n, d = 0) => (n === null || n === undefined || Number.isNaN(n) ? '-' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const pct = (x, d = 0) => `${fmt(x * 100, d)}%`;

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const STRESS = ['None', 'Mild', 'Moderate', 'Severe'];
export const RISK = ['Low', 'Medium', 'High'];
export const STATUS_VARS = ['--good', '--warning', '--serious', '--critical'];
export const STATUS_ICON = ['✓', '!', '!!', '✕'];

export function stressBadge(k) {
  return `<span class="badge st-${k}"><span class="dot"></span>${STATUS_ICON[k]} ${STRESS[k]}</span>`;
}
export function riskBadge(k) {
  const m = [0, 1, 3][k];
  return `<span class="badge st-${m}"><span class="dot"></span>${RISK[k]}</span>`;
}
export function statusBadge(f) {
  const map = {
    today: [3, 'Irrigate today'],
    tomorrow: [2, 'Tomorrow'],
    rain_skip: [0, 'Rain - skip'],
  };
  const [k, t] = map[f.status] || [f.dueInDays <= 3 ? 1 : 0, `In ${f.dueInDays} days`];
  return `<span class="badge st-${k}"><span class="dot"></span>${t}</span>`;
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

export function hbars(el, rows, total) {
  el.innerHTML = rows.map((r) => `
    <div class="hbar ${r.cls || ''}">
      <span>${r.label}</span>
      <div class="hbar-track"><div class="hbar-fill" style="width:${total ? (100 * r.value) / total : 0}%"></div></div>
      <span class="v">${fmt(r.value)}</span>
    </div>`).join('');
}

// ---------------------------------------------------------------- charts
const charts = new Map();
export function chart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return null;
  if (charts.has(id)) charts.get(id).destroy();
  const c = new window.Chart(canvas, config);
  charts.set(id, c);
  return c;
}

export function applyChartDefaults() {
  if (!window.Chart) return;
  const C = window.Chart;
  C.defaults.font.family = cssVar('--font') || 'system-ui';
  C.defaults.font.size = 12;
  C.defaults.color = cssVar('--text-2');
  C.defaults.borderColor = cssVar('--grid');
  C.defaults.maintainAspectRatio = false;
  C.defaults.animation.duration = 350;
  C.defaults.plugins.legend.labels.boxWidth = 12;
  C.defaults.plugins.legend.labels.boxHeight = 12;
  C.defaults.plugins.legend.labels.usePointStyle = true;
  C.defaults.plugins.tooltip.backgroundColor = cssVar('--text');
  C.defaults.plugins.tooltip.titleColor = cssVar('--surface');
  C.defaults.plugins.tooltip.bodyColor = cssVar('--surface');
  C.defaults.plugins.tooltip.padding = 10;
  C.defaults.plugins.tooltip.cornerRadius = 8;
  C.defaults.elements.bar.borderRadius = 4;
  C.defaults.elements.line.borderWidth = 2;
  C.defaults.elements.point.radius = 0;
  C.defaults.elements.point.hoverRadius = 5;
  C.defaults.interaction = { mode: 'index', intersect: false };
}

export const axis = (title, extra = {}) => ({
  grid: { color: cssVar('--grid'), drawTicks: false },
  border: { color: cssVar('--axis') },
  ticks: { color: cssVar('--muted'), padding: 6 },
  title: title ? { display: true, text: title, color: cssVar('--muted') } : undefined,
  ...extra,
});

export const series = (i) => cssVar(`--series-${i}`);

/** Interpolate across the sequential ramp (0..1). */
export function seqColor(t, ramp = ['--seq-100', '--seq-250', '--seq-400', '--seq-550', '--seq-700']) {
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  return mix(cssVar(ramp[i]), cssVar(ramp[i + 1]), x - i);
}
export function mix(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c.join(',')})`;
}
function hex(h) {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}
/** Diverging colour for correlations (-1..1). */
export function divColor(v) {
  return v >= 0 ? mix(cssVar('--div-mid'), cssVar('--div-pos'), Math.min(1, v)) : mix(cssVar('--div-mid'), cssVar('--div-neg'), Math.min(1, -v));
}
