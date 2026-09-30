# SMA REST API

Base URL: `http://localhost:3000/api`. All responses are JSON.

## Weather-scenario parameters

Accepted as query parameters (GET) or body fields (POST) on `/farms`, `/farms/:id`, `/insights`, `/predict`, `/schedule` and in `scenario` for `/chat`. Values are clamped to safe ranges.

| Param | Default | Range | Meaning |
|---|---|---|---|
| `forecastRain` | 0 | 0-150 | mm of rain forecast over the next 3 days |
| `tempAnomaly` | 0 | -6 to 14 | °C above the plot's observed temperature |
| `rhAnomaly` | 0 | -40 to 30 | % points of humidity above normal |
| `daysSinceObs` | 0 | 0-30 | dry days since the satellite soil-moisture observation |
| `method` | `furrow` | flood / furrow / sprinkler / drip | irrigation method (sets efficiency) |
| `pumpFlow` | 50 | 5-200 | pump delivery in m³/h |

## Endpoints

### `GET /health`
```json
{ "status": "ok", "plots": 1000, "models": 7, "time": "2026-09-30T11:33:18.421Z" }
```

### `GET /meta`
Taluks with their villages, languages, irrigation methods, default scenario, regional medians and feature bounds.

### `GET /farms?taluk=Maddur&village=Hosur&tempAnomaly=8&daysSinceObs=7`
A summary advisory for every plot: `id, taluk, village, centroid, stage, daysToIrrigation, daysUncertainty, dueInDays, status (today|tomorrow|later|rain_skip), waterRequirementMm, netDepthMm, grossDepthMm, volumeM3, hours, stressProbabilities[4], stressClass, riskProbabilities[3], riskClass, yieldTHa, yieldLoss5DaysPct, tonnesAtRisk, weekly{recommendedM3, conventionalM3, savedM3, savedKwh, savedRs, rainSavedM3}, zone, alerts[], quality[]`.

### `GET /farms/geo`
`[{ "id": "MM-MD-0110", "polygon": [[lat, lng], ...] }, ...]`

### `GET /farms/:id?lang=kn&cropAge=200`
The full advisory for one plot. It includes everything in the summary plus:
- `advisory[]`: `{key, text}` lines in the requested language (`en|kn|hi|mr`), plus `advisoryEnglish`
- `lossCurve[]`: `{delay, lossPct}` for 0-14 days
- `projection`: 14-day root-zone moisture with and without irrigation, and the stress threshold
- `fertigation`: stage, weekly nutrients, products (urea, 12-61-0, MOP) and notes
- `explanation`: per-feature effects on next-irrigation and stress, plus plain-English reasons
- `zone`, `inputs`, `irrigationDate`, `polygon`

`cropAge` optionally overrides the estimated crop age. It returns `404` for an unknown plot.

### `POST /predict`
A what-if prediction for any inputs. Missing features default to the regional median.
```bash
curl -X POST localhost:3000/api/predict -H 'content-type: application/json' \
  -d '{"soil_moisture":0.15,"temperature_c":36,"relative_humidity":40,"crop_age_days":180,"method":"drip","lang":"en"}'
```
```json
{ "status": "today", "daysToIrrigation": 0.17, "waterRequirementMm": 6.7, "hours": 16.1,
  "dripDailyHours": 1.1, "stressProbabilities": [0.013, 0.046, 0.025, 0.916], "yieldTHa": 85.1, "...": "..." }
```
Accepted features: `ndvi, lai, soil_moisture, soil_ph, organic_carbon, temperature_c, relative_humidity, rainfall_mm, crop_age_days, forecast_rain_mm`, plus `area_ha`. A non-numeric value returns `400`.

### `GET /insights`
Region analytics: `kpi{...}`, `stressDistribution`, `riskDistribution`, `calendar[15]`, `byTaluk[]`, `byVillage[]`, `correlation{labels, matrix}`, `histograms`, `stages`, `zones[]`, `quality`.

### `POST /schedule`
```json
{ "village": "Hosur", "capacity": 20, "days": 3,
  "windows": [{"start":"06:00","end":"10:00"},{"start":"17:00","end":"20:00"}],
  "tempAnomaly": 8, "daysSinceObs": 7 }
```
Returns `jobs`, `demandPumpHours`, `capacityPumpHoursPerDay`, `slots`, and for both `optimised` and `fcfs`: `segments[{lane, id, start, end, stressClass}]` (minutes from day-1 midnight) plus a `kpi` object (`estimatedLossT, plotsCompleted, tonnesAtRiskPending, avgHighStressCompletionHours, highStressServed, pumpHours, energyKwh`). `optimised.results[]` lists the schedule in order.

### `GET /models`
The contents of `models/metrics.json` (test metrics, baselines, feature importance, confusion matrices, dataset info), plus runtime tree and node counts.

### `POST /feedback`
```json
{ "farmId": "MM-MD-0110", "action": "overridden", "recommendedDays": 0, "actualDays": 2,
  "reason": "canal water only on Friday", "role": "supervisor" }
```
Appends to `data/feedback.jsonl`. `GET /feedback` returns totals, the acceptance rate and the 20 most recent entries.

### `POST /chat`
```json
{ "message": "MM-MD-0110 में सिंचाई कब करूँ?", "lang": "en", "scenario": { "tempAnomaly": 8 } }
```
```json
{ "lang": "hi", "intents": ["irrigation"], "farmId": "MM-MD-0110",
  "messages": ["खेत MM-MD-0110 (Bheemanahalli, Malavalli) - फसल की आयु 160 दिन।", "अगली सिंचाई 10 दिन बाद ..."] }
```
The language is auto-detected from the script (Kannada or Devanagari; Marathi vs Hindi by keywords). Intents are irrigation, rain, fertigation, disease, yield, stress, greeting and help.
