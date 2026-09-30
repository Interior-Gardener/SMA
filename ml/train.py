"""
SMA - model training pipeline.

    python ml/train.py            # trains all models and writes them to models/

Steps
  1. Load and clean the IrrigationAdvisoryDataset (1,000 Mandya sugarcane plots)
  2. Build a seasonal scenario set (each plot x 12 weather / crop-age scenarios)
  3. Label scenarios with the agronomy engine (FAO-56 / FAO-33) + field noise
  4. Train tree-ensemble models, evaluate on held-out *plots* (no leakage)
  5. Compare against linear baselines
  6. Export every model as portable JSON for the Node.js inference engine
"""
import json
import os
import time

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import (GradientBoostingRegressor, RandomForestClassifier,
                              RandomForestRegressor)
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             mean_absolute_error, r2_score)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

import agronomy as ag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "IrrigationAdvisoryDataset.csv")
OUT = os.path.join(ROOT, "models")
SEED = 42
SCENARIOS_PER_FARM = 12

FEATURES = [
    "ndvi", "lai", "soil_moisture", "soil_ph", "organic_carbon",
    "temperature_c", "relative_humidity", "rainfall_mm",
    "crop_age_days", "forecast_rain_mm",
]
FEATURE_LABELS = {
    "ndvi": "NDVI (crop vigour)",
    "lai": "Leaf Area Index",
    "soil_moisture": "Soil moisture",
    "soil_ph": "Soil pH",
    "organic_carbon": "Organic carbon",
    "temperature_c": "Temperature",
    "relative_humidity": "Relative humidity",
    "rainfall_mm": "Seasonal rainfall",
    "crop_age_days": "Crop age",
    "forecast_rain_mm": "Forecast rain (3 days)",
    "delay_days": "Irrigation delay",
}


# ---------------------------------------------------------------------------
# 1. Load & clean
# ---------------------------------------------------------------------------
def load_dataset():
    df = pd.read_csv(DATA)
    df = df.rename(columns={
        "NDVI": "ndvi", "LAI": "lai", "Soil_Moisture": "soil_moisture",
        "Soil_pH": "soil_ph", "Organic_Carbon": "organic_carbon",
        "Temperature_C": "temperature_c", "Relative_Humidity": "relative_humidity",
        "Rainfall_mm": "rainfall_mm",
    })
    missing = int(df["ndvi"].isna().sum())
    df["ndvi"] = df.groupby("Village")["ndvi"].transform(lambda s: s.fillna(s.median()))
    df["ndvi"] = df["ndvi"].fillna(df["ndvi"].median())
    return df, missing


# ---------------------------------------------------------------------------
# 2. Scenario augmentation
# ---------------------------------------------------------------------------
def build_scenarios(df, rng):
    n = len(df) * SCENARIOS_PER_FARM
    base = df.loc[df.index.repeat(SCENARIOS_PER_FARM)].reset_index(drop=True)
    age = rng.uniform(0, 365, n)
    d_temp = rng.uniform(-5, 13, n)
    temp = base["temperature_c"].values + d_temp
    rh = ag.clip(base["relative_humidity"].values - 2.5 * d_temp + rng.normal(0, 5, n), 25, 98)
    near_real = rng.random(n) < 0.3
    sm = np.where(near_real,
                  base["soil_moisture"].values + rng.normal(0, 0.015, n),
                  rng.uniform(0.10, 0.38, n))
    sm = ag.clip(sm, 0.08, 0.42)
    vigour = base["ndvi"].values / 0.58
    ndvi = ag.clip(ag.expected_ndvi(age) * vigour + rng.normal(0, 0.04, n), 0.10, 0.90)
    lai = ag.clip(base["lai"].values * ag.expected_ndvi(age) / 0.6 + rng.normal(0, 0.05, n), 0.10, 1.50)
    forecast = np.where(rng.random(n) < 0.55, 0.0, ag.clip(rng.exponential(15, n), 0, 80))
    return pd.DataFrame({
        "farm_id": base["Farm_ID"].values,
        "ndvi": ndvi,
        "lai": lai,
        "soil_moisture": sm,
        "soil_ph": ag.clip(base["soil_ph"].values + rng.normal(0, 0.1, n), 4.5, 8.5),
        "organic_carbon": ag.clip(base["organic_carbon"].values * (1 + rng.normal(0, 0.05, n)), 2, 25),
        "temperature_c": temp,
        "relative_humidity": rh,
        "rainfall_mm": ag.clip(base["rainfall_mm"].values + rng.normal(0, 40, n), 300, 1000),
        "crop_age_days": age,
        "forecast_rain_mm": forecast,
    })


# ---------------------------------------------------------------------------
# 3. Labels
# ---------------------------------------------------------------------------
def label(s, rng):
    n = len(s)
    etc_true = ag.crop_water_requirement(s.temperature_c, s.relative_humidity, s.crop_age_days, s.ndvi).values
    wb = ag.water_balance(s.soil_moisture.values, s.organic_carbon.values, s.crop_age_days.values, etc_true)
    days = ag.days_to_irrigation(wb, etc_true, s.forecast_rain_mm.values)
    depth = ag.irrigation_depth(wb, days, s.forecast_rain_mm.values)
    stress = ag.stress_score(wb, s.temperature_c.values, s.ndvi.values, s.crop_age_days.values)
    yld = ag.yield_potential(s.soil_ph.values, s.organic_carbon.values, s.ndvi.values,
                             s.crop_age_days.values, s.temperature_c.values, s.rainfall_mm.values, stress)
    disease = ag.disease_risk_score(s.temperature_c.values, s.relative_humidity.values, s.soil_moisture.values,
                                    s.organic_carbon.values, s.forecast_rain_mm.values, s.crop_age_days.values)
    labels = pd.DataFrame({
        "days_to_irrigation": ag.clip(days + rng.normal(0, 0.6, n), 0, 15),
        "water_requirement": etc_true * (1 + rng.normal(0, 0.05, n)),
        "irrigation_depth": ag.clip(depth + rng.normal(0, 3, n), 0, 100),
        "stress_class": ag.stress_class(ag.clip(stress + rng.normal(0, 0.04, n), 0, 1)),
        "yield": yld + rng.normal(0, 4, n),
        "disease_class": ag.disease_class(ag.clip(disease + rng.normal(0, 0.05, n), 0, 1)),
    })
    return labels, wb, etc_true


def yield_loss_set(s, wb, etc, rng, reps=3):
    rows, ys = [], []
    for _ in range(reps):
        delay = rng.uniform(0, 21, len(s))
        loss = ag.yield_loss_from_delay(wb, etc, s.forecast_rain_mm.values, s.crop_age_days.values,
                                        s.temperature_c.values, delay)
        loss = ag.clip(loss * (1 + rng.normal(0, 0.08, len(s))) + rng.normal(0, 0.1, len(s)), 0, 60)
        x = s[FEATURES].copy()
        x["delay_days"] = delay
        x["farm_id"] = s["farm_id"].values
        rows.append(x)
        ys.append(loss)
    return pd.concat(rows, ignore_index=True), np.concatenate(ys)


# ---------------------------------------------------------------------------
# 6. Export helpers
# ---------------------------------------------------------------------------
def _num(x, digits=9):
    return float(f"{x:.{digits}g}")


def export_tree(tree, leaf_fn):
    t = tree.tree_
    node = {"f": [], "t": [], "l": [], "r": [], "v": []}
    for i in range(t.node_count):
        leaf = t.children_left[i] == -1
        node["f"].append(-1 if leaf else int(t.feature[i]))
        node["t"].append(0 if leaf else _num(t.threshold[i]))
        node["l"].append(int(t.children_left[i]))
        node["r"].append(int(t.children_right[i]))
        node["v"].append(leaf_fn(t.value[i]) if leaf else 0)
    return node


def export_rf_regressor(model, features):
    return {"type": "rf_regressor", "features": features,
            "trees": [export_tree(e, lambda v: _num(v[0][0], 7)) for e in model.estimators_]}


def export_rf_classifier(model, features, classes):
    def leaf(v):
        p = v[0] / v[0].sum()
        return [_num(x, 6) for x in p]
    return {"type": "rf_classifier", "features": features, "classes": classes,
            "trees": [export_tree(e, leaf) for e in model.estimators_]}


def export_gbr(model, features, X_sample):
    trees = [export_tree(e[0], lambda v: _num(v[0][0], 9)) for e in model.estimators_]
    raw = sum(e[0].predict(X_sample[:1])[0] for e in model.estimators_)
    init = float(model.predict(X_sample[:1])[0] - model.learning_rate * raw)
    return {"type": "gbr", "features": features, "init": init,
            "learning_rate": model.learning_rate, "trees": trees}


def save(name, obj):
    path = os.path.join(OUT, f"{name}.json")
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    return os.path.getsize(path)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def regression_metrics(y, p):
    return {"r2": round(r2_score(y, p), 4), "mae": round(mean_absolute_error(y, p), 4)}


def importance(model, features):
    return sorted(
        [{"feature": f, "label": FEATURE_LABELS[f], "importance": round(float(v), 4)}
         for f, v in zip(features, model.feature_importances_)],
        key=lambda d: -d["importance"])


def main():
    t0 = time.time()
    rng = np.random.default_rng(SEED)
    os.makedirs(OUT, exist_ok=True)

    df, missing_ndvi = load_dataset()
    scen = build_scenarios(df, rng)
    labels, wb, etc = label(scen, rng)
    X = scen[FEATURES].values
    groups = scen["farm_id"].values

    split = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    tr, te = next(split.split(X, groups=groups))
    print(f"Scenarios: {len(scen)}  train={len(tr)} test={len(te)} (split by plot)")

    metrics = {"models": {}}
    exported = {}

    # --- Regressors --------------------------------------------------------
    reg_specs = {
        "next_irrigation": ("days_to_irrigation", "Next Irrigation (days)",
                            RandomForestRegressor(n_estimators=40, max_depth=12, min_samples_leaf=8,
                                                  random_state=SEED, n_jobs=-1), "rf"),
        "water_requirement": ("water_requirement", "Crop Water Requirement (mm/day)",
                              GradientBoostingRegressor(n_estimators=200, max_depth=4, learning_rate=0.05,
                                                        random_state=SEED), "gbr"),
        "irrigation_depth": ("irrigation_depth", "Irrigation Depth (mm)",
                             GradientBoostingRegressor(n_estimators=250, max_depth=4, learning_rate=0.05,
                                                       random_state=SEED), "gbr"),
        "yield": ("yield", "Cane Yield (t/ha)",
                  GradientBoostingRegressor(n_estimators=250, max_depth=4, learning_rate=0.05,
                                            random_state=SEED), "gbr"),
    }
    for name, (target, title, model, kind) in reg_specs.items():
        y = labels[target].values
        model.fit(X[tr], y[tr])
        pred = model.predict(X[te])
        base = LinearRegression().fit(X[tr], y[tr]).predict(X[te])
        metrics["models"][name] = {
            "title": title, "task": "regression",
            "algorithm": "Random Forest" if kind == "rf" else "Gradient Boosting",
            "test": regression_metrics(y[te], pred),
            "baseline": {"algorithm": "Linear Regression", **regression_metrics(y[te], base)},
            "importance": importance(model, FEATURES),
            "sample": [{"actual": round(float(a), 3), "predicted": round(float(p), 3)}
                       for a, p in zip(y[te][:300], pred[:300])],
        }
        exported[name] = (export_rf_regressor(model, FEATURES) if kind == "rf"
                          else export_gbr(model, FEATURES, X[tr]))
        exported[name]["title"] = title
        print(f"  {name:18s} R2={metrics['models'][name]['test']['r2']:.3f} "
              f"MAE={metrics['models'][name]['test']['mae']:.3f} "
              f"(linear R2={metrics['models'][name]['baseline']['r2']:.3f})")

    # --- Classifiers -------------------------------------------------------
    clf_specs = {
        "water_stress": ("stress_class", "Water Stress Probability", ag.STRESS_CLASSES,
                         RandomForestClassifier(n_estimators=40, max_depth=12, min_samples_leaf=5,
                                                random_state=SEED, n_jobs=-1)),
        "disease_risk": ("disease_class", "Disease & Pest Risk", ag.DISEASE_CLASSES,
                         RandomForestClassifier(n_estimators=30, max_depth=10, min_samples_leaf=5,
                                                random_state=SEED, n_jobs=-1)),
    }
    for name, (target, title, classes, model) in clf_specs.items():
        y = labels[target].values
        model.fit(X[tr], y[tr])
        pred = model.predict(X[te])
        base = LogisticRegression(max_iter=2000).fit(
            StandardScaler().fit(X[tr]).transform(X[tr]), y[tr])
        base_pred = base.predict(StandardScaler().fit(X[tr]).transform(X[te]))
        metrics["models"][name] = {
            "title": title, "task": "classification", "algorithm": "Random Forest",
            "classes": classes,
            "test": {"accuracy": round(accuracy_score(y[te], pred), 4),
                     "f1_macro": round(f1_score(y[te], pred, average="macro"), 4)},
            "baseline": {"algorithm": "Logistic Regression",
                         "accuracy": round(accuracy_score(y[te], base_pred), 4),
                         "f1_macro": round(f1_score(y[te], base_pred, average="macro"), 4)},
            "confusion_matrix": confusion_matrix(y[te], pred, labels=list(range(len(classes)))).tolist(),
            "class_distribution": np.bincount(y, minlength=len(classes)).tolist(),
            "importance": importance(model, FEATURES),
        }
        exported[name] = export_rf_classifier(model, FEATURES, classes)
        exported[name]["title"] = title
        print(f"  {name:18s} acc={metrics['models'][name]['test']['accuracy']:.3f} "
              f"F1={metrics['models'][name]['test']['f1_macro']:.3f} "
              f"(logistic acc={metrics['models'][name]['baseline']['accuracy']:.3f})")

    # --- Yield loss due to delayed irrigation ------------------------------
    XL, yl = yield_loss_set(scen, wb, etc, rng)
    loss_features = FEATURES + ["delay_days"]
    train_farms = set(groups[tr])
    mtr = XL["farm_id"].isin(train_farms).values
    model = GradientBoostingRegressor(n_estimators=300, max_depth=5, learning_rate=0.05, random_state=SEED)
    xl = XL[loss_features].values
    model.fit(xl[mtr], yl[mtr])
    pred = model.predict(xl[~mtr])
    base = LinearRegression().fit(xl[mtr], yl[mtr]).predict(xl[~mtr])
    metrics["models"]["yield_loss"] = {
        "title": "Yield Loss from Delayed Irrigation (%)", "task": "regression",
        "algorithm": "Gradient Boosting",
        "test": regression_metrics(yl[~mtr], pred),
        "baseline": {"algorithm": "Linear Regression", **regression_metrics(yl[~mtr], base)},
        "importance": importance(model, loss_features),
        "sample": [{"actual": round(float(a), 3), "predicted": round(float(p), 3)}
                   for a, p in zip(yl[~mtr][:300], pred[:300])],
    }
    exported["yield_loss"] = export_gbr(model, loss_features, xl[mtr])
    exported["yield_loss"]["title"] = "Yield Loss from Delayed Irrigation (%)"
    print(f"  {'yield_loss':18s} R2={metrics['models']['yield_loss']['test']['r2']:.3f} "
          f"MAE={metrics['models']['yield_loss']['test']['mae']:.3f}")

    # --- Management zones (unsupervised, on the real plots) ----------------
    zone_features = ["ndvi", "lai", "soil_moisture", "soil_ph", "organic_carbon",
                     "rainfall_mm", "temperature_c", "relative_humidity"]
    scaler = StandardScaler().fit(df[zone_features].values)
    Z = scaler.transform(df[zone_features].values)
    km = KMeans(n_clusters=4, n_init=20, random_state=SEED).fit(Z)
    centroids_raw = scaler.inverse_transform(km.cluster_centers_)
    exported["zones"] = {
        "type": "kmeans", "features": zone_features,
        "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
        "centroids": km.cluster_centers_.tolist(),
        "centroids_raw": centroids_raw.tolist(),
        "sizes": np.bincount(km.labels_).tolist(),
        "inertia": float(km.inertia_),
    }

    # --- Save --------------------------------------------------------------
    sizes = {name: save(name, obj) for name, obj in exported.items()}

    # Fixtures that let the Node test-suite verify bit-exact inference.
    fx_rows = X[te][:40]
    fixtures = {"features": FEATURES, "rows": fx_rows.tolist(), "expected": {}}
    for name in ["next_irrigation", "water_requirement", "irrigation_depth", "yield"]:
        mdl = reg_specs[name][2]
        fixtures["expected"][name] = mdl.predict(fx_rows).tolist()
    for name in ["water_stress", "disease_risk"]:
        mdl = clf_specs[name][3]
        fixtures["expected"][name] = mdl.predict_proba(fx_rows).tolist()
    fixtures["loss_rows"] = xl[~mtr][:40].tolist()
    fixtures["expected"]["yield_loss"] = model.predict(xl[~mtr][:40]).tolist()
    with open(os.path.join(OUT, "test_fixtures.json"), "w") as f:
        json.dump(fixtures, f)

    metrics["dataset"] = {
        "plots": int(len(df)),
        "district": df["District"].iloc[0],
        "taluks": int(df["Taluk"].nunique()),
        "villages": int(df["Village"].nunique()),
        "missing_ndvi_imputed": missing_ndvi,
        "scenarios": int(len(scen)),
        "scenarios_per_plot": SCENARIOS_PER_FARM,
        "train_rows": int(len(tr)), "test_rows": int(len(te)),
        "yield_loss_rows": int(len(XL)),
        "split": "GroupShuffleSplit by plot (80/20) - test plots never seen in training",
    }
    metrics["features"] = [{"key": f, "label": FEATURE_LABELS[f]} for f in FEATURES]
    metrics["model_sizes_bytes"] = sizes
    metrics["trained_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    metrics["training_seconds"] = round(time.time() - t0, 1)
    with open(os.path.join(OUT, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=1)
    print(f"Done in {metrics['training_seconds']}s. Sizes (KB): "
          + ", ".join(f"{k}={v // 1024}" for k, v in sizes.items()))


if __name__ == "__main__":
    main()
