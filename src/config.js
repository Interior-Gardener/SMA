const path = require('path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT) || 3000,
  DATA_FILE: process.env.SMA_DATA || path.join(ROOT, 'data', 'IrrigationAdvisoryDataset.csv'),
  MODELS_DIR: path.join(ROOT, 'models'),
  FEEDBACK_FILE: path.join(ROOT, 'data', 'feedback.jsonl'),

  // Default "what is happening this week" scenario. Every value can be changed
  // from the UI's scenario bar or via query parameters on the API.
  DEFAULT_SCENARIO: {
    forecastRain: 0,      // mm expected over the next 3 days (IMD / weather API)
    tempAnomaly: 0,       // deg C above the dataset's seasonal mean temperature
    method: 'furrow',     // flood | furrow | sprinkler | drip
    pumpFlow: 50,         // m3/hour delivered by a typical 5 HP pump set
    daysSinceObs: 0,      // dry days elapsed since the satellite soil-moisture observation
    rhAnomaly: 0,         // % points of humidity above/below normal (e.g. humid monsoon spell)
  },

  IRRIGATION_METHODS: {
    flood: { label: 'Flood', efficiency: 0.55 },
    furrow: { label: 'Furrow', efficiency: 0.65 },
    sprinkler: { label: 'Sprinkler', efficiency: 0.75 },
    drip: { label: 'Drip', efficiency: 0.9 },
  },

  PUMP_KW: 3.73,                // 5 HP motor
  TARIFF_RS_PER_KWH: 7,         // cost of supplying agricultural power (borne by the state)
  // Farmers' conventional practice used as the comparison baseline:
  // one irrigation of ~70 mm gross every 8 days, whatever the weather.
  CONVENTIONAL: { intervalDays: 8, grossDepthMm: 70 },
};
