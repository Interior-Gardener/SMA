/**
 * Region-level analytics for the dashboard and the insights page.
 */
const { ZONES } = require('./advisory');

const RAW_FEATURES = [
  ['ndvi', 'NDVI'],
  ['lai', 'LAI'],
  ['soil_moisture', 'Soil moist.'],
  ['soil_ph', 'Soil pH'],
  ['organic_carbon', 'Org. C'],
  ['rainfall_mm', 'Rainfall'],
  ['temperature_c', 'Temp.'],
  ['relative_humidity', 'Humidity'],
];

const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);
const avg = (arr, fn) => (arr.length ? sum(arr, fn) / arr.length : 0);
const r = (x, d = 2) => +Number(x).toFixed(d);

function pearson(a, b) {
  const ma = avg(a, (x) => x);
  const mb = avg(b, (x) => x);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

function histogram(values, bins, lo, hi) {
  const step = (hi - lo) / bins;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)));
    counts[i] += 1;
  }
  return counts.map((c, i) => ({ from: r(lo + i * step, 4), to: r(lo + (i + 1) * step, 4), count: c }));
}

function groupStats(summaries, key) {
  const groups = {};
  for (const s of summaries) (groups[s[key]] ||= []).push(s);
  return Object.entries(groups)
    .map(([name, g]) => ({
      name,
      plots: g.length,
      avgNdvi: r(avg(g, (x) => x.ndvi), 3),
      avgSoilMoisture: r(avg(g, (x) => x.soilMoisture), 4),
      avgWaterRequirement: r(avg(g, (x) => x.waterRequirementMm), 2),
      dueIn2Days: g.filter((x) => x.dueInDays <= 2 && x.status !== 'rain_skip').length,
      stressedPct: r((100 * g.filter((x) => x.stressClass >= 2).length) / g.length, 1),
      weeklyWaterM3: Math.round(sum(g, (x) => x.weekly.recommendedM3)),
      weeklySavedM3: Math.round(sum(g, (x) => x.weekly.savedM3)),
      avgYield: r(avg(g, (x) => x.yieldTHa), 1),
      tonnesAtRisk: r(sum(g, (x) => x.tonnesAtRisk), 1),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildInsights(summaries, farms, quality, scenario) {
  const n = summaries.length;
  const weeklyRec = sum(summaries, (s) => s.weekly.recommendedM3);
  const weeklyConv = sum(summaries, (s) => s.weekly.conventionalM3);
  const saved = sum(summaries, (s) => s.weekly.savedM3);

  const calendar = Array.from({ length: 15 }, (_, d) => {
    const due = summaries.filter((s) => s.dueInDays === d && !(d <= 2 && s.status === 'rain_skip'));
    return { day: d, plots: due.length, volumeM3: Math.round(sum(due, (s) => s.volumeM3)) };
  });

  const correlation = RAW_FEATURES.map(([a]) => RAW_FEATURES.map(([b]) => r(pearson(farms.map((f) => f[a]), farms.map((f) => f[b])), 2)));

  const zoneCounts = new Array(ZONES.length).fill(0);
  summaries.forEach((s) => { zoneCounts[s.zone] += 1; });

  const stageCounts = {};
  summaries.forEach((s) => { stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1; });

  return {
    scenario,
    kpi: {
      plots: n,
      taluks: new Set(summaries.map((s) => s.taluk)).size,
      villages: new Set(summaries.map((s) => s.village)).size,
      areaHa: r(sum(summaries, (s) => s.areaHa), 1),
      dueToday: summaries.filter((s) => s.status === 'today').length,
      dueTomorrow: summaries.filter((s) => s.status === 'tomorrow').length,
      dueThisWeek: summaries.filter((s) => s.dueInDays <= 7 && s.status !== 'rain_skip').length,
      rainSkips: summaries.filter((s) => s.status === 'rain_skip').length,
      severeStress: summaries.filter((s) => s.stressClass === 3).length,
      moderateOrWorse: summaries.filter((s) => s.stressClass >= 2).length,
      highDiseaseRisk: summaries.filter((s) => s.riskClass === 2).length,
      avgWaterRequirementMm: r(avg(summaries, (s) => s.waterRequirementMm), 2),
      weeklyWaterM3: Math.round(weeklyRec),
      weeklyConventionalM3: Math.round(weeklyConv),
      weeklySavedM3: Math.round(saved),
      weeklySavedPct: weeklyConv ? r((100 * saved) / weeklyConv, 1) : 0,
      weeklySavedKwh: Math.round(sum(summaries, (s) => s.weekly.savedKwh)),
      weeklySavedRs: Math.round(sum(summaries, (s) => s.weekly.savedRs)),
      rainSavedM3: Math.round(sum(summaries, (s) => s.weekly.rainSavedM3)),
      avgYieldTHa: r(avg(summaries, (s) => s.yieldTHa), 1),
      totalCaneT: Math.round(sum(summaries, (s) => s.yieldTotalT)),
      tonnesAtRisk: r(sum(summaries, (s) => s.tonnesAtRisk), 1),
    },
    stressDistribution: [0, 1, 2, 3].map((k) => summaries.filter((s) => s.stressClass === k).length),
    riskDistribution: [0, 1, 2].map((k) => summaries.filter((s) => s.riskClass === k).length),
    calendar,
    byTaluk: groupStats(summaries, 'taluk'),
    byVillage: groupStats(summaries, 'village'),
    correlation: { labels: RAW_FEATURES.map(([, l]) => l), matrix: correlation },
    histograms: {
      ndvi: histogram(farms.map((f) => f.ndvi), 12, 0.25, 0.8),
      daysToIrrigation: histogram(summaries.map((s) => s.daysToIrrigation), 15, 0, 15),
    },
    stages: stageCounts,
    zones: ZONES.map((z, i) => ({ ...z, currentCount: zoneCounts[i] })),
    quality,
  };
}

module.exports = { buildInsights, pearson };
