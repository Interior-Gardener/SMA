const fs = require('fs');
const path = require('path');
const { loadModel } = require('./treeEnsemble');
const { MODELS_DIR } = require('../config');

const MODEL_NAMES = [
  'next_irrigation',
  'water_requirement',
  'irrigation_depth',
  'water_stress',
  'yield',
  'yield_loss',
  'disease_risk',
];

const models = {};
for (const name of MODEL_NAMES) models[name] = loadModel(MODELS_DIR, name);

const zones = JSON.parse(fs.readFileSync(path.join(MODELS_DIR, 'zones.json'), 'utf8'));
const metrics = JSON.parse(fs.readFileSync(path.join(MODELS_DIR, 'metrics.json'), 'utf8'));

/** Assign a plot to its nearest K-Means management zone. */
function assignZone(input) {
  const z = zones.features.map((f, i) => (input[f] - zones.mean[i]) / zones.scale[i]);
  let best = 0;
  let bestDist = Infinity;
  zones.centroids.forEach((c, k) => {
    const d = c.reduce((s, v, i) => s + (v - z[i]) ** 2, 0);
    if (d < bestDist) {
      bestDist = d;
      best = k;
    }
  });
  return best;
}

/** Human-readable names for zones, derived from their centroids. */
function describeZones() {
  const idx = (f) => zones.features.indexOf(f);
  const meanRaw = zones.mean;
  return zones.centroids_raw.map((c, k) => {
    const tags = [];
    const rel = (f) => c[idx(f)] - meanRaw[idx(f)];
    tags.push(rel('ndvi') >= 0 ? 'High vigour' : 'Low vigour');
    tags.push(rel('soil_moisture') >= 0 ? 'moist soil' : 'drier soil');
    if (rel('rainfall_mm') > 30) tags.push('high rainfall belt');
    else if (rel('rainfall_mm') < -30) tags.push('low rainfall belt');
    if (rel('organic_carbon') > 1) tags.push('rich in organic carbon');
    if (c[idx('soil_ph')] > 6.6) tags.push('near-neutral pH');
    else if (c[idx('soil_ph')] < 6.25) tags.push('slightly acidic');
    const centroid = {};
    zones.features.forEach((f, i) => { centroid[f] = c[i]; });
    return { id: k, name: `Zone ${String.fromCharCode(65 + k)}`, description: tags.join(', '), size: zones.sizes[k], centroid };
  });
}

module.exports = { models, zones, metrics, assignZone, describeZones, MODEL_NAMES };
