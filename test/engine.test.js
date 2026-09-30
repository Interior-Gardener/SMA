const test = require('node:test');
const assert = require('node:assert');
const { loadFarms } = require('../src/data/farms');
const advisory = require('../src/engine/advisory');
const { schedule, buildSlots } = require('../src/engine/scheduler');
const chat = require('../src/engine/chat');
const agro = require('../src/engine/agronomy');

const { farms, quality } = loadFarms();

test('dataset loads 1000 plots with geometry and imputes missing NDVI', () => {
  assert.strictEqual(farms.length, 1000);
  assert.ok(farms.every((f) => Number.isFinite(f.ndvi)));
  assert.strictEqual(quality.missingNdvi, 6);
  assert.ok(farms.every((f) => f.polygon.length > 3 && f.centroid));
});

test('scenario parsing clamps unsafe input', () => {
  const s = advisory.parseScenario({ forecastRain: '9999', tempAnomaly: 'abc', method: 'rocket', pumpFlow: '-5' });
  assert.strictEqual(s.forecastRain, 150);
  assert.strictEqual(s.tempAnomaly, 0);
  assert.strictEqual(s.method, 'furrow');
  assert.strictEqual(s.pumpFlow, 5);
});

test('a dry spell brings irrigation forward and raises stress', () => {
  const f = farms[0];
  const wet = advisory.summarize(f, advisory.parseScenario({}));
  const dry = advisory.summarize(f, advisory.parseScenario({ tempAnomaly: 8, daysSinceObs: 10 }));
  assert.ok(dry.daysToIrrigation < wet.daysToIrrigation);
  assert.ok(dry.stressProbability >= wet.stressProbability);
});

test('forecast rain postpones irrigation (rainfall-adjusted advice)', () => {
  const dry = { tempAnomaly: 8, daysSinceObs: 7 };
  const f = farms.find((x) => advisory.summarize(x, advisory.parseScenario(dry)).dueInDays === 0);
  const rain = advisory.summarize(f, advisory.parseScenario({ ...dry, forecastRain: 40 }));
  assert.strictEqual(rain.status, 'rain_skip');
});

test('drip needs less water than flood for the same plot', () => {
  const f = farms[10];
  const flood = advisory.summarize(f, advisory.parseScenario({ method: 'flood' }));
  const drip = advisory.summarize(f, advisory.parseScenario({ method: 'drip' }));
  assert.ok(drip.weekly.recommendedM3 < flood.weekly.recommendedM3);
});

test('yield-loss curve never decreases with longer delays', () => {
  const adv = advisory.farmAdvisory(farms[3], advisory.parseScenario({ tempAnomaly: 6, daysSinceObs: 5 }), 'en');
  for (let i = 1; i < adv.lossCurve.length; i++) assert.ok(adv.lossCurve[i].lossPct >= adv.lossCurve[i - 1].lossPct);
  assert.ok(adv.advisory.length >= 6);
});

test('advisories are generated in all four languages', () => {
  const scenario = advisory.parseScenario({});
  const texts = ['en', 'kn', 'hi', 'mr'].map((l) => advisory.farmAdvisory(farms[0], scenario, l).advisory[0].text);
  assert.strictEqual(new Set(texts).size, 4);
  assert.match(texts[1], /[ಀ-೿]/);
});

test('scheduler respects feeder capacity and power windows', () => {
  const scenario = advisory.parseScenario({ tempAnomaly: 8, daysSinceObs: 7 });
  const list = farms.filter((f) => f.village === 'Hosur').map((f) => advisory.summarize(f, scenario));
  const windows = [{ start: '06:00', end: '10:00' }, { start: '17:00', end: '20:00' }];
  const plan = schedule(list, { windows, capacity: 5, days: 2 });
  const slots = buildSlots(windows, 2);
  for (const seg of plan.optimised.segments) {
    assert.ok(slots.some(([s, e]) => seg.start >= s && seg.end <= e), 'segment outside power window');
  }
  for (let t = 0; t < 2 * 1440; t += 15) {
    const running = plan.optimised.segments.filter((s) => s.start <= t && s.end > t).length;
    assert.ok(running <= 5, `too many pumps at minute ${t}`);
  }
  assert.ok(plan.optimised.kpi.estimatedLossT <= plan.fcfs.kpi.estimatedLossT);
});

test('chatbot detects language and intent', () => {
  assert.strictEqual(chat.detectLanguage('ನೀರು ಯಾವಾಗ?'), 'kn');
  assert.strictEqual(chat.detectLanguage('पाणी कधी द्यावे?'), 'mr');
  assert.strictEqual(chat.detectLanguage('सिंचाई कब करें?'), 'hi');
  assert.deepStrictEqual(chat.detectIntents('how much urea should I apply'), ['fertigation']);
});

test('fertigation stops nitrogen late in the season', () => {
  const plan = agro.fertigationPlan({ age: 320, oc: 10, ph: 6.5, ndvi: 0.6, areaHa: 1, stressClass: 0 });
  assert.strictEqual(plan.weeklyNutrientsKg.n, 0);
});
