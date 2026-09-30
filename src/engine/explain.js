/**
 * Local explanations ("Why this advice?").
 *
 * For each input feature we replace the plot's value with the regional
 * median and measure how much the prediction moves. Large moves mean the
 * feature is driving this particular recommendation. This is a simple,
 * model-agnostic sensitivity analysis - cheap enough to run per request.
 */
const { models } = require('../ml/registry');

const LABELS = {
  ndvi: 'NDVI (crop vigour)',
  lai: 'Leaf Area Index',
  soil_moisture: 'Soil moisture',
  soil_ph: 'Soil pH',
  organic_carbon: 'Organic carbon',
  temperature_c: 'Temperature',
  relative_humidity: 'Relative humidity',
  rainfall_mm: 'Seasonal rainfall',
  crop_age_days: 'Crop age',
  forecast_rain_mm: 'Forecast rain',
};

let baseline = null;

function setBaseline(values) {
  baseline = values;
}

function stressRisk(x) {
  const p = models.water_stress.predict(x);
  return p[2] + p[3];
}

function contributions(x, fn, digits) {
  const full = fn(x);
  return Object.keys(LABELS)
    .map((f) => {
      const ref = baseline[f];
      if (ref === undefined || Math.abs(x[f] - ref) < 1e-9) return { feature: f, label: LABELS[f], value: x[f], baseline: ref, effect: 0 };
      const effect = full - fn({ ...x, [f]: ref });
      return { feature: f, label: LABELS[f], value: x[f], baseline: ref, effect: +effect.toFixed(digits) };
    })
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

function explain(x) {
  if (!baseline) return null;
  const days = contributions(x, (v) => models.next_irrigation.predict(v), 2);
  const stress = contributions(x, stressRisk, 3);
  const top = days.filter((d) => Math.abs(d.effect) >= 0.2).slice(0, 3).map((d) => {
    const dir = d.effect > 0 ? 'delays' : 'brings forward';
    const cmp = d.value > d.baseline ? 'higher' : 'lower';
    return `${d.label} is ${cmp} than the regional median, which ${dir} irrigation by ${Math.abs(d.effect).toFixed(1)} days.`;
  });
  return { baseline, nextIrrigation: days, waterStress: stress, reasons: top };
}

module.exports = { explain, setBaseline, LABELS };
