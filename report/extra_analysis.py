"""
Additional analysis for the report (Chapter 7):
  * per-taluk performance on held-out plots (fairness across regions)
  * learning curve of the next-irrigation model vs number of training plots
  * coverage of the Random-Forest uncertainty band (±1 and ±2 tree std-dev)

    python3 report/extra_analysis.py
Uses exactly the same data preparation, labels and split as ml/train.py.
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import GroupShuffleSplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ml"))
import train as T  # noqa: E402

rng = np.random.default_rng(T.SEED)
df, _ = T.load_dataset()
scen = T.build_scenarios(df, rng)
labels, _, _ = T.label(scen, rng)
X = scen[T.FEATURES].values
groups = scen["farm_id"].values
tr, te = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=T.SEED).split(X, groups=groups))
taluk_of = dict(zip(df["Farm_ID"], df["Taluk"]))
taluk = np.array([taluk_of[g] for g in groups])

y_days = labels["days_to_irrigation"].values
y_stress = labels["stress_class"].values
rf = RandomForestRegressor(n_estimators=40, max_depth=12, min_samples_leaf=8, random_state=T.SEED, n_jobs=-1).fit(X[tr], y_days[tr])
clf = RandomForestClassifier(n_estimators=40, max_depth=12, min_samples_leaf=5, random_state=T.SEED, n_jobs=-1).fit(X[tr], y_stress[tr])
pd_ = rf.predict(X[te])
ps = clf.predict(X[te])

out = {"per_taluk": [], "learning_curve": [], "coverage": {}}
for t in sorted(set(taluk[te])):
    m = taluk[te] == t
    out["per_taluk"].append({
        "taluk": t, "test_plots": int(len(set(groups[te][m]))), "rows": int(m.sum()),
        "mae_days": round(float(mean_absolute_error(y_days[te][m], pd_[m])), 3),
        "r2_days": round(float(r2_score(y_days[te][m], pd_[m])), 3),
        "stress_acc": round(float(accuracy_score(y_stress[te][m], ps[m])), 3),
    })
print(json.dumps(out["per_taluk"], indent=1))

# uncertainty coverage
per_tree = np.stack([e.predict(X[te]) for e in rf.estimators_])
sd = per_tree.std(axis=0)
err = np.abs(y_days[te] - pd_)
out["coverage"] = {
    "within_1sd": round(float((err <= sd).mean()), 3),
    "within_2sd": round(float((err <= 2 * sd).mean()), 3),
    "within_1day": round(float((err <= 1).mean()), 3),
    "mean_sd": round(float(sd.mean()), 3),
}
print(out["coverage"])

# learning curve (fraction of training plots)
train_plots = np.array(sorted(set(groups[tr])))
for frac in [0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1.0]:
    r = np.random.default_rng(1)
    keep = set(r.choice(train_plots, size=max(5, int(len(train_plots) * frac)), replace=False))
    idx = np.array([i for i in tr if groups[i] in keep])
    m = RandomForestRegressor(n_estimators=40, max_depth=12, min_samples_leaf=8, random_state=T.SEED, n_jobs=-1).fit(X[idx], y_days[idx])
    p = m.predict(X[te])
    out["learning_curve"].append({"plots": len(keep), "rows": int(len(idx)), "r2": round(float(r2_score(y_days[te], p)), 4), "mae": round(float(mean_absolute_error(y_days[te], p)), 4)})
    print(out["learning_curve"][-1])

json.dump(out, open(os.path.join(ROOT, "report", "data", "extra.json"), "w"), indent=1)

plt.rcParams.update({"font.family": "serif", "font.serif": ["Liberation Serif", "DejaVu Serif"], "font.size": 11,
                     "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": "#e3e5df",
                     "savefig.dpi": 220, "savefig.bbox": "tight"})
lc = out["learning_curve"]
fig, a1 = plt.subplots(figsize=(8, 4))
a1.plot([x["plots"] for x in lc], [x["r2"] for x in lc], marker="o", color="#2a78d6", lw=2.2, label="R²")
a1.set_xlabel("Number of training plots (× 12 scenarios each)")
a1.set_ylabel("R² on held-out plots", color="#2a78d6")
a2 = a1.twinx()
a2.plot([x["plots"] for x in lc], [x["mae"] for x in lc], marker="s", color="#eb6834", lw=2.2, ls="--", label="MAE (days)")
a2.set_ylabel("MAE (days)", color="#eb6834")
a2.grid(False)
a1.set_title("Learning curve of the next-irrigation model")
fig.legend(loc="center right", bbox_to_anchor=(0.88, 0.5))
fig.savefig(os.path.join(ROOT, "report", "figures", "fig_learning_curve.png"))
print("saved fig_learning_curve.png")
