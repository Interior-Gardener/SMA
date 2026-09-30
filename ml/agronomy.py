"""
Agronomy knowledge engine used to generate training labels.

The IrrigationAdvisoryDataset contains satellite / soil / climate features for
1,000 sugarcane plots but no ground-truth labels (no irrigation logs, no yield
records). To bootstrap supervised models we derive labels from well-established
agronomic science (FAO-56 crop water balance, FAO-33 yield response to water)
and then add field-realistic noise. When real KIAAR / GBL field labels become
available, the same training pipeline can be re-run on them unchanged.

All functions are vectorised over numpy arrays.
"""
import numpy as np

# ---------------------------------------------------------------------------
# Constants (documented in docs/METHODOLOGY.md)
# ---------------------------------------------------------------------------
RA_MANDYA = 14.5          # mean extraterrestrial radiation, mm/day equivalent (lat ~12.5 N)
KY_SUGARCANE = 1.2        # FAO-33 yield response factor for sugarcane
Y_MAX = 125.0             # attainable cane yield in Mandya, t/ha
SEASON_DAYS = 365         # plant crop duration (12 months)


def clip(x, lo, hi):
    return np.minimum(np.maximum(x, lo), hi)


# ---------------------------------------------------------------------------
# Climate -> reference evapotranspiration
# ---------------------------------------------------------------------------
def diurnal_range(rh):
    """Humid air -> smaller day/night temperature range (empirical)."""
    return clip(16.0 - 0.12 * rh, 4.0, 14.0)


def et0_hargreaves(temp_c, rh):
    """Hargreaves-Samani reference ET (mm/day)."""
    return 0.0023 * RA_MANDYA * (temp_c + 17.8) * np.sqrt(diurnal_range(rh))


# ---------------------------------------------------------------------------
# Crop development
# ---------------------------------------------------------------------------
def kc_stage(age):
    """FAO-56 crop coefficient curve for a 12-month sugarcane plant crop."""
    age = np.asarray(age, dtype=float)
    kc = np.where(age < 45, 0.45, 0.0)
    kc = np.where((age >= 45) & (age < 130), 0.45 + (age - 45) / 85 * 0.80, kc)
    kc = np.where((age >= 130) & (age < 290), 1.25, kc)
    kc = np.where(age >= 290, 1.25 - clip((age - 290) / 75, 0, 1) * 0.50, kc)
    return kc


def expected_ndvi(age):
    """Typical NDVI trajectory of a healthy plot at this satellite scale."""
    age = np.asarray(age, dtype=float)
    rise = 0.30 + 0.38 * clip((age - 20) / 130, 0, 1)
    decline = clip((age - 290) / 75, 0, 1) * 0.10
    return rise - decline


def growth_stage(age):
    age = np.asarray(age, dtype=float)
    return np.select(
        [age < 45, age < 130, age < 290],
        ["Germination", "Tillering", "Grand growth"],
        default="Maturity",
    )


def stage_sensitivity(age):
    """Relative sensitivity of yield to water stress by stage."""
    age = np.asarray(age, dtype=float)
    return np.select([age < 45, age < 130, age < 290], [0.8, 1.2, 1.5], default=0.5)


def crop_coefficient(age, ndvi):
    kc_ndvi = clip(1.5 * ndvi + 0.05, 0.35, 1.30)
    return 0.6 * kc_stage(age) + 0.4 * kc_ndvi


def crop_water_requirement(temp_c, rh, age, ndvi):
    """ETc in mm/day."""
    return crop_coefficient(age, ndvi) * et0_hargreaves(temp_c, rh)


# ---------------------------------------------------------------------------
# Soil water balance
# ---------------------------------------------------------------------------
def soil_hydraulics(oc):
    """Field capacity & wilting point (m3/m3) - organic carbon raises water holding."""
    fc = 0.27 + 0.003 * clip(oc, 0, 25)
    pwp = 0.12 + 0.0015 * clip(oc, 0, 25)
    return fc, pwp


def root_depth(age):
    return 0.3 + 0.9 * clip(np.asarray(age, dtype=float), 0, 150) / 150


def effective_rain(forecast_mm):
    return 0.8 * np.maximum(0.0, forecast_mm - 3.0)


def water_balance(sm, oc, age, etc):
    fc, pwp = soil_hydraulics(oc)
    zr = root_depth(age)
    taw = 1000 * (fc - pwp) * zr
    dr = clip(1000 * (fc - sm) * zr, 0, taw)
    p = clip(0.65 + 0.04 * (5 - etc), 0.40, 0.80)
    raw = p * taw
    return dict(fc=fc, pwp=pwp, zr=zr, taw=taw, dr=dr, p=p, raw=raw)


def ks_factor(dr, taw, raw, p):
    return np.where(dr <= raw, 1.0, clip((taw - dr) / ((1 - p) * taw), 0, 1))


# ---------------------------------------------------------------------------
# Label generators
# ---------------------------------------------------------------------------
def days_to_irrigation(wb, etc, forecast_mm):
    return clip((wb["raw"] - wb["dr"] + effective_rain(forecast_mm)) / etc, 0, 15)


def irrigation_depth(wb, days, forecast_mm):
    """Net depth (mm) needed to refill the root zone on the irrigation day."""
    at_irrigation = np.where(days > 0, wb["raw"], wb["dr"] - effective_rain(forecast_mm))
    return clip(at_irrigation, 0, 100)


def stress_score(wb, temp_c, ndvi, age):
    ks = ks_factor(wb["dr"], wb["taw"], wb["raw"], wb["p"])
    heat = clip((temp_c - 33) / 7, 0, 1)
    ndvi_def = clip((expected_ndvi(age) - ndvi) / 0.3, 0, 1)
    approach = clip((wb["dr"] / wb["raw"] - 0.7) / 0.3, 0, 1)
    return clip(0.7 * (1 - ks) + 0.15 * heat + 0.15 * ndvi_def + 0.15 * approach, 0, 1)


STRESS_CLASSES = ["None", "Mild", "Moderate", "Severe"]


def stress_class(score):
    return np.digitize(score, [0.10, 0.30, 0.55])


def yield_potential(ph, oc, ndvi, age, temp_c, rain_mm, stress):
    g_ph = 1 - 0.12 * np.abs(ph - 6.8)
    g_oc = 0.85 + 0.15 * clip(oc, 0, 15) / 15
    ratio = ndvi / expected_ndvi(age)
    g_vigor = clip(0.55 + 0.45 * ratio, 0.5, 1.05)
    g_temp = 1 - 0.015 * np.maximum(0, np.abs(temp_c - 28) - 6)
    g_rain = clip(1 + 0.0002 * (rain_mm - 600), 0.95, 1.05)
    return Y_MAX * g_ph * g_oc * g_vigor * g_temp * g_rain * (1 - 0.25 * stress)


def yield_loss_from_delay(wb, etc, forecast_mm, age, temp_c, delay_days):
    """% yield loss if irrigation is postponed by `delay_days` from today.

    Simulates the daily root-zone depletion and integrates the FAO-33
    relationship 1 - Ya/Ym = Ky (1 - ETa/ETc) over the delay window.
    """
    delay_days = np.asarray(delay_days, dtype=float)
    peff = effective_rain(forecast_mm)
    stress_sum = np.zeros_like(delay_days)
    for day in range(1, 22):
        active = day <= delay_days
        rain_so_far = peff * min(day, 3) / 3          # forecast rain spread over 3 days
        dr = clip(wb["dr"] + etc * day - rain_so_far, 0, wb["taw"])
        ks = ks_factor(dr, wb["taw"], wb["raw"], wb["p"])
        stress_sum += np.where(active, 1 - ks, 0)
    heat = 1 + clip((temp_c - 32) / 8, 0, 1) * 0.5
    loss = 100 * KY_SUGARCANE * stress_sum / SEASON_DAYS * stage_sensitivity(age) * 2.0 * heat
    return clip(loss, 0, 60)


DISEASE_CLASSES = ["Low", "Medium", "High"]


def disease_risk_score(temp_c, rh, sm, oc, forecast_mm, age):
    fc, _ = soil_hydraulics(oc)
    humid = clip((rh - 75) / 20, 0, 1)
    temp_ok = np.exp(-((temp_c - 27) ** 2) / (2 * 5 ** 2))
    wet = clip((sm / fc - 0.85) / 0.15, 0, 1)
    rain = clip(forecast_mm / 40, 0, 1)
    fungal = 0.45 * humid * temp_ok + 0.25 * wet + 0.20 * rain * humid + 0.10 * humid
    borer = clip((temp_c - 30) / 6, 0, 1) * clip((60 - rh) / 30, 0, 1) * (np.asarray(age) < 120)
    return clip(np.maximum(fungal, 0.8 * borer), 0, 1)


def disease_class(score):
    return np.digitize(score, [0.25, 0.45])
