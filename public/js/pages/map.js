import { api, qs, state } from '../state.js';
import { $, fmt, cssVar, seqColor, esc, stressBadge, riskBadge, statusBadge, mix } from '../ui.js';

let map;
let base = {};
let layer;
let geo = null;
let farms = [];
const NDVI_RAMP = ['#e6f4ea', '#a9dbb8', '#5fbf86', '#2a8f57', '#0e5a33'];

function rampColor(t, ramp) {
  const x = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  return mix(ramp[i], ramp[i + 1], x - i);
}

const LAYERS = {
  status: {
    color: (f) => {
      if (f.status === 'rain_skip') return cssVar('--series-1');
      if (f.status === 'today') return cssVar('--critical');
      if (f.status === 'tomorrow') return cssVar('--serious');
      if (f.dueInDays <= 3) return cssVar('--warning');
      return cssVar('--good');
    },
    legend: () => [['--critical', 'Today'], ['--serious', 'Tomorrow'], ['--warning', '2-3 days'], ['--good', '4+ days'], ['--series-1', 'Rain - skip']]
      .map(([v, l]) => `<span><i class="dot" style="background:${cssVar(v)}"></i>${l}</span>`).join(''),
  },
  stress: {
    color: (f) => cssVar(['--good', '--warning', '--serious', '--critical'][f.stressClass]),
    legend: () => ['None', 'Mild', 'Moderate', 'Severe'].map((l, i) => `<span><i class="dot" style="background:${cssVar(['--good', '--warning', '--serious', '--critical'][i])}"></i>${l}</span>`).join(''),
  },
  ndvi: {
    color: (f) => rampColor((f.ndvi - 0.3) / 0.45, NDVI_RAMP),
    legend: () => `<span>0.30</span><span class="ramp" style="background:linear-gradient(90deg,${NDVI_RAMP.join(',')})"></span><span>0.75 NDVI</span>`,
  },
  soilMoisture: {
    color: (f) => seqColor((f.soilMoisture - 0.215) / 0.045),
    legend: () => `<span>drier</span><span class="ramp" style="background:linear-gradient(90deg,${[0, 0.25, 0.5, 0.75, 1].map((t) => seqColor(t)).join(',')})"></span><span>wetter</span>`,
  },
  zone: {
    color: (f) => cssVar(`--series-${f.zone + 1}`),
    legend: () => [0, 1, 2, 3].map((z) => `<span><i class="dot" style="background:${cssVar(`--series-${z + 1}`)}"></i>Zone ${'ABCD'[z]}</span>`).join(''),
  },
  risk: {
    color: (f) => cssVar(['--good', '--warning', '--critical'][f.riskClass]),
    legend: () => ['Low', 'Medium', 'High'].map((l, i) => `<span><i class="dot" style="background:${cssVar(['--good', '--warning', '--critical'][i])}"></i>${l}</span>`).join(''),
  },
};

export function init() {
  const taluks = Object.keys(state.meta.taluks).sort();
  $('#mapTaluk').innerHTML += taluks.map((t) => `<option>${esc(t)}</option>`).join('');
  $('#mapLayer').addEventListener('change', draw);
  $('#mapTaluk').addEventListener('change', () => { draw(); fit(); });
  $('#mapBase').addEventListener('change', setBase);
}

function setBase() {
  if (!map) return;
  Object.values(base).forEach((l) => map.removeLayer(l));
  base[$('#mapBase').value].addTo(map);
}

function visible() {
  const t = $('#mapTaluk').value;
  return farms.filter((f) => !t || f.taluk === t);
}

function fit() {
  const pts = visible().map((f) => f.centroid).filter(Boolean);
  if (pts.length) map.fitBounds(pts, { padding: [30, 30] });
}

function panel(f) {
  $('#mapPanel').innerHTML = `
    <h3>${f.id}</h3>
    <div class="muted small">${esc(f.village)}, ${esc(f.taluk)} · ${fmt(f.areaHa, 2)} ha</div>
    <div class="divider"></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div>${statusBadge(f)}</div>
      <div>Water stress: ${stressBadge(f.stressClass)}</div>
      <div>Disease/pest risk: ${riskBadge(f.riskClass)}</div>
    </div>
    <div class="meta-grid" style="margin-top:12px">
      <div><b>${fmt(f.daysToIrrigation, 1)}</b><span>days to irrigation</span></div>
      <div><b>${fmt(f.hours, 1)} h</b><span>pumping (${fmt(f.volumeM3)} m³)</span></div>
      <div><b>${fmt(f.waterRequirementMm, 2)}</b><span>ETc mm/day</span></div>
      <div><b>${fmt(f.yieldTHa, 1)}</b><span>yield t/ha</span></div>
      <div><b>${fmt(f.ndvi, 3)}</b><span>NDVI</span></div>
      <div><b>${f.cropAgeDays} d</b><span>${esc(f.stage)}</span></div>
    </div>
    ${f.quality.length ? `<div class="note warn-note" style="margin-top:12px">${f.quality.map(esc).join('<br>')}</div>` : ''}
    <button class="btn" style="margin-top:14px;width:100%" id="mapOpen">Open full advisory →</button>`;
  $('#mapOpen').onclick = () => window.dispatchEvent(new CustomEvent('sma:open-farm', { detail: f.id }));
}

function draw() {
  if (!map) return;
  if (layer) map.removeLayer(layer);
  const L = window.L;
  const cfg = LAYERS[$('#mapLayer').value];
  const polyById = new Map((geo || []).map((g) => [g.id, g.polygon]));
  const zoomed = map.getZoom() >= 15;
  layer = L.layerGroup();
  for (const f of visible()) {
    const color = cfg.color(f);
    const shape = zoomed && polyById.get(f.id)?.length
      ? L.polygon(polyById.get(f.id), { color: '#ffffff', weight: 1, fillColor: color, fillOpacity: 0.85 })
      : L.circleMarker(f.centroid, { radius: 6, color: '#ffffff', weight: 1.5, fillColor: color, fillOpacity: 0.95 });
    shape.bindTooltip(`<b>${f.id}</b> · ${esc(f.village)}<br>${f.status === 'rain_skip' ? 'Rain - skip' : `Irrigate in ${f.dueInDays} d`} · Stress ${['None', 'Mild', 'Moderate', 'Severe'][f.stressClass]}`);
    shape.on('click', () => panel(f));
    layer.addLayer(shape);
  }
  // Village labels keep the map readable even when basemap tiles are offline
  const villages = {};
  for (const f of visible()) (villages[f.village] ||= []).push(f.centroid);
  for (const [name, pts] of Object.entries(villages)) {
    const c = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
    layer.addLayer(L.marker(c, { opacity: 0, interactive: false }).bindTooltip(esc(name), { permanent: true, direction: 'top', className: 'village-label', offset: [0, -14] }));
  }
  layer.addTo(map);
  $('#mapLegend').innerHTML = cfg.legend();
}

export async function render() {
  const L = window.L;
  if (!map) {
    map = L.map('map', { zoomControl: true, preferCanvas: true });
    base = {
      sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19, attribution: 'Imagery © Esri',
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
    };
    setBase();
    map.on('zoomend', draw);
  }
  const [list, g] = await Promise.all([api(`/farms?${qs()}`), geo ? Promise.resolve(geo) : api('/farms/geo')]);
  geo = g;
  farms = list.farms;
  draw();
  if (!render.fitted) { fit(); render.fitted = true; }
  setTimeout(() => map.invalidateSize(), 50);
}

export function shown() {
  setTimeout(() => map && map.invalidateSize(), 50);
}
