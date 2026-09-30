/**
 * Decision-support engine: turns raw model outputs into a complete,
 * plot-specific irrigation / fertigation / risk advisory.
 */
const { models, assignZone, describeZones } = require('../ml/registry');
const agro = require('./agronomy');
const i18n = require('./i18n');
const { explain } = require('./explain');
const { IRRIGATION_METHODS, DEFAULT_SCENARIO, PUMP_KW, TARIFF_RS_PER_KWH, CONVENTIONAL } = require('../config');

const { clip } = agro;
const round = (x, d = 1) => +Number(x).toFixed(d);
const ZONES = describeZones();

/** Normalise user-supplied scenario values (query string or JSON body). */
function parseScenario(q = {}) {
  const num = (v, def, lo, hi) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== '' && v !== null && v !== undefined ? clip(n, lo, hi) : def;
  };
  const method = IRRIGATION_METHODS[q.method] ? q.method : DEFAULT_SCENARIO.method;
  return {
    forecastRain: num(q.forecastRain, DEFAULT_SCENARIO.forecastRain, 0, 150),
    tempAnomaly: num(q.tempAnomaly, DEFAULT_SCENARIO.tempAnomaly, -6, 14),
    method,
    pumpFlow: num(q.pumpFlow, DEFAULT_SCENARIO.pumpFlow, 5, 200),
    daysSinceObs: Math.round(num(q.daysSinceObs, DEFAULT_SCENARIO.daysSinceObs, 0, 30)),
    rhAnomaly: num(q.rhAnomaly, DEFAULT_SCENARIO.rhAnomaly, -40, 30),
  };
}

const scenarioKey = (s) => `${s.forecastRain}|${s.tempAnomaly}|${s.method}|${s.pumpFlow}|${s.daysSinceObs}|${s.rhAnomaly}`;

/**
 * Model input features for a plot under a weather scenario.
 *
 * The satellite soil-moisture value is a snapshot. When `daysSinceObs` dry
 * days have passed since that observation, the root zone is depleted
 * day-by-day with the predicted crop water use (FAO-56 water-balance
 * bookkeeping) - exactly how an operational advisory keeps moisture current
 * between sensor readings.
 */
function farmFeatures(farm, scenario) {
  const x = {
    ndvi: farm.ndvi,
    lai: farm.lai,
    soil_moisture: farm.soil_moisture,
    soil_ph: farm.soil_ph,
    organic_carbon: farm.organic_carbon,
    temperature_c: farm.temperature_c + scenario.tempAnomaly,
    relative_humidity: clip(farm.relative_humidity - 2.5 * scenario.tempAnomaly + scenario.rhAnomaly, 25, 98),
    rainfall_mm: farm.rainfall_mm,
    crop_age_days: farm.crop_age_days,
    forecast_rain_mm: scenario.forecastRain,
  };
  if (scenario.daysSinceObs > 0) {
    const etc = Math.max(0.3, models.water_requirement.predict(x));
    const { pwp } = agro.soilHydraulics(x.organic_carbon);
    const zr = agro.rootDepth(x.crop_age_days);
    x.soil_moisture = Math.max(pwp, x.soil_moisture - (etc * scenario.daysSinceObs) / (1000 * zr));
  }
  return x;
}

/**
 * Ordinal median of a class-probability vector: the first class at which the
 * cumulative probability reaches 50%. For ordered classes (None < Mild <
 * Moderate < Severe) this is more faithful than argmax - if there is a 52%
 * chance of "moderate or worse", the advisory says moderate.
 */
const ordinalMedian = (p) => {
  let c = 0;
  for (let i = 0; i < p.length; i++) {
    c += p[i];
    if (c >= 0.5) return i;
  }
  return p.length - 1;
};

/**
 * Core predictions - fast enough to run for every plot on every request.
 */
function predictCore(x, { areaHa, method, pumpFlow }) {
  const eff = IRRIGATION_METHODS[method].efficiency;
  const days = models.next_irrigation.predictWithSpread(x);
  const daysNoRain = x.forecast_rain_mm > 0
    ? models.next_irrigation.predict({ ...x, forecast_rain_mm: 0 })
    : days.mean;
  const etc = Math.max(0.3, models.water_requirement.predict(x));
  const depth = clip(models.irrigation_depth.predict(x), 0, 100);
  const stressP = models.water_stress.predict(x);
  const yieldHa = models.yield.predict(x);
  const riskP = models.disease_risk.predict(x);
  const loss5 = clip(models.yield_loss.predict({ ...x, delay_days: 5 }), 0, 100);

  const dueIn = Math.round(clip(days.mean, 0, 15));
  const dueNoRain = Math.round(clip(daysNoRain, 0, 15));
  let status = dueIn === 0 ? 'today' : dueIn === 1 ? 'tomorrow' : 'later';
  const rainSkip = x.forecast_rain_mm >= 5 && dueNoRain <= 2 && dueIn > dueNoRain;
  if (rainSkip) status = 'rain_skip';

  // Irrigation event (depth refills root zone; gross accounts for method efficiency)
  const grossMm = depth / eff;
  const volume = grossMm * areaHa * 10; // 1 mm over 1 ha = 10 m3
  const hours = volume / pumpFlow;
  const dripDailyVolume = (etc * areaHa * 10) / eff;

  // Weekly water & energy vs conventional fixed-interval practice
  const peff = agro.effectiveRain(x.forecast_rain_mm);
  const recWeeklyMm = Math.max(0, etc * 7 - peff) / eff;
  const convWeeklyMm = (CONVENTIONAL.grossDepthMm * 7) / CONVENTIONAL.intervalDays;
  const recWeeklyM3 = recWeeklyMm * areaHa * 10;
  const convWeeklyM3 = convWeeklyMm * areaHa * 10;
  const savedM3 = Math.max(0, convWeeklyM3 - recWeeklyM3);
  const savedKwh = (savedM3 / pumpFlow) * PUMP_KW;

  const stressClass = ordinalMedian(stressP);
  const riskClass = ordinalMedian(riskP);
  const riskType = riskClass === 0 ? 'none' : x.relative_humidity >= 70 ? 'fungal' : 'borer';

  return {
    daysToIrrigation: round(days.mean, 2),
    daysUncertainty: round(days.sd, 2),
    dueInDays: dueIn,
    dueInDaysWithoutRain: dueNoRain,
    status,
    waterRequirementMm: round(etc, 2),
    netDepthMm: round(depth, 1),
    grossDepthMm: round(grossMm, 1),
    volumeM3: round(volume, 0),
    hours: round(hours, 1),
    dripDailyVolumeM3: round(dripDailyVolume, 1),
    dripDailyHours: round(dripDailyVolume / pumpFlow, 2),
    stressProbabilities: stressP.map((p) => round(p, 3)),
    stressClass,
    stressProbability: round(stressP[2] + stressP[3], 3),
    yieldTHa: round(yieldHa, 1),
    yieldTotalT: round(yieldHa * areaHa, 1),
    yieldLoss5DaysPct: round(loss5, 2),
    tonnesAtRisk: round((loss5 / 100) * yieldHa * areaHa, 2),
    riskProbabilities: riskP.map((p) => round(p, 3)),
    riskClass,
    riskType,
    weekly: {
      recommendedM3: round(recWeeklyM3, 0),
      conventionalM3: round(convWeeklyM3, 0),
      savedM3: round(savedM3, 0),
      savedKwh: round(savedKwh, 1),
      savedRs: round(savedKwh * TARIFF_RS_PER_KWH, 0),
      rainSavedM3: round(peff * areaHa * 10, 0),
    },
  };
}

function alertsFor(core) {
  const a = [];
  if (core.stressClass === 3) a.push({ level: 'critical', text: 'Severe water stress' });
  else if (core.stressClass === 2) a.push({ level: 'serious', text: 'Moderate water stress' });
  if (core.status === 'today') a.push({ level: 'warning', text: 'Irrigation due today' });
  if (core.status === 'rain_skip') a.push({ level: 'good', text: 'Rain expected - skip irrigation' });
  if (core.riskClass === 2) a.push({ level: 'critical', text: core.riskType === 'borer' ? 'High pest risk' : 'High disease risk' });
  return a;
}

/** Compact advisory for lists, the map and the dashboard. */
function summarize(farm, scenario) {
  const x = farmFeatures(farm, scenario);
  const core = predictCore(x, { areaHa: farm.area_ha, method: scenario.method, pumpFlow: scenario.pumpFlow });
  return {
    id: farm.id,
    taluk: farm.taluk,
    village: farm.village,
    centroid: farm.centroid,
    areaHa: round(farm.area_ha, 3),
    cropAgeDays: farm.crop_age_days,
    stage: agro.growthStage(farm.crop_age_days).name,
    ndvi: round(farm.ndvi, 3),
    soilMoisture: round(farm.soil_moisture, 4),
    zone: assignZone(x),
    quality: farm.quality,
    ...core,
    alerts: alertsFor(core),
  };
}

function advisoryText(core, ctx, lang) {
  const { date, method, fert } = ctx;
  const L = i18n.lang(lang);
  const lines = [];
  const add = (key, text) => lines.push({ key, text });
  const vars = { hours: core.hours, volume: core.volumeM3, days: core.dueInDays, date: i18n.formatDate(date, L) };
  const irrigationKey = { rain_skip: 'rain_skip', today: 'irrigate_today', tomorrow: 'irrigate_tomorrow' }[core.status] || 'irrigate_in';
  add('irrigation', i18n.t(L, irrigationKey, { ...vars, rain: ctx.forecastRain }));
  if (method === 'drip') add('drip', i18n.t(L, 'drip_daily', { hours: core.dripDailyHours, volume: core.dripDailyVolumeM3 }));
  add('stress', i18n.t(L, 'stress', {
    level: i18n.level(L, 'stress_levels', core.stressClass),
    prob: Math.round(core.stressProbability * 100),
  }));
  add('delay', i18n.t(L, 'delay', { loss: core.yieldLoss5DaysPct, tonnes: core.tonnesAtRisk }));
  add('yield', i18n.t(L, 'yield', { yield: core.yieldTHa, total: core.yieldTotalT }));
  const p = fert.weeklyProductsKg;
  if (p.urea + p.map_12_61_0 + p.mop > 0) {
    add('fertigation', i18n.t(L, 'fert', { urea: p.urea, map: p.map_12_61_0, mop: p.mop, splits: fert.splitsPerWeek }));
  } else add('fertigation', i18n.t(L, 'fert_stop'));
  if (core.riskClass === 0) add('disease', i18n.t(L, 'disease_low'));
  else add('disease', i18n.t(L, core.riskType === 'borer' ? 'borer' : 'fungal'));
  return lines;
}

/**
 * Full advisory for one set of inputs (a real plot or a what-if scenario).
 */
function fullAdvisory(x, { areaHa, method, pumpFlow, lang = 'en', today = new Date(), meta = {} }) {
  const core = predictCore(x, { areaHa, method, pumpFlow });
  const age = x.crop_age_days;
  const stage = agro.growthStage(age);

  const lossCurve = [];
  for (let d = 0; d <= 14; d++) {
    lossCurve.push({ delay: d, lossPct: round(clip(models.yield_loss.predict({ ...x, delay_days: d }), 0, 100), 2) });
  }
  // The curve must be non-decreasing: waiting longer can never reduce loss.
  for (let i = 1; i < lossCurve.length; i++) {
    lossCurve[i].lossPct = Math.max(lossCurve[i].lossPct, lossCurve[i - 1].lossPct);
  }

  const projection = agro.projectMoisture({
    sm: x.soil_moisture, oc: x.organic_carbon, age, etc: core.waterRequirementMm,
    forecastRain: x.forecast_rain_mm, irrigateOnDay: core.dueInDays,
  });
  const fert = agro.fertigationPlan({
    age, oc: x.organic_carbon, ph: x.soil_ph, ndvi: x.ndvi, areaHa, stressClass: core.stressClass,
  });
  const date = new Date(today.getTime() + core.dueInDays * 86400000);
  const zone = ZONES[assignZone(x)];

  return {
    ...meta,
    inputs: x,
    areaHa,
    method,
    methodLabel: IRRIGATION_METHODS[method].label,
    pumpFlow,
    stage: stage.name,
    expectedNdvi: round(agro.expectedNdvi(age), 3),
    irrigationDate: date.toISOString().slice(0, 10),
    ...core,
    alerts: alertsFor(core),
    lossCurve,
    projection,
    fertigation: fert,
    zone,
    explanation: explain(x),
    advisory: advisoryText(core, { date, method, fert, forecastRain: x.forecast_rain_mm }, lang),
    advisoryEnglish: lang === 'en' ? undefined : advisoryText(core, { date, method, fert, forecastRain: x.forecast_rain_mm }, 'en'),
    lang: i18n.lang(lang),
  };
}

function farmAdvisory(farm, scenario, lang) {
  const x = farmFeatures(farm, scenario);
  return fullAdvisory(x, {
    areaHa: farm.area_ha,
    method: scenario.method,
    pumpFlow: scenario.pumpFlow,
    lang,
    meta: {
      id: farm.id, district: farm.district, taluk: farm.taluk, village: farm.village,
      polygon: farm.polygon, centroid: farm.centroid, quality: farm.quality,
      cropAgeDays: farm.crop_age_days,
    },
  });
}

module.exports = { parseScenario, scenarioKey, farmFeatures, predictCore, summarize, fullAdvisory, farmAdvisory, ZONES };
