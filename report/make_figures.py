"""
Generates every chart used in the project report into report/figures/.

    python3 report/make_figures.py

Inputs: models/metrics.json, data/IrrigationAdvisoryDataset.csv, ml/agronomy.py
and report/data/results.json (system outputs captured from the running API).
"""
import json
import os
import shutil
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "ml"))
import agronomy as ag  # noqa: E402

OUT = os.path.join(ROOT, "report", "figures")
UML = os.path.join(ROOT, "report", "uml")
SHOTS = os.path.join(ROOT, "presentation", "screenshots")
os.makedirs(OUT, exist_ok=True)

metrics = json.load(open(os.path.join(ROOT, "models", "metrics.json")))
res = json.load(open(os.path.join(ROOT, "report", "data", "results.json")))
df = pd.read_csv(os.path.join(ROOT, "data", "IrrigationAdvisoryDataset.csv"))

# Colour-blind-safe palette (fixed order) + reserved status colours
S1, S2, S3, S4, S5, S6, S7 = "#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"
GOOD, WARN, SERIOUS, CRIT = "#0ca30c", "#fab219", "#ec835a", "#d03b3b"
GREY = "#9aa39e"

plt.rcParams.update({
    "font.family": "serif", "font.serif": ["Liberation Serif", "Times New Roman", "DejaVu Serif"],
    "font.size": 11, "axes.titlesize": 12, "axes.labelsize": 11, "axes.spines.top": False,
    "axes.spines.right": False, "axes.grid": True, "grid.color": "#e3e5df", "grid.linewidth": 0.8,
    "axes.axisbelow": True, "legend.frameon": False, "figure.dpi": 100, "savefig.dpi": 220,
    "savefig.bbox": "tight",
})


def save(fig, name):
    fig.savefig(os.path.join(OUT, name))
    plt.close(fig)
    print("saved", name)


# --------------------------------------------------------------- dataset
def fig_dataset_map():
    rows = []
    for g, t in zip(df[".geo"], df["Taluk"]):
        c = json.loads(g)["coordinates"][0]
        rows.append((np.mean([p[0] for p in c]), np.mean([p[1] for p in c]), t))
    d = pd.DataFrame(rows, columns=["lon", "lat", "taluk"])
    fig, ax = plt.subplots(figsize=(7.5, 5.2))
    cols = [S1, S2, S3, S4, S5, S7]
    for (t, g), c in zip(d.groupby("taluk"), cols):
        ax.scatter(g.lon, g.lat, s=10, color=c, label=f"{t} ({len(g)})", alpha=0.85)
    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")
    ax.set_title("Geofenced sugarcane plots in Mandya district (n = 1,000)")
    ax.legend(title="Taluk (plots)", loc="best", fontsize=9)
    ax.set_aspect("equal", adjustable="datalim")
    save(fig, "fig_dataset_map.png")


def fig_feature_dist():
    feats = [("NDVI", "NDVI"), ("LAI", "LAI"), ("Soil_Moisture", "Soil moisture (m³/m³)"),
             ("Soil_pH", "Soil pH"), ("Organic_Carbon", "Organic carbon (g/kg)"), ("Rainfall_mm", "Rainfall (mm)"),
             ("Temperature_C", "Temperature (°C)"), ("Relative_Humidity", "Relative humidity (%)")]
    fig, axes = plt.subplots(2, 4, figsize=(11, 5))
    for ax, (c, lab) in zip(axes.flat, feats):
        v = df[c].dropna()
        ax.hist(v, bins=20, color=S1, edgecolor="white", linewidth=0.6)
        ax.set_title(lab, fontsize=11)
        ax.tick_params(labelsize=9)
        ax.axvline(v.median(), color=S2, lw=1.5, ls="--")
    fig.suptitle("Distribution of plot features (dashed line = median)", y=1.02)
    fig.tight_layout()
    save(fig, "fig_feature_dist.png")


def fig_corr():
    c = res["correlation"]
    m = np.array(c["matrix"])
    fig, ax = plt.subplots(figsize=(6.8, 5.6))
    im = ax.imshow(m, cmap="RdBu", vmin=-1, vmax=1)
    ax.set_xticks(range(len(c["labels"])), c["labels"], rotation=40, ha="right")
    ax.set_yticks(range(len(c["labels"])), c["labels"])
    ax.grid(False)
    for i in range(len(m)):
        for j in range(len(m)):
            ax.text(j, i, f"{m[i, j]:.2f}", ha="center", va="center", fontsize=8.5,
                    color="white" if abs(m[i, j]) > 0.6 else "black")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04, label="Pearson r")
    ax.set_title("Pearson correlation between raw features")
    save(fig, "fig_correlation.png")


# --------------------------------------------------------------- agronomy
def fig_kc_ndvi():
    age = np.linspace(0, 365, 366)
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
    a1.plot(age, ag.kc_stage(age), color=S1, lw=2.2)
    for x, name, yy in [(0, "Germination", 1.33), (45, "Tillering", 1.18), (130, "Grand growth", 1.33), (290, "Maturity", 1.33)]:
        a1.axvline(x, color=GREY, lw=0.8, ls=":")
        a1.text(x + 3, yy, name, fontsize=9, color="#444")
    a1.set_ylim(0.3, 1.4)
    a1.set_xlabel("Crop age (days after planting)")
    a1.set_ylabel("Crop coefficient Kc")
    a1.set_title("(a) FAO-56 sugarcane crop-coefficient curve")
    a2.plot(age, ag.expected_ndvi(age), color=S3, lw=2.2, label="Expected NDVI (healthy plot)")
    a2.plot(age, ag.root_depth(age), color=S2, lw=2.2, ls="--", label="Root depth Zr (m)")
    a2.set_xlabel("Crop age (days after planting)")
    a2.set_title("(b) Phenology: NDVI trajectory and root depth")
    a2.legend(loc="lower right")
    fig.tight_layout()
    save(fig, "fig_kc_ndvi.png")


def fig_water_balance():
    oc, age, sm0, etc = 10.0, 180, 0.26, 4.5
    wb = ag.water_balance(np.array([sm0]), np.array([oc]), np.array([age]), np.array([etc]))
    taw, raw = float(wb["taw"][0]), float(wb["raw"][0])
    days = np.arange(0, 31)
    dr = []
    d = float(wb["dr"][0])
    for t in days:
        if t > 0:
            d = min(taw, d + etc)
        dr.append(d)
    # with SMA irrigation when depletion reaches RAW
    dr_sma, d = [], float(wb["dr"][0])
    events = []
    for t in days:
        if t > 0:
            d = d + etc
            if d >= raw:
                events.append(t)
                d = 0.0
        dr_sma.append(d)
    fig, ax = plt.subplots(figsize=(9, 4.4))
    ax.plot(days, np.array(dr), color=S2, lw=2.2, ls="--", label="No irrigation")
    ax.plot(days, np.array(dr_sma), color=S1, lw=2.2, label="Irrigate when depletion reaches RAW (SMA)")
    ax.axhline(raw, color=CRIT, lw=1.2, ls=":", label=f"RAW = {raw:.0f} mm (stress threshold)")
    ax.axhline(taw, color="#555", lw=1.2, ls="-.", label=f"TAW = {taw:.0f} mm (wilting point)")
    for e in events:
        ax.annotate("irrigate", (e, 0), xytext=(e, raw * 0.35), ha="center", fontsize=9,
                    arrowprops=dict(arrowstyle="->", color="#333"))
    ax.set_ylim(taw * 1.08, -5)
    ax.set_xlabel("Days")
    ax.set_ylabel("Root-zone depletion Dr (mm)")
    ax.set_title("Root-zone water balance (grand growth, ETc = 4.5 mm/day)")
    ax.legend(loc="lower left", fontsize=9)
    save(fig, "fig_water_balance.png")


# --------------------------------------------------------------- results
MODEL_LABELS = {
    "next_irrigation": "Next irrigation", "water_requirement": "Crop water req.",
    "irrigation_depth": "Irrigation depth", "yield": "Cane yield", "yield_loss": "Yield loss (delay)",
    "water_stress": "Water stress", "disease_risk": "Disease risk",
}


def fig_r2():
    reg = ["next_irrigation", "water_requirement", "irrigation_depth", "yield", "yield_loss"]
    m = metrics["models"]
    x = np.arange(len(reg))
    fig, ax = plt.subplots(figsize=(9, 4.4))
    a = [m[k]["test"]["r2"] for k in reg]
    b = [m[k]["baseline"]["r2"] for k in reg]
    ax.bar(x - 0.19, a, 0.36, color=S1, label="SMA tree ensemble", edgecolor="white")
    ax.bar(x + 0.19, b, 0.36, color=GREY, label="Linear regression baseline", edgecolor="white")
    for i, (u, v) in enumerate(zip(a, b)):
        ax.text(i - 0.19, u + 0.015, f"{u:.3f}", ha="center", fontsize=9)
        ax.text(i + 0.19, v + 0.015, f"{v:.3f}", ha="center", fontsize=9)
    ax.set_xticks(x, [MODEL_LABELS[k] for k in reg])
    ax.set_ylim(0, 1.1)
    ax.set_ylabel("R² on unseen plots")
    ax.set_title("Regression models: coefficient of determination (higher is better)")
    ax.legend(loc="upper center", ncol=2, bbox_to_anchor=(0.5, -0.1))
    save(fig, "fig_r2.png")


def fig_pred_actual():
    keys = ["next_irrigation", "water_requirement", "irrigation_depth", "yield"]
    units = ["days", "mm/day", "mm", "t/ha"]
    fig, axes = plt.subplots(2, 2, figsize=(9.5, 8))
    for ax, k, u in zip(axes.flat, keys, units):
        s = metrics["models"][k]["sample"]
        a = np.array([p["actual"] for p in s])
        p = np.array([p["predicted"] for p in s])
        ax.scatter(a, p, s=11, color=S1, alpha=0.6)
        lo, hi = min(a.min(), p.min()), max(a.max(), p.max())
        ax.plot([lo, hi], [lo, hi], color=S2, ls="--", lw=1.4)
        t = metrics["models"][k]["test"]
        ax.set_title(f"{MODEL_LABELS[k]} (R² = {t['r2']:.3f}, MAE = {t['mae']:.2f} {u})", fontsize=11)
        ax.set_xlabel(f"Actual ({u})")
        ax.set_ylabel(f"Predicted ({u})")
    fig.tight_layout()
    save(fig, "fig_pred_actual.png")


def fig_confusion():
    fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.4))
    for ax, k in zip(axes, ["water_stress", "disease_risk"]):
        m = metrics["models"][k]
        cm = np.array(m["confusion_matrix"])
        norm = cm / cm.sum(axis=1, keepdims=True)
        ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
        ax.grid(False)
        ax.set_xticks(range(len(m["classes"])), m["classes"])
        ax.set_yticks(range(len(m["classes"])), m["classes"])
        for i in range(len(cm)):
            for j in range(len(cm)):
                ax.text(j, i, f"{cm[i, j]}\n({norm[i, j] * 100:.0f}%)", ha="center", va="center", fontsize=9,
                        color="white" if norm[i, j] > 0.55 else "black")
        ax.set_xlabel("Predicted class")
        ax.set_ylabel("Actual class")
        ax.set_title(f"{MODEL_LABELS[k]}: accuracy {m['test']['accuracy'] * 100:.1f}%")
    fig.tight_layout()
    save(fig, "fig_confusion.png")


def fig_importance():
    fig, axes = plt.subplots(1, 3, figsize=(12.5, 4.2))
    for ax, k in zip(axes, ["next_irrigation", "water_stress", "yield"]):
        imp = metrics["models"][k]["importance"][:7][::-1]
        ax.barh([i["label"] for i in imp], [i["importance"] * 100 for i in imp], color=S3)
        ax.set_title(MODEL_LABELS[k])
        ax.set_xlabel("Importance (%)")
        ax.tick_params(labelsize=9)
    fig.tight_layout()
    save(fig, "fig_importance.png")


SCEN = [("snapshot", "Satellite\nsnapshot"), ("dry", "Summer\ndry spell"), ("rain", "Dry spell +\n40 mm forecast"), ("humid", "Humid\nmonsoon")]


def fig_scenarios():
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.4))
    x = np.arange(len(SCEN))
    today = [res[k]["kpi"]["dueToday"] for k, _ in SCEN]
    stress = [res[k]["kpi"]["moderateOrWorse"] for k, _ in SCEN]
    skip = [res[k]["kpi"]["rainSkips"] for k, _ in SCEN]
    w = 0.26
    for off, vals, col, lab in [(-w, today, CRIT, "Irrigate today"), (0, stress, SERIOUS, "Moderate/severe stress"), (w, skip, S1, "Rain-skip advisories")]:
        a1.bar(x + off, vals, w, color=col, label=lab, edgecolor="white")
        for i, v in enumerate(vals):
            a1.text(i + off, v + 12, str(v), ha="center", fontsize=8.5)
    a1.set_xticks(x, [l for _, l in SCEN])
    a1.set_ylabel("Number of plots")
    a1.set_title("(a) Advisory outcomes by weather scenario")
    a1.legend(fontsize=9, loc="upper left")
    rec = [res[k]["kpi"]["weeklyWaterM3"] / 1000 for k, _ in SCEN]
    conv = [res[k]["kpi"]["weeklyConventionalM3"] / 1000 for k, _ in SCEN]
    a2.bar(x - 0.19, rec, 0.36, color=S1, label="SMA recommendation", edgecolor="white")
    a2.bar(x + 0.19, conv, 0.36, color=S2, label="Fixed 8-day practice", edgecolor="white")
    for i, v in enumerate(rec):
        a2.text(i - 0.19, v + 6, f"{v:.0f}k", ha="center", fontsize=8.5)
    a2.set_xticks(x, [l for _, l in SCEN])
    a2.set_ylabel("Water per week (thousand m³)")
    a2.set_title("(b) Weekly irrigation water, all 1,000 plots")
    a2.legend(fontsize=9, loc="upper right")
    fig.tight_layout()
    save(fig, "fig_scenarios.png")


def fig_methods():
    meths = [("flood", "Flood (55%)"), ("furrow", "Furrow (65%)"), ("sprinkler", "Sprinkler (75%)"), ("drip", "Drip (90%)")]
    rec = [res["method_" + k]["weeklyWaterM3"] / 1000 for k, _ in meths]
    pct = [res["method_" + k]["weeklySavedPct"] for k, _ in meths]
    conv = res["method_furrow"]["weeklyConventionalM3"] / 1000
    fig, ax = plt.subplots(figsize=(8.5, 4.2))
    ax.bar([l for _, l in meths], rec, color=[S2, S1, S3, S6], width=0.55)
    ax.axhline(conv, color=CRIT, ls="--", lw=1.4, label=f"Fixed 8-day practice ({conv:.0f}k m³)")
    for i, (v, p) in enumerate(zip(rec, pct)):
        ax.text(i, v + 6, f"{v:.0f}k m³\n(−{p:.0f}%)", ha="center", fontsize=9.5)
    ax.set_ylabel("Water per week (thousand m³)")
    ax.set_ylim(0, conv * 1.15)
    ax.set_title("SMA weekly water requirement by irrigation method (efficiency)")
    ax.legend(loc="upper right")
    save(fig, "fig_methods.png")


def fig_loss_curve():
    lc = res["farm"]["lossCurve"]
    pr = res["farm"]["projection"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2))
    a1.plot([p["day"] for p in pr["series"]], [p["advice"] for p in pr["series"]], color=S1, lw=2.2, label="Following SMA advice")
    a1.plot([p["day"] for p in pr["series"]], [p["none"] for p in pr["series"]], color=S2, lw=2.2, ls="--", label="No irrigation")
    a1.axhline(pr["stressThreshold"], color=CRIT, ls=":", lw=1.3, label="Stress threshold (RAW)")
    a1.set_ylim(0, 105)
    a1.set_xlabel("Days from today")
    a1.set_ylabel("Plant-available water (%)")
    a1.set_title("(a) 14-day root-zone projection, plot MM-MD-0110")
    a1.legend(fontsize=9)
    a2.plot([p["delay"] for p in lc], [p["lossPct"] for p in lc], color=S2, lw=2.2, marker="o", ms=4)
    a2.fill_between([p["delay"] for p in lc], [p["lossPct"] for p in lc], color=S2, alpha=0.12)
    a2.set_xlabel("Irrigation delay (days)")
    a2.set_ylabel("Expected yield loss (%)")
    a2.set_title("(b) Yield loss vs delay (GBM model)")
    fig.tight_layout()
    save(fig, "fig_loss_curve.png")


def fig_scheduler():
    caps = sorted(res["schedule_cap"], key=int)
    opt = [res["schedule_cap"][c]["opt"]["estimatedLossT"] for c in caps]
    fcfs = [res["schedule_cap"][c]["fcfs"]["estimatedLossT"] for c in caps]
    hs_o = [res["schedule_cap"][c]["opt"]["highStressServed"] for c in caps]
    hs_f = [res["schedule_cap"][c]["fcfs"]["highStressServed"] for c in caps]
    x = np.arange(len(caps))
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2))
    a1.bar(x - 0.19, opt, 0.36, color=S1, label="SMA (WSPT)")
    a1.bar(x + 0.19, fcfs, 0.36, color=S2, label="First-come rotation")
    for i, (u, v) in enumerate(zip(opt, fcfs)):
        a1.text(i - 0.19, u + 1, f"{u:.1f}", ha="center", fontsize=8.5)
        a1.text(i + 0.19, v + 1, f"{v:.1f}", ha="center", fontsize=8.5)
    a1.set_xticks(x, [f"{c} pumps" for c in caps])
    a1.set_ylabel("Estimated cane loss (t)")
    a1.set_title("(a) Cane loss vs feeder capacity (village Hosur, 3 days)")
    a1.legend(fontsize=9)
    a2.bar(x - 0.19, hs_o, 0.36, color=S1, label="SMA (WSPT)")
    a2.bar(x + 0.19, hs_f, 0.36, color=S2, label="First-come rotation")
    tot = res["schedule_cap"][caps[0]]["opt"]["highStressPlots"]
    a2.axhline(tot, color=GREY, ls="--", lw=1.2, label=f"High-stress plots ({tot})")
    a2.set_xticks(x, [f"{c} pumps" for c in caps])
    a2.set_ylabel("High-stress plots fully irrigated")
    a2.set_title("(b) High-stress plots served within horizon")
    a2.legend(fontsize=9)
    fig.tight_layout()
    save(fig, "fig_scheduler.png")


def fig_calendar():
    cal = res["dry"]["calendar"]
    fig, ax = plt.subplots(figsize=(9, 3.8))
    cols = [CRIT if c["day"] == 0 else SERIOUS if c["day"] <= 2 else S1 for c in cal]
    ax.bar([("Today" if c["day"] == 0 else f"+{c['day']}") for c in cal], [c["plots"] for c in cal], color=cols)
    for i, c in enumerate(cal):
        if c["plots"]:
            ax.text(i, c["plots"] + 8, str(c["plots"]), ha="center", fontsize=8.5)
    ax.set_ylabel("Plots due")
    ax.set_xlabel("Day")
    ax.set_title("Irrigation calendar for the next 14 days (summer dry spell scenario)")
    save(fig, "fig_calendar.png")


def fig_taluk():
    t = res["snapshot"]["byTaluk"]
    names = [x["name"] for x in t]
    rec = [x["weeklyWaterM3"] / 1000 for x in t]
    conv = [(x["weeklyWaterM3"] + x["weeklySavedM3"]) / 1000 for x in t]
    x = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(9, 4))
    ax.bar(x - 0.19, rec, 0.36, color=S1, label="SMA recommendation")
    ax.bar(x + 0.19, conv, 0.36, color=S2, label="Fixed 8-day practice")
    ax.set_xticks(x, names, rotation=15)
    ax.set_ylabel("Water per week (thousand m³)")
    ax.set_title("Taluk-wise weekly irrigation water (satellite snapshot)")
    ax.legend()
    save(fig, "fig_taluk.png")


def fig_zones():
    z = res["zones"]
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    names = [f"{q['name']}\n({q['currentCount']} plots)" for q in z]
    feats = [("ndvi", "NDVI"), ("soil_moisture", "Soil moisture"), ("organic_carbon", "Organic C"), ("rainfall_mm", "Rainfall")]
    allv = {f: np.array([q["centroid"][f] for q in z]) for f, _ in feats}
    x = np.arange(len(z))
    w = 0.2
    for i, ((f, lab), col) in enumerate(zip(feats, [S1, S2, S3, S4])):
        v = allv[f]
        ax.bar(x + (i - 1.5) * w, (v - v.min()) / (v.max() - v.min() + 1e-9) + 0.05, w, color=col, label=lab)
    ax.set_xticks(x, names)
    ax.set_yticks([])
    ax.set_ylabel("Relative level (min–max scaled)")
    ax.set_title("K-Means management-zone profiles")
    ax.legend(ncol=4, fontsize=9, loc="upper center", bbox_to_anchor=(0.5, -0.22))
    save(fig, "fig_zones.png")


def fig_timeline():
    tasks = [
        ("Problem study & use-case analysis", 0, 2), ("Literature survey", 1, 3), ("Dataset audit & cleaning", 2, 2),
        ("Agronomy engine (FAO-56/33)", 3, 3), ("Model training & evaluation", 5, 3), ("Node.js inference & API", 6, 3),
        ("Decision engine & scheduler", 8, 3), ("Web dashboard & chatbot", 9, 4), ("Testing & validation", 12, 2),
        ("Report, presentation & review", 13, 3),
    ]
    fig, ax = plt.subplots(figsize=(9, 4.2))
    for i, (n, s, d) in enumerate(tasks):
        ax.barh(i, d, left=s, color=[S1, S3, S2, S4][i % 4], height=0.55)
    ax.set_yticks(range(len(tasks)), [t[0] for t in tasks])
    ax.invert_yaxis()
    ax.set_xlabel("Week of semester")
    ax.set_xticks(range(0, 17, 2))
    ax.set_title("Project schedule (Gantt chart)")
    save(fig, "fig_timeline.png")


def crop_screens():
    def crop(src, dst, box=None):
        im = Image.open(os.path.join(SHOTS, src))
        if box:
            im = im.crop(box)
        im.save(os.path.join(OUT, dst))
        print("saved", dst)
    crop("01_overview.png", "ss_overview.png")
    crop("02_map.png", "ss_map.png")
    crop("02b_map_zoom.png", "ss_map_zoom.png")
    crop("03_advisor.png", "ss_advisor_top.png", (354, 0, 2160, 1310))
    crop("03_advisor.png", "ss_advisor_charts.png", (354, 1300, 2160, 2871))
    crop("04_advisor_kannada.png", "ss_advisor_kannada.png", (354, 420, 2160, 1350))
    crop("05_rain.png", "ss_rain.png")
    crop("06_simulator.png", "ss_simulator.png")
    crop("07_scheduler.png", "ss_scheduler.png")
    crop("08_insights.png", "ss_insights_top.png", (354, 0, 2160, 1450))
    crop("08_insights.png", "ss_insights_bottom.png", (354, 1450, 2160, 2886))
    crop("09_chat.png", "ss_chat.png")
    crop("10_about.png", "ss_about.png", (354, 0, 2160, 1350))


def copy_uml():
    for f in os.listdir(UML):
        if f.endswith(".png") and not f.startswith("actor"):
            shutil.copy(os.path.join(UML, f), os.path.join(OUT, "uml_" + f))


if __name__ == "__main__":
    fig_dataset_map(); fig_feature_dist(); fig_corr(); fig_kc_ndvi(); fig_water_balance()
    fig_r2(); fig_pred_actual(); fig_confusion(); fig_importance(); fig_scenarios(); fig_methods()
    fig_loss_curve(); fig_scheduler(); fig_calendar(); fig_taluk(); fig_timeline()
    crop_screens(); copy_uml()
