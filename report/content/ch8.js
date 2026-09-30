module.exports = {
  n: 8,
  title: 'CONCLUSION & FUTURE SCOPE',
  blocks: [
    { h2: '8.1 Conclusion' },
    { p: 'This project designed, implemented and evaluated the Smart Moisture Advisor (SMA), an AI-driven irrigation advisory system for sugarcane developed for the KJS-AGR-01 use case of K. J. Somaiya Institute of Technology with KIAAR and Godavari Biorefineries Ltd. Starting from 1,000 geofenced plots in Mandya district that had satellite, soil and climate features but no ground-truth labels, the project showed that physics-informed labels generated from the FAO-56 water balance and the FAO-33 yield response over 12,000 seasonal scenarios make it possible to train useful supervised models before field records exist.' },
    { p: 'On plots never seen during training, the regression models for next irrigation, crop water requirement, irrigation depth, yield and yield loss achieved R² of 0.89–0.98 (irrigation-date error 0.69 days), and the water-stress and disease-risk classifiers 87–88% accuracy, outperforming their baselines in every case and performing consistently across all six taluks. Exported to JSON, the models run natively in Node.js with predictions identical to scikit-learn and score all plots in about 0.2 seconds.' },
    { p: 'A decision-support engine turns the predictions into rain-adjusted advice, pump run-times, fertigation doses and explanations, and a WSPT scheduler allocates pumps within limited power windows. The web platform and multilingual chatbot deliver this to farmers, supervisors, agronomists and the sugar factory with human-in-the-loop feedback. The results indicate about 38% less water than fixed eight-day irrigation under observed conditions (up to 56% with drip), 894 irrigations postponed when 40 mm of rain is forecast, and more high-stress plots served under constrained power (7 instead of 2 in the Hosur example). All eleven AI models listed in the use case were implemented. The main limitation — labels and savings derived from agronomic models rather than field measurements — can be removed by retraining the same pipeline on real data.' },

    { h2: '8.2 Future Scope' },
    { p: 'The following extensions are planned to move SMA from a validated prototype to a field deployment across the GBL/KIAAR network:' },
    { numbered: [
      '**Field validation and retraining on real data.** Collect irrigation logs, water volumes and harvest yields from a pilot village, retrain the models with the existing pipeline and measure actual water and energy savings against control plots.',
      '**IoT soil-moisture sensors.** Deploy low-cost capacitive sensor nodes with LoRa or GSM gateways on representative plots to update root-zone moisture daily and to calibrate the satellite-based estimates, as envisaged in the use case.',
      '**Live weather and satellite feeds.** Integrate India Meteorological Department forecasts and Sentinel-2 / SMAP time series so that advisories are refreshed automatically every day instead of from a single snapshot.',
      '**Integration with STEPS.** Use real planting dates, crop varieties, soil-test reports and farmer contact preferences from the STEPS platform through the existing REST API.',
      '**LLM-based conversational advisory.** Pass SMA\'s structured outputs to a large language model to answer open-ended questions over WhatsApp, SMS or interactive voice response in Kannada, Marathi and Hindi, with native-speaker validation of all templates.',
      '**Mobile application and notifications.** Provide a lightweight Android application with offline caching and push notifications for field staff and farmers.',
      '**Smart pump automation.** Connect the optimised schedule to pump controllers so that pumps start automatically within the allocated power windows, with manual override.',
      '**Advanced models.** Add time-series models for soil-moisture forecasting, exact optimisation (mixed-integer programming) for pump scheduling, and calibrated uncertainty for all predictions.',
      '**Continuous learning and monitoring.** Use accept/override feedback and field outcomes to retrain regularly, track model drift across seasons and taluks, and maintain audit logs as required by the governance framework.',
    ] },
  ],
};
