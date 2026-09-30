/**
 * SMA - Smart Moisture Advisor: HTTP API + static web app.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const config = require('./config');
const { loadFarms, median } = require('./data/farms');
const { models, metrics, MODEL_NAMES } = require('./ml/registry');
const advisory = require('./engine/advisory');
const { setBaseline } = require('./engine/explain');
const { buildInsights } = require('./engine/insights');
const { schedule } = require('./engine/scheduler');
const chat = require('./engine/chat');
const { LANGS } = require('./engine/i18n');
const agro = require('./engine/agronomy');

function createApp({ dataFile } = {}) {
  const { farms, quality } = loadFarms(dataFile);
  const byId = new Map(farms.map((f) => [f.id.toUpperCase(), f]));

  // Regional medians = reference point for "why this advice?" explanations
  const baseline = {};
  for (const k of ['ndvi', 'lai', 'soil_moisture', 'soil_ph', 'organic_carbon', 'temperature_c', 'relative_humidity', 'rainfall_mm', 'crop_age_days']) {
    baseline[k] = +median(farms.map((f) => f[k])).toFixed(4);
  }
  baseline.forecast_rain_mm = 0;
  setBaseline(baseline);

  // Small cache: plot summaries for each weather scenario
  const cache = new Map();
  function summariesFor(scenario) {
    const key = advisory.scenarioKey(scenario);
    if (!cache.has(key)) {
      if (cache.size > 30) cache.delete(cache.keys().next().value);
      cache.set(key, farms.map((f) => advisory.summarize(f, scenario)));
    }
    return cache.get(key);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // ---------------------------------------------------------------- static
  app.use(express.static(path.join(config.ROOT, 'public')));
  app.use('/vendor/chart.js', express.static(path.join(config.ROOT, 'node_modules', 'chart.js', 'dist')));
  app.use('/vendor/leaflet', express.static(path.join(config.ROOT, 'node_modules', 'leaflet', 'dist')));

  // ---------------------------------------------------------------- API
  const api = express.Router();

  api.get('/health', (req, res) => {
    res.json({ status: 'ok', plots: farms.length, models: MODEL_NAMES.length, time: new Date().toISOString() });
  });

  api.get('/meta', (req, res) => {
    const taluks = {};
    for (const f of farms) (taluks[f.taluk] ||= new Set()).add(f.village);
    res.json({
      plots: farms.length,
      district: farms[0]?.district,
      taluks: Object.fromEntries(Object.entries(taluks).map(([t, v]) => [t, [...v].sort()])),
      languages: LANGS,
      methods: config.IRRIGATION_METHODS,
      defaults: config.DEFAULT_SCENARIO,
      baseline,
      stages: agro.STAGES,
      conventional: config.CONVENTIONAL,
      bounds: Object.fromEntries(Object.keys(baseline).map((k) => {
        const vals = farms.map((f) => f[k]);
        return [k, { min: Math.min(...vals), max: Math.max(...vals) }];
      })),
    });
  });

  api.get('/farms', (req, res) => {
    const scenario = advisory.parseScenario(req.query);
    let list = summariesFor(scenario);
    if (req.query.taluk) list = list.filter((f) => f.taluk === req.query.taluk);
    if (req.query.village) list = list.filter((f) => f.village === req.query.village);
    res.json({ scenario, count: list.length, farms: list });
  });

  api.get('/farms/geo', (req, res) => {
    res.json(farms.map((f) => ({ id: f.id, polygon: f.polygon })));
  });

  api.get('/farms/:id', (req, res) => {
    const farm = byId.get(String(req.params.id).toUpperCase());
    if (!farm) return res.status(404).json({ error: 'Plot not found' });
    const scenario = advisory.parseScenario(req.query);
    const overrides = {};
    if (req.query.cropAge !== undefined && Number.isFinite(Number(req.query.cropAge))) {
      overrides.crop_age_days = agro.clip(Number(req.query.cropAge), 0, 365);
    }
    return res.json(advisory.farmAdvisory({ ...farm, ...overrides }, scenario, req.query.lang || 'en'));
  });

  // What-if prediction for arbitrary inputs (simulator / integrations)
  const RANGES = {
    ndvi: [0.05, 0.95], lai: [0.05, 2], soil_moisture: [0.05, 0.45], soil_ph: [4, 9],
    organic_carbon: [1, 30], temperature_c: [10, 45], relative_humidity: [15, 100],
    rainfall_mm: [200, 1500], crop_age_days: [0, 365], forecast_rain_mm: [0, 150],
  };
  api.post('/predict', (req, res) => {
    const body = req.body || {};
    const x = {};
    for (const [k, [lo, hi]] of Object.entries(RANGES)) {
      const v = Number(body[k] ?? baseline[k]);
      if (!Number.isFinite(v)) return res.status(400).json({ error: `Invalid value for ${k}` });
      x[k] = agro.clip(v, lo, hi);
    }
    const scenario = advisory.parseScenario(body);
    const areaHa = agro.clip(Number(body.area_ha) || farms[0].area_ha, 0.05, 50);
    return res.json(advisory.fullAdvisory(x, {
      areaHa, method: scenario.method, pumpFlow: scenario.pumpFlow, lang: body.lang || 'en',
    }));
  });

  api.get('/insights', (req, res) => {
    const scenario = advisory.parseScenario(req.query);
    res.json(buildInsights(summariesFor(scenario), farms, quality, scenario));
  });

  api.post('/schedule', (req, res) => {
    const body = req.body || {};
    const scenario = advisory.parseScenario(body);
    let list = summariesFor(scenario);
    if (body.taluk) list = list.filter((f) => f.taluk === body.taluk);
    if (body.village) list = list.filter((f) => f.village === body.village);
    const windows = Array.isArray(body.windows) && body.windows.length
      ? body.windows.slice(0, 6).filter((w) => /^\d{1,2}:\d{2}$/.test(w.start) && /^\d{1,2}:\d{2}$/.test(w.end))
      : [{ start: '06:00', end: '10:00' }, { start: '17:00', end: '20:00' }];
    const capacity = Number(body.capacity) || 10;
    const days = agro.clip(Number(body.days) || 2, 1, 4);
    res.json({ scenario, ...schedule(list, { windows, capacity, days, method: scenario.method }), windows });
  });

  api.get('/models', (req, res) => {
    const info = Object.fromEntries(MODEL_NAMES.map((n) => [n, {
      title: models[n].title, type: models[n].type, trees: models[n].trees.length, nodes: models[n].nodeCount,
    }]));
    res.json({ ...metrics, runtime: info });
  });

  // Human-in-the-loop: farmers / supervisors accept or override advice
  api.post('/feedback', (req, res) => {
    const b = req.body || {};
    if (!byId.has(String(b.farmId || '').toUpperCase())) return res.status(400).json({ error: 'Unknown farmId' });
    if (!['accepted', 'overridden'].includes(b.action)) return res.status(400).json({ error: 'action must be accepted|overridden' });
    const entry = {
      time: new Date().toISOString(),
      farmId: String(b.farmId).toUpperCase(),
      action: b.action,
      recommendedDays: Number(b.recommendedDays) || null,
      actualDays: b.actualDays === undefined ? null : Number(b.actualDays),
      reason: String(b.reason || '').slice(0, 300),
      role: ['farmer', 'supervisor', 'agronomist'].includes(b.role) ? b.role : 'farmer',
    };
    fs.appendFileSync(config.FEEDBACK_FILE, `${JSON.stringify(entry)}\n`);
    res.status(201).json({ ok: true, entry });
  });

  api.get('/feedback', (req, res) => {
    let entries = [];
    if (fs.existsSync(config.FEEDBACK_FILE)) {
      entries = fs.readFileSync(config.FEEDBACK_FILE, 'utf8').split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    }
    const accepted = entries.filter((e) => e.action === 'accepted').length;
    res.json({
      total: entries.length,
      accepted,
      overridden: entries.length - accepted,
      acceptanceRate: entries.length ? +(accepted / entries.length).toFixed(3) : null,
      recent: entries.slice(-20).reverse(),
    });
  });

  api.post('/chat', (req, res) => {
    const b = req.body || {};
    const scenario = advisory.parseScenario(b.scenario || {});
    res.json(chat.reply(b.message, {
      lang: b.lang,
      farmId: b.farmId,
      findFarm: (id) => byId.get(String(id).toUpperCase()) || null,
      advise: (farm, lang) => advisory.farmAdvisory(farm, scenario, lang),
    }));
  });

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal error' });
  });

  return app;
}

module.exports = { createApp };
