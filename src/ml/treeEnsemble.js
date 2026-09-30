/**
 * Pure-JavaScript inference for scikit-learn tree ensembles exported by
 * ml/train.py. No Python is needed at runtime.
 *
 * scikit-learn casts inputs to float32 before comparing them with split
 * thresholds, so we do the same with Math.fround() - this makes the Node
 * predictions identical to the Python ones (verified in test/models.test.js).
 */
const fs = require('fs');
const path = require('path');

function leafValue(tree, x) {
  let i = 0;
  while (tree.f[i] !== -1) {
    i = Math.fround(x[tree.f[i]]) <= tree.t[i] ? tree.l[i] : tree.r[i];
  }
  return tree.v[i];
}

class TreeEnsemble {
  constructor(spec) {
    this.type = spec.type;
    this.title = spec.title;
    this.features = spec.features;
    this.classes = spec.classes;
    this.trees = spec.trees;
    this.init = spec.init;
    this.learningRate = spec.learning_rate;
  }

  toVector(input) {
    return this.features.map((f) => {
      const v = input[f];
      if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Missing feature "${f}"`);
      return v;
    });
  }

  /** Regression: number. Classification: array of class probabilities. */
  predictVector(x) {
    if (this.type === 'gbr') {
      let sum = 0;
      for (const t of this.trees) sum += leafValue(t, x);
      return this.init + this.learningRate * sum;
    }
    if (this.type === 'rf_regressor') {
      let sum = 0;
      for (const t of this.trees) sum += leafValue(t, x);
      return sum / this.trees.length;
    }
    if (this.type === 'rf_classifier') {
      const p = new Array(this.classes.length).fill(0);
      for (const t of this.trees) {
        const v = leafValue(t, x);
        for (let k = 0; k < p.length; k++) p[k] += v[k];
      }
      return p.map((s) => s / this.trees.length);
    }
    throw new Error(`Unknown model type ${this.type}`);
  }

  predict(input) {
    return this.predictVector(this.toVector(input));
  }

  /** Random-forest regressors also give a spread across trees (uncertainty). */
  predictWithSpread(input) {
    const x = this.toVector(input);
    const values = this.trees.map((t) => leafValue(t, x));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    return { mean, sd };
  }

  get nodeCount() {
    return this.trees.reduce((n, t) => n + t.f.length, 0);
  }
}

function loadModel(dir, name) {
  const spec = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  return new TreeEnsemble(spec);
}

module.exports = { TreeEnsemble, loadModel, leafValue };
