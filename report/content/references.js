// IEEE-style references. `lit` entries populate Table 2.1 (literature survey).
module.exports = {
  usecase: {
    ieee: 'S. Virnodkar, R. Kotecha, N. Mehendale, U. Shinde, D. Auti and B. Singh, "Irrigation Advisory System for Sugarcane Crop using AI and Sensor-based Technology," AI Use Case KJS-AGR-01, K. J. Somaiya Institute of Technology, KIAAR and Godavari Biorefineries Ltd., Mumbai, India, 2026.',
    lit: { who: 'Virnodkar et al. (KJSIT, KIAAR, GBL), 2026', approach: 'Use case KJS-AGR-01 for an AI irrigation advisory; lists 11 required models.', finding: 'Defines problem, data, workflow and governance.', gap: 'Specification only; no implementation.' },
  },
  fao_sugarcane: {
    ieee: 'Food and Agriculture Organization of the United Nations, "Sugarcane," *Land & Water – Crop Information*. [Online]. Available: https://www.fao.org/land-water/databases-and-software/crop-information/sugarcane/en/ (accessed Sep. 2026).',
    lit: { who: 'FAO (crop information)', approach: 'Agronomic summary of sugarcane water needs and stages.', finding: 'Crop needs ≈1,500–2,500 mm per season.', gap: 'Generic; not plot-specific.' },
  },
  allen1998: {
    ieee: 'R. G. Allen, L. S. Pereira, D. Raes and M. Smith, *Crop Evapotranspiration – Guidelines for Computing Crop Water Requirements*, FAO Irrigation and Drainage Paper 56. Rome, Italy: FAO, 1998.',
    lit: { who: 'Allen et al., 1998 (FAO-56)', approach: 'FAO-56 ET, crop coefficients and root-zone water balance.', finding: 'Standard basis of irrigation scheduling.', gap: 'Needs full inputs; no learning or uncertainty.' },
  },
  hargreaves1985: {
    ieee: 'G. H. Hargreaves and Z. A. Samani, "Reference crop evapotranspiration from temperature," *Applied Engineering in Agriculture*, vol. 1, no. 2, pp. 96–99, 1985.',
    lit: { who: 'Hargreaves & Samani, 1985', approach: 'Temperature-based ET0 equation.', finding: 'ET0 from temperature and radiation only.', gap: 'Less accurate in humid climates.' },
  },
  doorenbos1979: {
    ieee: 'J. Doorenbos and A. H. Kassam, *Yield Response to Water*, FAO Irrigation and Drainage Paper 33. Rome, Italy: FAO, 1979.',
    lit: { who: 'Doorenbos & Kassam, 1979 (FAO-33)', approach: 'FAO-33 yield response factor Ky.', finding: 'Links ET deficit to yield loss (sugarcane Ky ≈ 1.2).', gap: 'Seasonal; does not schedule irrigation.' },
  },
  inman2005: {
    ieee: 'N. G. Inman-Bamber and D. M. Smith, "Water relations in sugarcane and response to water deficits," *Field Crops Research*, vol. 92, no. 2–3, pp. 185–202, 2005.',
    lit: { who: 'Inman-Bamber & Smith, 2005', approach: 'Review of sugarcane water relations.', finding: 'Growth most sensitive to deficit in active growth.', gap: 'Physiology only; no tool.' },
  },
  rouse1974: {
    ieee: 'J. W. Rouse, R. H. Haas, J. A. Schell and D. W. Deering, "Monitoring vegetation systems in the Great Plains with ERTS," in *Proc. 3rd Earth Resources Technology Satellite-1 Symposium*, NASA SP-351, Washington, DC, USA, 1974, pp. 309–317.',
    lit: { who: 'Rouse et al., 1974', approach: 'Introduced NDVI from red and NIR reflectance.', finding: 'Satellite indicator of crop vigour.', gap: 'Index only; no decisions.' },
  },
  entekhabi2010: {
    ieee: 'D. Entekhabi *et al.*, "The Soil Moisture Active Passive (SMAP) mission," *Proceedings of the IEEE*, vol. 98, no. 5, pp. 704–716, May 2010.',
    lit: { who: 'Entekhabi et al., 2010', approach: 'SMAP satellite soil-moisture mission.', finding: 'Regular soil-moisture maps.', gap: 'Coarse, surface layer only.' },
  },
  gorelick2017: {
    ieee: 'N. Gorelick, M. Hancher, M. Dixon, S. Ilyushchenko, D. Thau and R. Moore, "Google Earth Engine: Planetary-scale geospatial analysis for everyone," *Remote Sensing of Environment*, vol. 202, pp. 18–27, 2017.',
    lit: { who: 'Gorelick et al., 2017', approach: 'Google Earth Engine cloud platform.', finding: 'Plot-level indices at scale.', gap: 'Data platform only.' },
  },
  zanaga2021: {
    ieee: 'D. Zanaga *et al.*, "ESA WorldCover 10 m 2020 v100," Zenodo, 2021. doi: 10.5281/zenodo.5571936.',
    lit: { who: 'Zanaga et al., 2021', approach: 'ESA WorldCover 10 m land cover.', finding: 'Cropland mask used for sampling.', gap: 'No crop or management data.' },
  },
  goap2018: {
    ieee: 'A. Goap, D. Sharma, A. K. Shukla and C. Rama Krishna, "An IoT based smart irrigation management system using machine learning and open source technologies," *Computers and Electronics in Agriculture*, vol. 155, pp. 41–49, 2018.',
    lit: { who: 'Goap et al., 2018', approach: 'IoT sensors + weather forecast + ML to automate irrigation.', finding: 'Forecast-aware automatic irrigation.', gap: 'Sensors per field; single field; no yield-loss or scheduling.' },
  },
  kamienski2019: {
    ieee: 'C. Kamienski *et al.*, "Smart water management platform: IoT-based precision irrigation for agriculture," *Sensors*, vol. 19, no. 2, p. 276, 2019.',
    lit: { who: 'Kamienski et al., 2019 (SWAMP)', approach: 'SWAMP IoT platform for precision irrigation.', finding: 'Configurable smart-water platform in pilots.', gap: 'Limited ML; no local-language advisory.' },
  },
  navarro2016: {
    ieee: 'H. Navarro-Hellín, J. Martínez-del-Rincon, R. Domingo-Miguel, F. Soto-Valles and R. Torres-Sánchez, "A decision support system for managing irrigation in agriculture," *Computers and Electronics in Agriculture*, vol. 124, pp. 121–131, 2016.',
    lit: { who: 'Navarro-Hellín et al., 2016', approach: 'Sensor data + ML regression for weekly irrigation needs.', finding: 'Reproduced expert decisions closely.', gap: 'Needs labelled history and sensors.' },
  },
  liakos2018: {
    ieee: 'K. G. Liakos, P. Busato, D. Moshou, S. Pearson and D. Bochtis, "Machine learning in agriculture: A review," *Sensors*, vol. 18, no. 8, p. 2674, 2018.',
    lit: { who: 'Liakos et al., 2018', approach: 'Review of ML in agriculture.', finding: 'ML widely used for yield, disease, water.', gap: 'Few integrated advisories.' },
  },
  jha2019: {
    ieee: 'K. Jha, A. Doshi, P. Patel and M. Shah, "A comprehensive review on automation in agriculture using artificial intelligence," *Artificial Intelligence in Agriculture*, vol. 2, pp. 1–12, 2019.',
    lit: { who: 'Jha et al., 2019', approach: 'Review of AI-based farm automation.', finding: 'Automation improves efficiency.', gap: 'Calls for low-cost, farmer-friendly tools.' },
  },
  vanklompenburg2020: {
    ieee: 'T. van Klompenburg, A. Kassahun and C. Catal, "Crop yield prediction using machine learning: A systematic literature review," *Computers and Electronics in Agriculture*, vol. 177, p. 105709, 2020.',
    lit: { who: 'van Klompenburg et al., 2020', approach: 'Review of ML yield prediction.', finding: 'Temperature, rainfall, soil most used.', gap: 'Yield not linked to irrigation.' },
  },
  breiman2001: {
    ieee: 'L. Breiman, "Random forests," *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001.',
    lit: { who: 'Breiman, 2001', approach: 'Random Forest ensemble of trees.', finding: 'Robust, with feature importance.', gap: 'Generic algorithm.' },
  },
  friedman2001: {
    ieee: 'J. H. Friedman, "Greedy function approximation: A gradient boosting machine," *The Annals of Statistics*, vol. 29, no. 5, pp. 1189–1232, 2001.',
    lit: { who: 'Friedman, 2001', approach: 'Gradient Boosting of trees.', finding: 'Accurate on tabular data.', gap: 'Needs tuning and validation.' },
  },
  grinsztajn2022: {
    ieee: 'L. Grinsztajn, E. Oyallon and G. Varoquaux, "Why do tree-based models still outperform deep learning on typical tabular data?," in *Advances in Neural Information Processing Systems 35 (Datasets and Benchmarks Track)*, 2022.',
    lit: { who: 'Grinsztajn et al., 2022', approach: 'Benchmark of trees vs deep learning.', finding: 'Trees best on medium tabular data.', gap: 'Justifies model choice.' },
  },
  karpatne2017: {
    ieee: 'A. Karpatne *et al.*, "Theory-guided data science: A new paradigm for scientific discovery from data," *IEEE Transactions on Knowledge and Data Engineering*, vol. 29, no. 10, pp. 2318–2331, Oct. 2017.',
    lit: { who: 'Karpatne et al., 2017', approach: 'Theory-guided data science.', finding: 'Theory helps when labels are scarce.', gap: 'Conceptual; motivates SMA labels.' },
  },
  lundberg2017: {
    ieee: 'S. M. Lundberg and S.-I. Lee, "A unified approach to interpreting model predictions," in *Advances in Neural Information Processing Systems 30*, 2017, pp. 4765–4774.',
    lit: { who: 'Lundberg & Lee, 2017', approach: 'SHAP feature attributions.', finding: 'Consistent local explanations.', gap: 'Costly; SMA uses lighter method.' },
  },
  smith1956: {
    ieee: 'W. E. Smith, "Various optimizers for single-stage production," *Naval Research Logistics Quarterly*, vol. 3, no. 1–2, pp. 59–66, 1956.',
    lit: { who: 'Smith, 1956', approach: 'WSPT single-machine scheduling rule.', finding: 'Optimal weighted completion time.', gap: 'No power windows or feeders.' },
  },
  pinedo2016: {
    ieee: 'M. L. Pinedo, *Scheduling: Theory, Algorithms, and Systems*, 5th ed. Cham, Switzerland: Springer, 2016.',
    lit: { who: 'Pinedo, 2016', approach: 'Scheduling theory textbook.', finding: 'Fast list-scheduling heuristics.', gap: 'Generic; adapted to pumps.' },
  },
  iglewicz1993: {
    ieee: 'B. Iglewicz and D. C. Hoaglin, *How to Detect and Handle Outliers*, ASQC Basic References in Quality Control, vol. 16. Milwaukee, WI, USA: ASQC Quality Press, 1993.',
    lit: { who: 'Iglewicz & Hoaglin, 1993', approach: 'Modified z-score outlier test.', finding: 'Robust flag at |z| > 3.5.', gap: 'Used for sensor-quality flags.' },
  },
  macqueen1967: {
    ieee: 'J. MacQueen, "Some methods for classification and analysis of multivariate observations," in *Proc. 5th Berkeley Symposium on Mathematical Statistics and Probability*, vol. 1, 1967, pp. 281–297.',
    lit: { who: 'MacQueen, 1967', approach: 'K-means clustering.', finding: 'Simple, scalable partitioning.', gap: 'Used for management zones.' },
  },
  pedregosa2011: {
    ieee: 'F. Pedregosa *et al.*, "Scikit-learn: Machine learning in Python," *Journal of Machine Learning Research*, vol. 12, pp. 2825–2830, 2011.',
    lit: { who: 'Pedregosa et al., 2011', approach: 'scikit-learn ML library.', finding: 'Reliable RF, GBM, K-Means.', gap: 'Python runtime; SMA exports JSON.' },
  },
  hastie2009: {
    ieee: 'T. Hastie, R. Tibshirani and J. Friedman, *The Elements of Statistical Learning: Data Mining, Inference, and Prediction*, 2nd ed. New York, NY, USA: Springer, 2009.',
    lit: { who: 'Hastie et al., 2009', approach: 'Statistical learning textbook.', finding: 'Evaluation and ensemble theory.', gap: 'Methodology reference.' },
  },
  boehm1981: {
    ieee: 'B. W. Boehm, *Software Engineering Economics*. Englewood Cliffs, NJ, USA: Prentice-Hall, 1981.',
    lit: { who: 'Boehm, 1981', approach: 'COCOMO effort model.', finding: 'Effort from code size.', gap: 'Used for cost estimation.' },
  },
  dpdp2023: {
    ieee: 'Government of India, "The Digital Personal Data Protection Act, 2023," Act No. 22 of 2023, Ministry of Law and Justice, New Delhi, India, Aug. 2023.',
    lit: { who: 'Government of India, 2023', approach: 'Indian data-protection law.', finding: 'Consent and data minimisation.', gap: 'Guides privacy design.' },
  },
  nodejs: {
    ieee: 'OpenJS Foundation, "Node.js documentation" and "Express – Node.js web application framework." [Online]. Available: https://nodejs.org and https://expressjs.com (accessed Sep. 2026).',
    lit: { who: 'OpenJS Foundation', approach: 'Node.js runtime and Express web framework.', finding: 'Lightweight, event-driven API server.', gap: 'Used to serve SMA models and API.' },
  },
  leaflet: {
    ieee: 'V. Agafonkin *et al.*, "Leaflet – an open-source JavaScript library for interactive maps," and Chart.js contributors, "Chart.js." [Online]. Available: https://leafletjs.com and https://www.chartjs.org (accessed Sep. 2026).',
    lit: { who: 'Agafonkin et al.; Chart.js contributors', approach: 'Open-source web mapping and charting libraries.', finding: 'Interactive maps and charts in the browser.', gap: 'Used for the SMA farm map and dashboards.' },
  },
};
