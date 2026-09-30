const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

let server;
let base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

const get = async (p) => (await fetch(base + p)).json();
const post = async (p, body) => {
  const res = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

test('GET /health', async () => {
  const d = await get('/health');
  assert.strictEqual(d.status, 'ok');
  assert.strictEqual(d.plots, 1000);
});

test('GET /farms and /farms/:id', async () => {
  const list = await get('/farms?taluk=Maddur');
  assert.ok(list.count > 0 && list.farms.every((f) => f.taluk === 'Maddur'));
  const one = await get(`/farms/${list.farms[0].id}?lang=hi`);
  assert.strictEqual(one.id, list.farms[0].id);
  assert.strictEqual(one.lang, 'hi');
  const res = await fetch(`${base}/farms/NOPE-1`);
  assert.strictEqual(res.status, 404);
});

test('POST /predict validates and predicts', async () => {
  const ok = await post('/predict', { soil_moisture: 0.14, temperature_c: 34, crop_age_days: 200 });
  assert.strictEqual(ok.status, 200);
  assert.ok(ok.body.daysToIrrigation < 3);
  const bad = await post('/predict', { soil_moisture: 'wet' });
  assert.strictEqual(bad.status, 400);
});

test('GET /insights and /models', async () => {
  const ins = await get('/insights?daysSinceObs=5');
  assert.strictEqual(ins.kpi.plots, 1000);
  assert.strictEqual(ins.stressDistribution.reduce((a, b) => a + b, 0), 1000);
  const m = await get('/models');
  assert.ok(m.models.next_irrigation.test.r2 > 0.9);
});

test('POST /schedule and /chat', async () => {
  const s = await post('/schedule', { village: 'Hosur', tempAnomaly: 8, daysSinceObs: 7 });
  assert.ok(s.body.jobs > 0);
  const c = await post('/chat', { message: 'When should I irrigate MM-MD-0110?' });
  assert.strictEqual(c.body.farmId, 'MM-MD-0110');
});
