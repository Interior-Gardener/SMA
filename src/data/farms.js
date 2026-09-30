/**
 * Loads the IrrigationAdvisoryDataset CSV and turns every row into a clean
 * farm (plot) record: numeric features, data-quality flags, polygon geometry
 * and an estimated crop age.
 */
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { DATA_FILE } = require('../config');

const NUMERIC = {
  Farm_Area_ha: 'area_ha',
  NDVI: 'ndvi',
  LAI: 'lai',
  Soil_Moisture: 'soil_moisture',
  Soil_pH: 'soil_ph',
  Organic_Carbon: 'organic_carbon',
  Temperature_C: 'temperature_c',
  Relative_Humidity: 'relative_humidity',
  Rainfall_mm: 'rainfall_mm',
};

function median(values) {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Deterministic FNV-1a hash -> stable pseudo planting date per plot. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function parseGeometry(geo) {
  try {
    const g = JSON.parse(geo);
    const ring = g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
    const polygon = ring.map(([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)]);
    const pts = polygon.slice(0, -1);
    const centroid = [
      pts.reduce((s, p) => s + p[0], 0) / pts.length,
      pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
    return { polygon, centroid };
  } catch {
    return { polygon: [], centroid: null };
  }
}

function loadFarms(file = DATA_FILE) {
  const rows = parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true });

  const farms = rows.map((r) => {
    const f = {
      id: r.Farm_ID,
      district: r.District,
      taluk: r.Taluk,
      village: r.Village,
      source: r.Sampling_Method,
      quality: [],
    };
    for (const [col, key] of Object.entries(NUMERIC)) {
      const v = r[col] === '' || r[col] === undefined ? NaN : Number(r[col]);
      f[key] = v;
    }
    Object.assign(f, parseGeometry(r['.geo']));
    // Crop age is not part of the dataset. In production it comes from the
    // STEPS plot-survey records; here a stable pseudo planting date is used.
    f.crop_age_days = 20 + (hash(f.id) % 330);
    return f;
  });

  // Impute missing NDVI (cloud-masked pixels) with the village median.
  const byVillage = {};
  for (const f of farms) (byVillage[f.village] ||= []).push(f.ndvi);
  const overall = median(farms.map((f) => f.ndvi));
  for (const f of farms) {
    if (!Number.isFinite(f.ndvi)) {
      const m = median(byVillage[f.village]);
      f.ndvi = Number.isFinite(m) ? m : overall;
      f.quality.push('NDVI missing (cloud) - imputed with village median');
    }
  }

  // Robust outlier flags - "noisy sensor" detection. Each plot is compared
  // with the other plots of its own village (neighbours share soil and
  // weather), using the modified z-score of Iglewicz & Hoaglin. When most
  // values are identical the MAD is 0, so the mean absolute deviation is used.
  const checked = ['ndvi', 'lai', 'soil_moisture', 'soil_ph', 'organic_carbon'];
  const outlierCounts = Object.fromEntries(checked.map((k) => [k, 0]));
  const villages = {};
  for (const f of farms) (villages[f.village] ||= []).push(f);
  for (const group of Object.values(villages)) {
    for (const key of checked) {
      const vals = group.map((f) => f[key]);
      const med = median(vals);
      const mad = median(vals.map((v) => Math.abs(v - med)));
      const meanAd = vals.reduce((sum, v) => sum + Math.abs(v - med), 0) / vals.length;
      const scale = mad > 0 ? mad / 0.6745 : meanAd * 1.2533;
      if (!(scale > 0)) continue;
      for (const f of group) {
        const z = (f[key] - med) / scale;
        if (Math.abs(z) > 3.5) {
          f.quality.push(`${key.replace('_', ' ')} unusual for ${f.village} (robust z = ${z.toFixed(1)}) - verify sensor`);
          outlierCounts[key] += 1;
        }
      }
    }
  }

  const constantColumns = Object.keys(NUMERIC).filter((col) => {
    const key = NUMERIC[col];
    return new Set(farms.map((f) => f[key].toFixed(6))).size === 1;
  });

  return {
    farms,
    quality: {
      rows: farms.length,
      missingNdvi: farms.filter((f) => f.quality.some((q) => q.startsWith('NDVI missing'))).length,
      outlierCounts,
      constantColumns,
      singleValueColumns: ['District', 'Sampling_Method'].filter(
        (c) => new Set(rows.map((r) => r[c])).size === 1,
      ),
    },
  };
}

module.exports = { loadFarms, median, hash };
