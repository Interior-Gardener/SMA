/**
 * Agronomy helpers used by the decision-support engine (JavaScript port of the
 * relevant parts of ml/agronomy.py) plus the rule-based fertigation planner.
 */
const clip = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

function expectedNdvi(age) {
  const rise = 0.3 + 0.38 * clip((age - 20) / 130, 0, 1);
  const decline = clip((age - 290) / 75, 0, 1) * 0.1;
  return rise - decline;
}

const STAGES = [
  { key: 'germination', name: 'Germination', from: 0, to: 45 },
  { key: 'tillering', name: 'Tillering', from: 45, to: 130 },
  { key: 'grand_growth', name: 'Grand growth', from: 130, to: 290 },
  { key: 'maturity', name: 'Maturity', from: 290, to: 10000 },
];

function growthStage(age) {
  return STAGES.find((s) => age >= s.from && age < s.to) || STAGES[3];
}

function soilHydraulics(oc) {
  const c = clip(oc, 0, 25);
  return { fc: 0.27 + 0.003 * c, pwp: 0.12 + 0.0015 * c };
}

const rootDepth = (age) => 0.3 + (0.9 * clip(age, 0, 150)) / 150;
const effectiveRain = (mm) => 0.8 * Math.max(0, mm - 3);

function waterBalance(sm, oc, age, etc) {
  const { fc, pwp } = soilHydraulics(oc);
  const zr = rootDepth(age);
  const taw = 1000 * (fc - pwp) * zr;
  const dr = clip(1000 * (fc - sm) * zr, 0, taw);
  const p = clip(0.65 + 0.04 * (5 - etc), 0.4, 0.8);
  return { fc, pwp, zr, taw, dr, p, raw: p * taw };
}

/**
 * Day-by-day root-zone projection (% of plant-available water) for the next
 * `days`, comparing "follow SMA advice" against "no irrigation".
 */
function projectMoisture({ sm, oc, age, etc, forecastRain, irrigateOnDay, days = 14 }) {
  const wb = waterBalance(sm, oc, age, etc);
  const peff = effectiveRain(forecastRain);
  let drAdvice = wb.dr;
  let drNone = wb.dr;
  const out = [];
  for (let d = 0; d <= days; d++) {
    if (d > 0) {
      const rain = d <= 3 ? peff / 3 : 0;
      drAdvice = clip(drAdvice + etc - rain, 0, wb.taw);
      drNone = clip(drNone + etc - rain, 0, wb.taw);
      if (d === irrigateOnDay) drAdvice = 0; // irrigation refills the root zone to field capacity
    } else if (irrigateOnDay === 0) {
      drAdvice = 0;
    }
    out.push({
      day: d,
      advice: +(100 * (1 - drAdvice / wb.taw)).toFixed(1),
      none: +(100 * (1 - drNone / wb.taw)).toFixed(1),
    });
  }
  return { series: out, stressThreshold: +(100 * (1 - wb.raw / wb.taw)).toFixed(1), taw: wb.taw, raw: wb.raw };
}

// ---------------------------------------------------------------------------
// Fertigation (rule-based decision support, UAS / KIAAR style package)
// ---------------------------------------------------------------------------
const NPK_PACKAGE = { n: 250, p: 100, k: 125 }; // kg/ha for a 12-month plant crop
const FERT_WINDOWS = [
  { name: 'Germination', from: 0, to: 45, n: 0.1, p: 0.25, k: 0.1 },
  { name: 'Tillering', from: 45, to: 130, n: 0.4, p: 0.45, k: 0.3 },
  { name: 'Grand growth (early)', from: 130, to: 240, n: 0.5, p: 0.3, k: 0.45 },
  { name: 'Grand growth (late)', from: 240, to: 290, n: 0, p: 0, k: 0.15 },
  { name: 'Maturity', from: 290, to: 10000, n: 0, p: 0, k: 0 },
];

function fertigationPlan({ age, oc, ph, ndvi, areaHa, stressClass }) {
  const w = FERT_WINDOWS.find((x) => age >= x.from && age < x.to);
  const weeks = Math.max(1, (Math.min(w.to, 365) - w.from) / 7);
  let nFactor = 1;
  const notes = [];
  if (oc < 5) { nFactor = 1.25; notes.push('Low organic carbon: nitrogen increased by 25%.'); }
  else if (oc > 7.5) { nFactor = 0.9; notes.push('High organic carbon: nitrogen reduced by 10%.'); }

  const perHa = {
    n: (NPK_PACKAGE.n * w.n * nFactor) / weeks,
    p: (NPK_PACKAGE.p * w.p) / weeks,
    k: (NPK_PACKAGE.k * w.k) / weeks,
  };
  // Products: 12-61-0 (MAP) for P, urea (46% N) for the remaining N, MOP (60% K2O) for K
  const map = perHa.p / 0.61;
  const urea = Math.max(0, perHa.n - map * 0.12) / 0.46;
  const mop = perHa.k / 0.6;

  if (ph < 6.2) notes.push('Soil is slightly acidic (pH < 6.2): apply agricultural lime (1-2 t/ha) before the next planting.');
  if (ph > 7.8) notes.push('Alkaline soil (pH > 7.8): apply gypsum and prefer acid-forming fertilisers.');
  if (ndvi < expectedNdvi(age) - 0.08) notes.push('Crop vigour below expected: add a foliar spray of 2% urea + micronutrient mix.');
  if (stressClass >= 2) notes.push('Irrigate first - never fertigate into dry soil (nutrient burn and losses).');
  if (w.n === 0 && w.k === 0) notes.push('Crop is maturing: stop fertiliser application to improve sucrose recovery.');
  else if (w.n === 0) notes.push('No nitrogen after 8 months - it delays maturity and lowers sugar recovery.');

  const r = (x) => +(x * areaHa).toFixed(1);
  return {
    stage: w.name,
    package: NPK_PACKAGE,
    weeklyNutrientsKg: { n: r(perHa.n), p2o5: r(perHa.p), k2o: r(perHa.k) },
    weeklyProductsKg: { urea: r(urea), map_12_61_0: r(map), mop: r(mop) },
    splitsPerWeek: 2,
    notes,
  };
}

module.exports = {
  clip, expectedNdvi, growthStage, STAGES, soilHydraulics, rootDepth, effectiveRain,
  waterBalance, projectMoisture, fertigationPlan,
};
