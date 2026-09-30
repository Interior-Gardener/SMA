module.exports = {
  n: 1,
  title: 'INTRODUCTION',
  blocks: [
    { h2: '1.1 Introduction' },
    { p: 'Sugarcane is one of India\'s most water-intensive crops, needing roughly 1,500–2,500 mm of water per season {cite:fao_sugarcane}, mostly supplied from canals and borewells. KIAAR and Godavari Biorefineries Ltd. (GBL) support about 18,000–25,000 sugarcane farmers across Northern Karnataka {cite:usecase}, whose plots have already been geofenced and whose soil and crop records are held in platforms such as STEPS (Somaiya Technology for Efficient Plot Survey).' },
    { p: 'Satellite remote sensing, the Internet of Things (IoT), weather forecasting and Machine Learning (ML) now allow crop vigour, soil moisture and climate to be estimated for every plot remotely {cite:rouse1974,entekhabi2010,gorelick2017}; agronomy provides the equations that turn them into crop water requirements {cite:allen1998}, and ML is widely used for yield, disease and water management {cite:liakos2018,jha2019}. The domain of this project is therefore **AI-driven precision irrigation and decision support for sugarcane**.' },
    { p: 'This report presents the **Smart Moisture Advisor (SMA)**, an AI irrigation advisory system built for the KJS-AGR-01 use case, combining physics-informed machine learning, a decision engine, pump scheduling and a multilingual web platform. {fig:concept} summarises the idea: SMA *senses* plot conditions, *predicts* water needs and risks with seven ML models, *decides* on concrete actions, *advises* the farmer in their own language and *learns* from the farmer\'s feedback.' },
    { fig: 'uml_concept.png', id: 'concept', caption: 'Concept of the Smart Moisture Advisor: sense, predict, decide, advise and learn', width: 5.8 },

    { h2: '1.2 Problem Definition' },
    { p: 'Sugarcane irrigation scheduling in the target region is largely based on farmers\' experience rather than on the actual water requirement of the crop. Because of limited knowledge of crop water requirements, soil-moisture conditions, weather forecasts and irrigation timing, farmers frequently over-irrigate or delay irrigation {cite:usecase}. The consequences reported by the use case are:' },
    { bullets: [
      '**Water wastage** through over-irrigation, which depletes canals and groundwater.',
      '**Reduced productivity and yield loss** due to moisture stress when irrigation is delayed, particularly during tillering and grand growth, when sugarcane is most sensitive to water deficit {cite:inman2005}.',
      '**Increased energy consumption** and inefficient use of the limited electricity supplied to irrigation pumps.',
      '**Higher cultivation costs** and **nutrient losses** caused by improper fertigation and leaching.',
      '**Difficulty in monitoring** thousands of spatially distributed plots with a limited number of field staff.',
    ] },
    { p: 'The problem addressed by this project can be stated formally as follows. For every geofenced plot *i* with observed satellite, soil and climate features **x**_{i}, an estimated crop age *a*_{i} and a weather scenario **w** (forecast rain, temperature and humidity anomalies, dry days since the last observation), the system must estimate: (a) the number of days until irrigation is required and its uncertainty, (b) the crop water requirement and irrigation depth, converted into water volume and pump run-time for the plot\'s irrigation method, (c) the probability of water stress and of disease or pest risk, (d) the expected yield and the yield loss that would result from delaying irrigation, and (e) a fertigation dose for the current growth stage. These are then converted into a power-constrained pump schedule and plain-language advice in English, Kannada, Hindi or Marathi.' },
    { p: 'A key constraint is that the provided dataset of 1,000 geofenced plots has **no ground-truth labels** (no irrigation logs, volumes or yields), so the system must combine agronomic knowledge with machine learning.' },

    { h2: '1.3 Aim and Objectives' },
    { p: '**Aim:** To design and implement an AI-enabled irrigation advisory system for sugarcane that integrates satellite-derived plot observations, soil properties, weather scenarios and crop-specific requirements to generate plot-specific, explainable and multilingual irrigation, fertigation and pump-scheduling recommendations.' },
    { p: '**Objectives:**' },
    { numbered: [
      'To audit, clean and analyse the dataset of 1,000 sugarcane plots and identify its limitations.',
      'To develop a physics-informed labelling engine based on the FAO-56 crop water balance and the FAO-33 yield-response relationship, so that supervised models can be trained without field labels.',
      'To train and validate ML models for next-irrigation date, crop water requirement, irrigation depth, water-stress probability, yield, yield loss due to delayed irrigation and disease/pest risk, and to compare them against baseline models on plots not seen during training.',
      'To build a decision-support engine that provides rainfall-adjusted irrigation advice, pump run-time, fertigation doses and explanations of each recommendation.',
      'To optimise pump scheduling under limited electricity availability using a weighted scheduling algorithm and compare it with a conventional first-come rotation.',
      'To develop a farmer-friendly web platform with a region dashboard, geofenced farm map, plot advisor, what-if simulator, pump scheduler and a multilingual chatbot, supporting human-in-the-loop feedback.',
      'To follow responsible-AI principles and enable retraining on real KIAAR/GBL field data.',
    ] },

    { h2: '1.4 Organization of the Report' },
    { p: 'The report is organised as follows. **Chapter 2** reviews the literature and identifies research gaps. **Chapter 3** specifies requirements, feasibility, cost and schedule. **Chapter 4** presents the analysis and design with UML and data-flow diagrams, architecture and data design. **Chapter 5** describes the methodology — block diagram, data analysis, physics-informed labelling, models, decision engine, pump scheduling and explainability — with its mathematical formulation. **Chapter 6** explains the implementation with screenshots, modules, API and testing. **Chapter 7** analyses the results and compares SMA with existing systems, and **Chapter 8** concludes with the future scope.' },
  ],
};
