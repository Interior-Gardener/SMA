// Verifies that the Node.js inference engine reproduces scikit-learn's
// predictions exactly (fixtures are written by ml/train.py).
const test = require('node:test');
const assert = require('node:assert');
const fixtures = require('../models/test_fixtures.json');
const { models } = require('../src/ml/registry');

for (const name of ['next_irrigation', 'water_requirement', 'irrigation_depth', 'yield']) {
  test(`${name}: JS inference matches Python`, () => {
    fixtures.rows.forEach((row, i) => {
      const got = models[name].predictVector(row);
      assert.ok(Math.abs(got - fixtures.expected[name][i]) < 1e-4, `row ${i}: ${got} vs ${fixtures.expected[name][i]}`);
    });
  });
}

for (const name of ['water_stress', 'disease_risk']) {
  test(`${name}: class probabilities match Python`, () => {
    fixtures.rows.forEach((row, i) => {
      const got = models[name].predictVector(row);
      got.forEach((p, k) => assert.ok(Math.abs(p - fixtures.expected[name][i][k]) < 1e-4, `row ${i} class ${k}`));
      assert.ok(Math.abs(got.reduce((a, b) => a + b, 0) - 1) < 1e-4);
    });
  });
}

test('yield_loss: JS inference matches Python', () => {
  fixtures.loss_rows.forEach((row, i) => {
    const got = models.yield_loss.predictVector(row);
    assert.ok(Math.abs(got - fixtures.expected.yield_loss[i]) < 1e-4, `row ${i}`);
  });
});

test('feature order in exported models matches fixtures', () => {
  assert.deepStrictEqual(models.next_irrigation.features, fixtures.features);
});
