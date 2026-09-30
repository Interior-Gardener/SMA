// Shared app state + API helpers
export const PRESETS = [
  { id: 'snapshot', label: 'Satellite snapshot', desc: 'Conditions exactly as observed in the dataset (monsoon-season satellite pass).', s: { forecastRain: 0, tempAnomaly: 0, rhAnomaly: 0, daysSinceObs: 0 } },
  { id: 'dry', label: 'Summer dry spell', desc: '7 dry days since the satellite pass and +8 °C heat: soils deplete and stress builds.', s: { forecastRain: 0, tempAnomaly: 8, rhAnomaly: 0, daysSinceObs: 7 } },
  { id: 'rain', label: 'Dry spell + rain forecast', desc: 'Same dry spell, but IMD forecasts 40 mm of rain in 3 days: SMA postpones irrigation.', s: { forecastRain: 40, tempAnomaly: 8, rhAnomaly: 0, daysSinceObs: 7 } },
  { id: 'humid', label: 'Humid monsoon spell', desc: 'Warm, very humid weather with showers: fungal disease risk rises.', s: { forecastRain: 20, tempAnomaly: 2, rhAnomaly: 10, daysSinceObs: 0 } },
];

const DEFAULT = { forecastRain: 0, tempAnomaly: 0, rhAnomaly: 0, daysSinceObs: 0, method: 'furrow', pumpFlow: 50 };

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export const state = {
  scenario: { ...DEFAULT, ...load('sma.scenario', {}) },
  lang: load('sma.lang', 'en'),
  farmId: load('sma.farm', null),
  meta: null,
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); }
function emit(kind) { listeners.forEach((fn) => fn(kind)); }

export function setScenario(patch) {
  state.scenario = { ...state.scenario, ...patch };
  save('sma.scenario', state.scenario);
  emit('scenario');
}
export function setLang(lang) {
  state.lang = lang;
  save('sma.lang', lang);
  emit('lang');
}
export function setFarm(id) {
  state.farmId = id;
  save('sma.farm', id);
}
export function activePreset() {
  const s = state.scenario;
  const p = PRESETS.find((x) => Object.entries(x.s).every(([k, v]) => Number(s[k]) === v));
  return p || null;
}

export function qs(extra = {}) {
  const p = new URLSearchParams({ ...state.scenario, ...extra });
  return p.toString();
}

export async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
