# Methodology

This document explains how SMA turns the IrrigationAdvisoryDataset into predictions and advice. It covers the data, the agronomic labelling, the models, the decision engine and the evaluation.

## 1. Data

`data/IrrigationAdvisoryDataset.csv`: 1,000 sugarcane plots in **Mandya district, Karnataka** (6 taluks, 10 villages), sampled on ESA WorldCover cropland.

| Column | Use |
|---|---|
| NDVI, LAI | Crop vigour / canopy (satellite) |
| Soil_Moisture | Volumetric soil moisture (m³/m³, satellite) |
| Soil_pH, Organic_Carbon | Soil properties (organic carbon in g/kg) |
| Rainfall_mm, Temperature_C, Relative_Humidity | Seasonal climate |
| Taluk, Village, Farm_ID | Location / identity |
| .geo | GeoJSON polygon of the plot |
| Farm_Area_ha, District, Sampling_Method | Constant, so not used as model inputs |

**Data audit and cleaning** (`ml/train.py`, `src/data/farms.js`)
- 6 missing NDVI values (cloud) → imputed with the **village median**.
- Constant columns were detected and excluded from the models.
- Temperature, humidity and rainfall are strongly correlated (|r| up to 0.94). Trees handle this, but it is why explanations compare against the regional median.
- **Noisy-sensor flags**: a robust modified z-score (Iglewicz & Hoaglin) *within each village*. When the MAD is 0, the mean absolute deviation is used instead. Flags appear on the plot's advisory.
- **Crop age** is not in the dataset. Each plot gets a stable estimate (20-350 days, derived from a hash of its ID), which can be overridden in the UI. In production, it comes from STEPS planting records.

## 2. Why agronomy-generated labels

The dataset contains **no target variables**: no irrigation dates, no volumes, no yields. Supervised learning needs labels, so we generate them with established crop science. This is called *physics-informed* or *knowledge-guided* machine learning:

1. **Scenario augmentation**: each real plot is expanded into 12 scenarios (12,000 rows):
   - crop age ~ U(0, 365) days
   - temperature = observed + U(-5, +13) °C; humidity falls as temperature rises (plus noise)
   - soil moisture: 30% near the observed value, 70% U(0.10, 0.38) to cover dry and wet states
   - NDVI and LAI follow a sugarcane phenology curve scaled by the plot's observed vigour
   - forecast rain: 55% zero, otherwise exponential (mean 15 mm, max 80)
2. **Labelling with FAO standards** (`ml/agronomy.py`):
   - **Reference ET** (Hargreaves-Samani): `ET0 = 0.0023 · Ra · (T + 17.8) · √ΔT`, where ΔT (diurnal range) decreases with humidity and Ra = 14.5 mm/day for latitude ~12.5° N.
   - **Crop coefficient**: blend of the FAO-56 sugarcane Kc curve (0.45 → 1.25 → 0.75) and an NDVI-based Kc (`1.5·NDVI + 0.05`).
   - **ETc = Kc · ET0**
   - **Soil water**: FC = 0.27 + 0.003·OC, PWP = 0.12 + 0.0015·OC; root depth grows 0.3 → 1.2 m over 150 days; `TAW = 1000·(FC-PWP)·Zr`; depletion `Dr = 1000·(FC-SM)·Zr`; `RAW = p·TAW`, with `p = 0.65 + 0.04·(5 - ETc)`.
   - **Effective rain** = 0.8 · (forecast - 3 mm).
   - **Days to irrigation** = `(RAW - Dr + Peff) / ETc`, clipped to 0-15.
   - **Irrigation depth** = depletion on the irrigation day (≤ 100 mm).
   - **Water stress score** = water-stress coefficient Ks (FAO-56) + heat + NDVI deficit + closeness to RAW → 4 classes.
   - **Yield** = 125 t/ha × pH, organic-carbon, vigour, temperature and rainfall factors × (1 - 0.25·stress).
   - **Yield loss from delay**: daily simulation of depletion over the delay, integrating FAO-33 `1 - Ya/Ym = Ky(1 - ETa/ETc)` with Ky = 1.2, stage sensitivity and heat.
   - **Disease risk**: fungal risk (humidity × temperature optimum, wet soil, rain) and shoot-borer risk (hot, dry, young crop) → 3 classes.
3. **Noise** is added to every label (e.g. ±0.6 days, ±5% ETc, ±4 t/ha). This reflects field variability, so the models cannot simply memorise the formulas.

When real field labels become available, replace the labelling step. Training, export, serving and the UI stay unchanged.

## 3. Models

| Model | Target | Algorithm | Why |
|---|---|---|---|
| `next_irrigation` | days to irrigation | Random Forest (40 trees, depth 12) | Tree spread gives an uncertainty estimate |
| `water_requirement` | ETc mm/day | Gradient Boosting (200 × depth 4) | Smooth, accurate regression |
| `irrigation_depth` | net depth mm | Gradient Boosting (250 × depth 4) | Strongly non-linear (capped refill) |
| `yield` | t/ha | Gradient Boosting (250 × depth 4) | Multiplicative factor interactions |
| `yield_loss` | % loss for a given delay | Gradient Boosting (300 × depth 5) | Delay is an input, so there is one model for the whole curve |
| `water_stress` | 4 classes | Random Forest classifier | Calibrated-ish class probabilities |
| `disease_risk` | 3 classes | Random Forest classifier | Handles threshold effects |
| `zones` | cluster | K-Means (k = 4) on standardised observed features | Unsupervised management zones |

**Class decision rule**: for ordered classes we report the **ordinal median**, the first class at which cumulative probability reaches 50%. If P(moderate or worse) = 52%, the advisory says "Moderate". This is safer for farmers than argmax.

**Evaluation**: `GroupShuffleSplit` by plot (80/20). All scenarios of a test plot are unseen during training. Each model is compared with a linear or logistic baseline. Metrics are written to `models/metrics.json`.

**Export & serving**: every tree (feature, threshold, children, leaf value) is exported to JSON. `src/ml/treeEnsemble.js` walks the trees in JavaScript, casting inputs to float32 exactly as scikit-learn does. `test/models.test.js` asserts parity with Python predictions on 40 held-out rows per model.

## 4. Decision engine (`src/engine`)

- **Scenario handling**: temperature and humidity anomalies are applied to each plot. `daysSinceObs` dry days deplete the root zone by `ETc × days / (1000·Zr)`, which is FAO-56 bookkeeping between sensor readings.
- **Rain adjustment**: the next-irrigation model is run with and without the forecast. If rain moves an irrigation due within 2 days to later, the status becomes `rain_skip`.
- **Hydraulics**: gross depth = net / efficiency (flood 0.55, furrow 0.65, sprinkler 0.75, drip 0.90). Volume = gross mm × area × 10 m³. Hours = volume / pump flow. For drip, SMA also gives a daily run time (ETc-based).
- **Savings baseline**: fixed practice of 70 mm gross every 8 days (`src/config.js`). Weekly SMA water = (7·ETc - effective rain) / efficiency. Energy uses a 5 HP (3.73 kW) pump.
- **Fertigation**: 250:100:125 kg NPK/ha split by stage (germination 10/25/10%, tillering 40/45/30%, early grand growth 50/30/45%, late grand growth K only, none at maturity). N is -10% if OC > 7.5 g/kg and +25% if OC < 5. Nutrients are converted to 12-61-0, urea and MOP. Notes cover pH, low vigour, stress and the no-N-after-8-months rule.
- **Explanations**: each feature is replaced with the regional median and the prediction is re-run. The difference is that feature's effect.
- **Pump scheduling**: Weighted Shortest Processing Time list scheduling on *C* parallel feeder lanes inside the power windows, with pre-emption at window ends. Weight = urgency × (tonnes at risk + 0.5 × stress probability). It is compared with a first-come rotation on estimated cane loss, plots completed, and finish time of high-stress plots.

## 5. Responsible AI

- Anonymised plot IDs only; the feedback log stores the plot ID, role, decision and optional reason.
- Probabilities and uncertainty are always shown; "why" explanations; model limitations are stated in the UI.
- Human-in-the-loop accept / override, with logs for retraining.
- All API inputs are validated and clamped to physical ranges.
