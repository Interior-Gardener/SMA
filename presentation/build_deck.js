/**
 * Builds SMA_Presentation.pptx
 *   cd presentation && npm install && npm run build
 * Screenshots come from presentation/screenshots (see take_screenshots.js);
 * model metrics are read live from ../models/metrics.json.
 */
const path = require('path');
const fs = require('fs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const pptxgen = require('pptxgenjs');
const md = require('react-icons/md');

const metrics = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'models', 'metrics.json'), 'utf8'));
const SHOTS = path.join(__dirname, 'screenshots');

// ---------------------------------------------------------------- palette
const C = {
  dark: '0F2F22', dark2: '164232', green: '1F8A58', leaf: '5FD49A', mint: 'E6F4EC',
  water: '2A78D6', amber: 'EDA100', orange: 'EB6834', red: 'D03B3B',
  ink: '15231C', muted: '5E6B64', line: 'DDE5E0', white: 'FFFFFF', tint: 'F3F7F4',
};
const HEAD = 'Calibri';
const BODY = 'Calibri';

// ---------------------------------------------------------------- helpers
async function icon(name, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(md[name], { color: `#${color}`, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return `image/png;base64,${buf.toString('base64')}`;
}

async function crop(file, box) {
  const src = path.join(SHOTS, file);
  const img = box ? sharp(src).extract(box) : sharp(src);
  const buf = await img.png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { data: `image/png;base64,${buf.toString('base64')}`, ratio: meta.width / meta.height };
}

const shadow = () => ({ type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.12 });

function text(slide, str, opts) {
  slide.addText(str, { fontFace: BODY, color: C.ink, isTextBox: true, margin: 0, ...opts });
}

function title(slide, t, sub) {
  text(slide, t, { x: 0.6, y: 0.4, w: 12.1, h: 0.75, fontFace: HEAD, fontSize: 32, bold: true, color: C.ink });
  if (sub) text(slide, sub, { x: 0.6, y: 1.12, w: 12.1, h: 0.4, fontSize: 15, color: C.muted });
}

function card(slide, x, y, w, h, fill = C.white) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: C.line, width: 0.75 }, shadow: shadow() });
}

async function iconBubble(slide, name, x, y, d = 0.62, bg = C.green, fg = C.white) {
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg } });
  const pad = d * 0.22;
  slide.addImage({ data: await icon(name, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
}

function picture(slide, img, x, y, w, maxH) {
  let pw = w;
  let ph = w / img.ratio;
  if (maxH && ph > maxH) { ph = maxH; pw = ph * img.ratio; }
  slide.addShape('rect', { x: x - 0.03, y: y - 0.03, w: pw + 0.06, h: ph + 0.06, fill: { color: C.line }, line: { color: C.line }, shadow: shadow() });
  slide.addImage({ data: img.data, x, y, w: pw, h: ph });
  return { w: pw, h: ph };
}

function footer(slide, n) {
  text(slide, `SMA · Smart Moisture Advisor   |   Kartik Verma · Kushal Soni   |   ${n}`, { x: 0.6, y: 7.08, w: 12.1, h: 0.25, fontSize: 9.5, color: '8A948F', align: 'right' });
}

// ---------------------------------------------------------------- build
(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pres.author = 'Kartik Verma, Kushal Soni';
  pres.company = 'K J Somaiya Institute of Technology';
  pres.title = 'SMA - Smart Moisture Advisor';

  const m = metrics.models;
  const shots = {
    overview: await crop('01_overview.png'),
    advisor: await crop('03_advisor.png', { left: 354, top: 270, width: 1806, height: 1080 }),
    kannada: await crop('04_advisor_kannada.png', { left: 380, top: 420, width: 1160, height: 820 }),
    scheduler: await crop('07_scheduler.png', { left: 380, top: 700, width: 1780, height: 650 }),
  };
  let n = 0;

  // ============================================================ 1. Title
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.dark };
    s.addImage({ data: shots.overview.data, x: 6.9, y: 1.0, w: 7.6, h: 7.6 / shots.overview.ratio, transparency: 0 });
    s.addShape('rect', { x: 0, y: 0, w: 7.2, h: 7.5, fill: { color: C.dark }, line: { color: C.dark } });
    await iconBubble(s, 'MdWaterDrop', 0.7, 0.8, 0.9, C.leaf, C.dark);
    text(s, 'SMA', { x: 0.7, y: 2.0, w: 6, h: 1.1, fontFace: HEAD, fontSize: 72, bold: true, color: C.white, charSpacing: 4 });
    text(s, 'Smart Moisture Advisor', { x: 0.7, y: 3.05, w: 6.3, h: 0.6, fontSize: 28, color: C.leaf, bold: true });
    text(s, 'AI-driven irrigation advisory for sugarcane - when to irrigate, how long, how much fertiliser, and what is at stake if you wait.', { x: 0.7, y: 3.8, w: 6.1, h: 1.0, fontSize: 16, color: 'D8EADF' });
    text(s, [
      { text: 'Presented by', options: { fontSize: 12, color: '9FC2AE', breakLine: true } },
      { text: 'Kartik Verma  ·  Kushal Soni', options: { fontSize: 20, bold: true, color: C.white } },
    ], { x: 0.7, y: 5.2, w: 6.2, h: 0.8 });
    text(s, 'Use case KJS-AGR-01 · K J Somaiya Institute of Technology × KIAAR × Godavari Biorefineries', { x: 0.7, y: 6.55, w: 6.3, h: 0.5, fontSize: 11, color: '9FC2AE' });
    s.addNotes(`[Kartik] Good morning, Professor. We are Kartik Verma and Kushal Soni. Our project is SMA, the Smart Moisture Advisor. It is our solution to use case KJS-AGR-01, an irrigation advisory system for sugarcane.
In one line: SMA takes satellite, soil and weather data for every geofenced plot and tells the farmer when to irrigate, how long to run the pump, how much fertiliser to give, and what they lose if they wait. It speaks the farmer's own language.
We will cover the problem, our data and machine-learning approach, a live demo of the web platform, the results, and what comes next.`);
  }

  // ============================================================ 2. Problem
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Irrigation today is guesswork', 'Sugarcane is one of India\'s thirstiest crops, and most irrigation decisions come from habit, not data');
    const stats = [
      ['18-25k', 'sugarcane farmers in the GBL / KIAAR network'],
      ['1,500-2,500 mm', 'water needed by one sugarcane crop (FAO)'],
      ['1000s', 'scattered plots - impossible to monitor by hand'],
    ];
    stats.forEach(([v, l], i) => {
      const y = 1.85 + i * 1.62;
      card(s, 0.6, y, 4.3, 1.4, C.mint);
      text(s, v, { x: 0.85, y: y + 0.18, w: 3.9, h: 0.7, fontSize: v.length > 8 ? 28 : 34, bold: true, color: C.green });
      text(s, l, { x: 0.85, y: y + 0.86, w: 3.9, h: 0.4, fontSize: 13, color: C.ink });
    });
    const probs = [
      ['MdWaterDamage', 'Water wastage', 'Over-irrigation drains aquifers and canals'],
      ['MdTrendingDown', 'Yield loss', 'Delayed irrigation → moisture stress'],
      ['MdElectricBolt', 'Wasted electricity', 'Pumps run hours longer than needed'],
      ['MdScience', 'Nutrient losses', 'Fertiliser leaches with excess water'],
      ['MdCurrencyRupee', 'Higher costs', 'Water, power and fertiliser all add up'],
      ['MdMap', 'No visibility', 'Factories cannot see field stress early'],
    ];
    for (let i = 0; i < probs.length; i += 1) {
      const [ic, h, d] = probs[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 5.3 + col * 3.75;
      const y = 1.85 + row * 1.62;
      card(s, x, y, 3.5, 1.4);
      await iconBubble(s, ic, x + 0.22, y + 0.22, 0.6, i < 2 ? C.red : C.orange);
      text(s, h, { x: x + 1.0, y: y + 0.22, w: 2.35, h: 0.4, fontSize: 16, bold: true });
      text(s, d, { x: x + 1.0, y: y + 0.66, w: 2.35, h: 0.6, fontSize: 12, color: C.muted });
    }
    footer(s, n);
    s.addNotes(`[Kartik] The problem statement from KIAAR and Godavari Biorefineries is simple. Between 18 and 25 thousand farmers grow sugarcane in this network. One sugarcane crop needs 1,500 to 2,500 millimetres of water, and today farmers decide when to irrigate from experience.
That leads to two opposite mistakes. Over-irrigation wastes water, electricity and fertiliser. Delayed irrigation causes moisture stress and lost yield. With thousands of scattered plots, no field team can watch every farm.
So the question we set out to answer was: can we give every plot its own scientific irrigation decision, automatically, every day?`);
  }

  // ============================================================ 3. Solution
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'SMA answers four questions for every plot', 'From satellite pixels to a one-line instruction a farmer can act on');
    const qs = [
      ['MdSchedule', 'When should I irrigate?', 'Next-irrigation date with uncertainty, rain-adjusted'],
      ['MdTimer', 'How long do I run the pump?', 'Depth → water volume → pump hours by method'],
      ['MdGrass', 'How much fertiliser?', 'Stage-wise NPK split into urea, 12-61-0, MOP'],
      ['MdWarning', 'What if I wait?', 'Yield loss curve for 0-14 days of delay'],
    ];
    for (let i = 0; i < 4; i += 1) {
      const x = 0.6 + i * 3.08;
      card(s, x, 1.8, 2.85, 2.3);
      await iconBubble(s, qs[i][0], x + 0.25, 2.05, 0.7);
      text(s, qs[i][1], { x: x + 0.25, y: 2.9, w: 2.4, h: 0.5, fontSize: 16, bold: true });
      text(s, qs[i][2], { x: x + 0.25, y: 3.4, w: 2.4, h: 0.6, fontSize: 12, color: C.muted });
    }
    const flow = [
      ['MdSatelliteAlt', 'Data', 'NDVI · LAI · soil moisture\npH · organic C · weather'],
      ['MdPsychology', '7 ML models', 'Random Forest &\nGradient Boosting'],
      ['MdRule', 'Decision engine', 'Rain adjustment · fertigation\npump scheduling'],
      ['MdTranslate', 'Advisory', 'EN · ಕನ್ನಡ · हिंदी · मराठी\nweb · chatbot · SMS'],
    ];
    for (let i = 0; i < 4; i += 1) {
      const x = 0.6 + i * 3.08;
      s.addShape('roundRect', { x, y: 4.55, w: 2.85, h: 1.9, rectRadius: 0.12, fill: { color: i === 1 ? C.green : C.dark }, line: { color: i === 1 ? C.green : C.dark } });
      s.addImage({ data: await icon(flow[i][0], C.leaf), x: x + 0.25, y: 4.78, w: 0.45, h: 0.45 });
      text(s, flow[i][1], { x: x + 0.85, y: 4.8, w: 1.9, h: 0.4, fontSize: 17, bold: true, color: C.white });
      text(s, flow[i][2], { x: x + 0.25, y: 5.45, w: 2.5, h: 0.85, fontSize: 12, color: 'D8EADF' });
      if (i < 3) text(s, '›', { x: x + 2.86, y: 5.1, w: 0.22, h: 0.6, fontSize: 30, bold: true, color: C.green, align: 'center' });
    }
    footer(s, n);
    s.addNotes(`[Kartik] SMA answers four practical questions for every plot. When should I irrigate? How long should the pump run? How much fertiliser should I apply this week? And what will it cost me if I wait?
The pipeline underneath is shown at the bottom. Satellite and soil data go into seven machine-learning models. A decision engine adds rain adjustment, fertigation rules and pump scheduling. The output is a plain-language advisory in English, Kannada, Hindi or Marathi.`);
  }

  // ============================================================ 4. Dataset
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'The dataset: 1,000 geofenced plots in Mandya', 'Satellite and soil features per plot, but no irrigation logs or yield records');
    const st = [['1,000', 'plots'], ['736 ha', 'area'], ['6', 'taluks'], ['10', 'villages']];
    st.forEach(([v, l], i) => {
      const x = 0.6 + i * 1.55;
      card(s, x, 1.8, 1.4, 1.15, C.mint);
      text(s, v, { x: x + 0.05, y: 1.92, w: 1.3, h: 0.55, fontSize: 21, bold: true, color: C.green, align: 'center' });
      text(s, l, { x: x + 0.1, y: 2.5, w: 1.2, h: 0.3, fontSize: 12, color: C.muted, align: 'center' });
    });
    text(s, 'Features used', { x: 0.6, y: 3.25, w: 6, h: 0.35, fontSize: 15, bold: true });
    const feats = ['NDVI', 'LAI', 'Soil moisture', 'Soil pH', 'Organic carbon', 'Rainfall', 'Temperature', 'Humidity', 'Plot polygon'];
    feats.forEach((f, i) => {
      const x = 0.6 + (i % 3) * 2.05;
      const y = 3.7 + Math.floor(i / 3) * 0.5;
      s.addShape('roundRect', { x, y, w: 1.9, h: 0.38, rectRadius: 0.19, fill: { color: C.tint }, line: { color: C.line, width: 0.75 } });
      text(s, f, { x, y, w: 1.9, h: 0.38, fontSize: 12, align: 'center', valign: 'middle' });
    });
    text(s, 'What our data audit found', { x: 0.6, y: 5.35, w: 6, h: 0.35, fontSize: 15, bold: true });
    text(s, [
      { text: 'No target labels: nothing says when a plot was irrigated or what it yielded', options: { bullet: true, breakLine: true } },
      { text: '6 NDVI gaps (cloud) → filled with the village median', options: { bullet: true, breakLine: true } },
      { text: 'Area, district and sampling method are constant → dropped', options: { bullet: true, breakLine: true } },
      { text: 'Temperature, humidity and rainfall correlated up to r = −0.94', options: { bullet: true } },
    ], { x: 0.6, y: 5.72, w: 6.2, h: 1.3, fontSize: 12.5, color: C.ink, paraSpaceAfter: 3 });

    const hist = [3, 9, 9, 35, 70, 101, 199, 209, 158, 152, 44, 11];
    const labels = ['0.25', '0.30', '0.34', '0.39', '0.43', '0.48', '0.53', '0.57', '0.62', '0.66', '0.71', '0.75'];
    card(s, 7.1, 1.8, 5.65, 5.1);
    s.addChart(pres.charts.BAR, [{ name: 'Plots', labels, values: hist }], {
      x: 7.3, y: 1.95, w: 5.3, h: 4.8, barDir: 'col', chartColors: [C.green], barGapWidthPct: 25,
      showTitle: true, title: 'NDVI distribution across plots', titleFontSize: 14, titleColor: C.ink, titleFontFace: BODY,
      showLegend: false, showValue: false,
      catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
      valGridLine: { color: 'E6EAE7', size: 0.5 }, catGridLine: { style: 'none' },
      showCatAxisTitle: true, catAxisTitle: 'NDVI (crop vigour)', catAxisTitleColor: C.muted, catAxisTitleFontSize: 11,
    });
    footer(s, n);
    s.addNotes(`[Kartik] The dataset has 1,000 geofenced sugarcane plots across 6 taluks and 10 villages of Mandya district. For each plot we get NDVI, leaf area index, soil moisture, pH, organic carbon, rainfall, temperature, humidity and the plot boundary polygon.
Before modelling we audited the data. The most important finding: there are no labels. Nothing tells us when a plot was irrigated or what it yielded, so plain supervised learning is impossible. We also found 6 NDVI values missing because of cloud, which we filled with the village median. Three columns are constant, and the weather variables are strongly correlated with each other. The chart shows NDVI is fairly normal, centred around 0.58.`);
  }

  // ============================================================ 5. Physics-informed ML
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'No labels? We taught the models agronomy', 'Physics-informed machine learning: science creates the labels, trees learn the fast surrogate');
    const steps = [
      ['MdGrain', '1,000 real plots', 'Observed satellite, soil and climate features'],
      ['MdAutoGraph', '× 12 seasonal scenarios', 'Crop age 0-365 days, heat waves, dry spells, rain forecasts → 12,000 rows'],
      ['MdScience', 'Agronomy labels', 'FAO-56 water balance (ET₀, Kc, root depth, TAW/RAW) + FAO-33 yield response (Ky = 1.2)'],
      ['MdSensors', '+ field noise', 'Realistic sensor & weather error so models cannot memorise the formula'],
      ['MdPsychology', 'Tree ensembles', 'Train on 800 plots, test on 200 unseen plots (no leakage)'],
    ];
    for (let i = 0; i < steps.length; i += 1) {
      const y = 1.8 + i * 1.0;
      await iconBubble(s, steps[i][0], 0.6, y, 0.72, i === 2 ? C.water : C.green);
      text(s, steps[i][1], { x: 1.55, y: y + 0.02, w: 5.2, h: 0.36, fontSize: 16, bold: true });
      text(s, steps[i][2], { x: 1.55, y: y + 0.38, w: 5.3, h: 0.45, fontSize: 12, color: C.muted });
    }
    s.addShape('roundRect', { x: 7.3, y: 1.8, w: 5.45, h: 2.55, rectRadius: 0.12, fill: { color: C.dark }, line: { color: C.dark } });
    text(s, 'Why not just use the formula?', { x: 7.6, y: 2.0, w: 4.9, h: 0.4, fontSize: 17, bold: true, color: C.leaf });
    text(s, [
      { text: 'Real field labels (irrigation logs, yields) can replace the synthetic ones with zero code changes: npm run train', options: { bullet: true, breakLine: true } },
      { text: 'Ensembles give uncertainty (± days) and feature importance', options: { bullet: true, breakLine: true } },
      { text: 'Robust to noisy, missing and correlated sensor data', options: { bullet: true } },
    ], { x: 7.6, y: 2.45, w: 4.95, h: 1.8, fontSize: 13, color: 'E3F0E8', paraSpaceAfter: 4 });
    card(s, 7.3, 4.6, 5.45, 2.3, C.mint);
    text(s, 'Key agronomy in one line', { x: 7.6, y: 4.78, w: 4.9, h: 0.35, fontSize: 15, bold: true, color: C.green });
    text(s, 'Days to irrigate = (RAW − current depletion + effective rain) ÷ crop water use', { x: 7.6, y: 5.2, w: 4.95, h: 0.75, fontSize: 15, italic: true, color: C.ink });
    text(s, 'RAW = readily available water in the root zone, ETc = Kc × ET₀ (Hargreaves).', { x: 7.6, y: 6.0, w: 4.95, h: 0.6, fontSize: 12, color: C.muted });
    footer(s, n);
    s.addNotes(`[Kartik] This is the key idea of the project. Since there are no labels, we used agronomic science to create them. This approach is called physics-informed machine learning.
We took every real plot and generated 12 seasonal scenarios: different crop ages, heat waves, dry spells and rain forecasts. That gives 12,000 training rows. For each row we computed the ground truth with FAO-56, the international standard for crop water balance, and FAO-33 for how yield responds to water stress. Then we added realistic noise, so the models learn patterns and not just the formula.
Why not use the formula directly? Three reasons. First, when KIAAR provides real irrigation logs, we retrain on real labels with one command and no code changes. Second, the ensembles give us uncertainty and explanations. Third, they cope better with noisy and missing sensor data.
We split train and test by plot, so the model is always tested on plots it has never seen.`);
  }

  // ============================================================ 6. Model accuracy
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Seven models, all beating their baselines', 'Evaluated on 200 plots never seen during training');
    const reg = ['next_irrigation', 'water_requirement', 'irrigation_depth', 'yield', 'yield_loss'];
    const names = ['Next irrigation', 'Water requirement', 'Irrigation depth', 'Cane yield', 'Yield loss (delay)'];
    card(s, 0.6, 1.75, 7.0, 5.15);
    s.addChart(pres.charts.BAR, [
      { name: 'SMA model', labels: names, values: reg.map((k) => m[k].test.r2) },
      { name: 'Linear baseline', labels: names, values: reg.map((k) => m[k].baseline.r2) },
    ], {
      x: 0.8, y: 1.9, w: 6.6, h: 4.9, barDir: 'bar', barGrouping: 'clustered', chartColors: [C.green, 'B9C4BE'], barGapWidthPct: 45,
      showTitle: true, title: 'R² on unseen plots (higher is better)', titleFontSize: 14, titleColor: C.ink, titleFontFace: BODY,
      showLegend: true, legendPos: 't', legendFontSize: 11, legendColor: C.muted,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10, dataLabelColor: C.ink, dataLabelFormatCode: '0.00',
      valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
      catAxisLabelColor: C.ink, catAxisLabelFontSize: 11, catAxisOrientation: 'maxMin',
    });
    const clf = [['water_stress', 'Water-stress probability', 'MdThermostat'], ['disease_risk', 'Disease & pest risk', 'MdPestControl']];
    for (let i = 0; i < clf.length; i += 1) {
      const [k, t, ic] = clf[i];
      const y = 1.75 + i * 1.75;
      card(s, 7.9, y, 4.85, 1.55);
      await iconBubble(s, ic, 8.12, y + 0.25, 0.6, C.water);
      text(s, t, { x: 8.9, y: y + 0.2, w: 3.7, h: 0.35, fontSize: 15, bold: true });
      text(s, `${(m[k].test.accuracy * 100).toFixed(1)}%`, { x: 8.9, y: y + 0.58, w: 1.7, h: 0.55, fontSize: 28, bold: true, color: C.water });
      text(s, `accuracy · F1 ${m[k].test.f1_macro.toFixed(2)}\nlogistic baseline ${(m[k].baseline.accuracy * 100).toFixed(1)}%`, { x: 10.6, y: y + 0.62, w: 2.1, h: 0.6, fontSize: 11, color: C.muted });
    }
    card(s, 7.9, 5.25, 4.85, 1.65, C.mint);
    await iconBubble(s, 'MdVerified', 8.12, 5.5, 0.6);
    text(s, 'Runs natively in Node.js', { x: 8.9, y: 5.42, w: 3.7, h: 0.35, fontSize: 15, bold: true });
    text(s, 'Trees exported to JSON. 23 automated tests prove the JavaScript predictions match scikit-learn exactly. All 1,000 plots scored in < 0.3 s.', { x: 8.9, y: 5.8, w: 3.7, h: 1.0, fontSize: 11.5, color: C.muted });
    footer(s, n);
    s.addNotes(`[Kartik] Here are the results on 200 plots the models never saw. The chart compares R-squared of our models, in green, against a linear-regression baseline, in grey. Every model clearly beats its baseline. The biggest gains are for irrigation depth and yield loss, which are strongly non-linear. That is exactly why we chose tree ensembles.
Next irrigation date: R-squared ${m.next_irrigation.test.r2.toFixed(2)}, an average error of ${m.next_irrigation.test.mae.toFixed(1)} days. The two classifiers, water stress and disease risk, reach about 87 to 88 percent accuracy, and most of their errors are between neighbouring classes such as mild versus moderate.
One engineering point: we export the trained trees to JSON and run them natively in Node.js. Automated tests confirm the JavaScript gives exactly the same predictions as Python. The whole region is scored in under a third of a second.`);
  }

  // ============================================================ 7. Coverage
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'All 11 models from the use case - implemented', 'Plus one extra: unsupervised management zones');
    const cov = [
      ['Next irrigation date', 'Random Forest + uncertainty'],
      ['Irrigation duration', 'GBM depth → pump hours'],
      ['Crop water requirement', 'GBM regressor (ETc)'],
      ['Water stress probability', 'RF 4-class probabilities'],
      ['Rainfall-adjusted advice', 'Forecast input + counterfactual'],
      ['Yield loss from delay', 'GBM with delay as input'],
      ['Pump scheduling', 'WSPT optimisation'],
      ['Fertigation', 'Stage-wise NPK engine'],
      ['Disease & stress forecast', 'RF risk classifier + rules'],
      ['Yield prediction', 'GBM regressor (t/ha)'],
      ['Farmer advisory (LLM-ready)', '4 languages, voice, chatbot'],
      ['Management zones ★', 'K-Means clustering'],
    ];
    const check = await icon('MdCheckCircle', C.green);
    const star = await icon('MdCheckCircle', C.water);
    cov.forEach(([h, d], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.6 + col * 4.1;
      const y = 1.8 + row * 1.28;
      card(s, x, y, 3.85, 1.08, i === 11 ? 'EAF2FC' : C.white);
      s.addImage({ data: i === 11 ? star : check, x: x + 0.22, y: y + 0.3, w: 0.46, h: 0.46 });
      text(s, h, { x: x + 0.85, y: y + 0.2, w: 2.9, h: 0.36, fontSize: 14.5, bold: true });
      text(s, d, { x: x + 0.85, y: y + 0.58, w: 2.9, h: 0.32, fontSize: 12, color: C.muted });
    });
    footer(s, n);
    s.addNotes(`[Kartik] The use-case document lists eleven AI models. This slide maps each one to what we built. Seven are machine-learning models. Pump scheduling is an optimisation algorithm. Fertigation and advisory generation are decision engines on top of the model outputs.
For the LLM-based advisory, we deliberately used templates in four languages for now. Every sentence is predictable and auditable, and the same structured output can be handed to an LLM later. We also added management zones, which group similar plots so agronomists can plan by zone.
Now Kushal will show you the platform.`);
  }

  // ============================================================ 8. Dashboard
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Live demo · Region-wide dashboard', 'Scenario "Summer dry spell": 7 dry days since the satellite pass, +8 °C');
    picture(s, shots.overview, 0.6, 1.75, 8.2, 5.2);
    const call = [
      ['637', 'plots must irrigate today', C.red],
      ['204', 'plots under moderate or severe stress', C.orange],
      ['790 t', 'of cane at risk if irrigation slips 5 days', C.amber],
      ['4 presets', 'switch weather scenarios live in the demo', C.green],
    ];
    call.forEach(([v, l, col], i) => {
      const y = 1.75 + i * 1.3;
      card(s, 9.15, y, 3.6, 1.12);
      text(s, v, { x: 9.4, y: y + 0.12, w: 3.2, h: 0.5, fontSize: 26, bold: true, color: col });
      text(s, l, { x: 9.4, y: y + 0.64, w: 3.2, h: 0.4, fontSize: 12, color: C.muted });
    });
    footer(s, n);
    s.addNotes(`[Kushal] This is the SMA web platform. It is built with Node.js and runs entirely on a laptop. On the overview page, the supervisor sees the whole region at a glance.
We selected the "Summer dry spell" scenario: seven dry days after the satellite pass and eight degrees hotter. The models now say 637 plots must irrigate today and 212 tomorrow. 204 plots are under moderate or severe stress, and about 790 tonnes of cane are at risk if irrigation slips by five days.
The irrigation calendar shows the water demand for the next 14 days, which helps the factory and the electricity department plan. At the top, these weather presets let us change conditions live. I will use them in the demo.
[DEMO: click "Satellite snapshot", then "Summer dry spell", and point at the KPI cards changing.]`);
  }

  // ============================================================ 9. Advisor
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Plot-level advisory a farmer can act on', 'Plot MM-MD-0110 · Bheemanahalli, Malavalli');
    picture(s, shots.advisor, 0.6, 1.75, 7.6, 5.2);
    picture(s, shots.kannada, 8.55, 1.75, 4.2, 2.9);
    const feats = [
      ['MdTranslate', 'English · ಕನ್ನಡ · हिंदी · मराठी'],
      ['MdRecordVoiceOver', 'Read aloud for low-literacy users'],
      ['MdInsights', '"Why this advice?" explanations'],
      ['MdHowToReg', 'Accept / override → retraining data'],
    ];
    for (let i = 0; i < feats.length; i += 1) {
      const y = 4.95 + i * 0.5;
      await iconBubble(s, feats[i][0], 8.55, y, 0.38);
      text(s, feats[i][1], { x: 9.05, y: y + 0.02, w: 3.7, h: 0.36, fontSize: 12.5, valign: 'middle' });
    }
    footer(s, n);
    s.addNotes(`[Kushal] Clicking any plot opens the Farm Advisor. For plot MM-MD-0110 the banner says: irrigate today, about 22 hours of pumping, 1,120 cubic metres of water.
Below that is the farmer advisory. The same content appears in Kannada, Hindi or Marathi, and it can be read aloud or copied as an SMS or WhatsApp message. On the right are the probabilities. We show the full distribution, not just a label, so the farmer sees how confident the model is.
Further down are the 14-day root-zone moisture projection, the yield-loss curve if irrigation is delayed, the fertigation plan and a "Why this advice?" panel. For example, it says soil moisture is the main reason irrigation came 4.8 days earlier.
Finally, farmers and supervisors can accept or override the advice. Every override is logged as training data. This is the human-in-the-loop design the use case asks for.
[DEMO: switch language to Kannada, press Read aloud, scroll to the charts, click Accept.]`);
  }

  // ============================================================ 10. Rain-aware
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Rain-aware: skip pumping when rain is coming', 'Same dry spell, but the forecast now shows 40 mm of rain in 3 days');
    const rows = [
      ['Plots told to irrigate today', '637', '0'],
      ['Plots postponed because of rain', '0', '894'],
      ['Water to pump this week', '387k m³', '62k m³'],
      ['Rain used instead of pumping', '-', '218k m³'],
    ];
    card(s, 0.6, 1.8, 7.2, 5.1);
    text(s, 'Without forecast', { x: 4.1, y: 2.0, w: 1.7, h: 0.4, fontSize: 13, bold: true, color: C.muted, align: 'center' });
    text(s, 'With 40 mm forecast', { x: 5.85, y: 2.0, w: 1.8, h: 0.4, fontSize: 13, bold: true, color: C.water, align: 'center' });
    rows.forEach(([l, a, b], i) => {
      const y = 2.6 + i * 1.05;
      s.addShape('line', { x: 0.85, y: y - 0.12, w: 6.75, h: 0, line: { color: C.line, width: 0.75 } });
      text(s, l, { x: 0.9, y, w: 3.1, h: 0.8, fontSize: 15, valign: 'middle' });
      text(s, a, { x: 4.1, y, w: 1.7, h: 0.8, fontSize: 24, bold: true, color: C.muted, align: 'center', valign: 'middle' });
      text(s, b, { x: 5.85, y, w: 1.8, h: 0.8, fontSize: 24, bold: true, color: C.water, align: 'center', valign: 'middle' });
    });
    s.addShape('roundRect', { x: 8.1, y: 1.8, w: 4.65, h: 5.1, rectRadius: 0.12, fill: { color: C.dark }, line: { color: C.dark } });
    s.addImage({ data: await icon('MdCloud', C.leaf), x: 8.45, y: 2.1, w: 0.8, h: 0.8 });
    text(s, 'How it works', { x: 8.45, y: 3.05, w: 4.0, h: 0.45, fontSize: 18, bold: true, color: C.white });
    text(s, [
      { text: 'Forecast rain is a model input, so the Random Forest learns how much of it reaches the root zone', options: { bullet: true, breakLine: true } },
      { text: 'SMA also predicts a "no-rain" counterfactual; if rain moves the date, the advice becomes "skip"', options: { bullet: true, breakLine: true } },
      { text: 'Plug in the IMD / weather API forecast and this runs daily for all plots', options: { bullet: true } },
    ], { x: 8.45, y: 3.55, w: 4.05, h: 3.1, fontSize: 13, color: 'E3F0E8', paraSpaceAfter: 6, valign: 'top' });
    footer(s, n);
    s.addNotes(`[Kushal] This is my favourite part of the demo. We keep the same dry spell, but the forecast now shows 40 millimetres of rain in the next three days.
Immediately, the 637 "irrigate today" alerts drop to zero. 894 plots are told to skip, because the rain will do the job. Water to pump this week falls from 387 thousand cubic metres to 62 thousand. About 218 thousand cubic metres of rainwater is used instead of pumped groundwater.
Technically, forecast rain is an input to the model. We also run a "no-rain" counterfactual prediction. If the rain moves the irrigation date, the advice changes to "skip". In production, this input would come from the IMD forecast API every day.
[DEMO: click "Dry spell + rain forecast" and show the KPI cards.]`);
  }

  // ============================================================ 11. Pump scheduling
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Pump scheduling under limited 3-phase power', 'Village Hosur · 2 power windows (7 h/day) · 20 pumps per feeder · 3-day horizon');
    picture(s, shots.scheduler, 0.6, 1.75, 8.2, 3.2);
    card(s, 0.6, 5.25, 8.2, 1.65, C.mint);
    text(s, 'Algorithm: Weighted Shortest Processing Time (Smith\'s rule)', { x: 0.85, y: 5.4, w: 7.8, h: 0.38, fontSize: 15, bold: true, color: C.green });
    text(s, 'Priority = cane at risk (from the yield-loss model) ÷ pumping hours. Plots are packed into the power windows without exceeding the feeder limit. Pumps pause when power goes off and resume in the next window.', { x: 0.85, y: 5.82, w: 7.7, h: 0.95, fontSize: 12.5 });
    const res = [
      ['5.4 t', 'cane loss avoided vs a first-come rotation', C.green],
      ['7 / 14', 'high-stress plots served (rotation: 2 / 14)', C.water],
      ['81 h vs 115 h', 'average finish time for high-stress plots', C.orange],
    ];
    res.forEach(([v, l, col], i) => {
      const y = 1.75 + i * 1.75;
      card(s, 9.15, y, 3.6, 1.5);
      text(s, v, { x: 9.4, y: y + 0.2, w: 3.2, h: 0.6, fontSize: 28, bold: true, color: col });
      text(s, l, { x: 9.4, y: y + 0.85, w: 3.2, h: 0.5, fontSize: 12, color: C.muted });
    });
    footer(s, n);
    s.addNotes(`[Kushal] Knowing who needs water is not enough. In Karnataka, farm pumps get three-phase power only for about seven hours a day, and a feeder can only run a limited number of pumps at once. So who should pump first?
We treat it as a scheduling problem. Each plot is a job. Its weight is the tonnes of cane at risk, predicted by our yield-loss model, and its length is the pumping time. We order jobs by weight divided by length. This is the Weighted Shortest Processing Time rule, or Smith's rule, which is optimal for minimising weighted completion time on one machine. Then we pack the jobs into the power windows.
For Hosur village over three days, compared with a first-come rotation, the optimised plan avoids about 5.4 tonnes of cane loss. It serves 7 of the 14 high-stress plots instead of 2, and finishes them 34 hours earlier on average. The Gantt chart shows the actual pump timetable.
[DEMO: open Pump Scheduler, click Optimise, toggle between "SMA optimised" and "Rotation".]`);
  }

  // ============================================================ 12. Impact
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.dark };
    text(s, 'Estimated impact across the 1,000 plots', { x: 0.6, y: 0.45, w: 12, h: 0.7, fontSize: 32, bold: true, color: C.white });
    text(s, 'Model estimates vs farmers\' fixed practice (≈70 mm every 8 days), satellite-snapshot conditions', { x: 0.6, y: 1.15, w: 12, h: 0.4, fontSize: 15, color: '9FC2AE' });
    const big = [
      ['38%', 'less irrigation water with furrow irrigation', 'MdOpacity'],
      ['56%', 'less water when combined with drip', 'MdWaterDrop'],
      ['12.9k kWh', 'pump energy saved per week', 'MdBolt'],
      ['172k m³', 'water saved per week, about 69 Olympic pools', 'MdSavings'],
    ];
    for (let i = 0; i < big.length; i += 1) {
      const x = 0.6 + i * 3.1;
      s.addShape('roundRect', { x, y: 2.0, w: 2.85, h: 3.2, rectRadius: 0.12, fill: { color: C.dark2 }, line: { color: '2A5A45' } });
      s.addImage({ data: await icon(big[i][2], C.leaf), x: x + 0.3, y: 2.3, w: 0.6, h: 0.6 });
      text(s, big[i][0], { x: x + 0.3, y: 3.1, w: 2.45, h: 0.9, fontSize: big[i][0].length > 7 ? 27 : big[i][0].length > 5 ? 34 : 44, bold: true, color: C.white });
      text(s, big[i][1], { x: x + 0.3, y: 4.1, w: 2.4, h: 0.9, fontSize: 13, color: 'D8EADF' });
    }
    text(s, [
      { text: 'Beyond water: ', options: { bold: true, color: C.leaf } },
      { text: 'earlier stress and disease alerts, rain-aware postponement, fair pump timetables, and a 14-day water demand forecast the sugar factory can plan with.', options: { color: 'D8EADF' } },
    ], { x: 0.6, y: 5.6, w: 12.1, h: 0.8, fontSize: 15 });
    footer(s, n);
    s.addNotes(`[Kushal] What could this mean at scale? Under normal satellite conditions, the recommended schedule uses about 38 percent less water than the fixed practice of roughly 70 millimetres every 8 days. With drip irrigation the saving rises to about 56 percent. Across these 1,000 plots that is about 172 thousand cubic metres of water and 12,900 kilowatt-hours of pump energy every week.
Please note these are model estimates against a documented baseline, not field-measured results. Validating them in the field is the first item on our roadmap.
Beyond water, SMA gives early stress and disease alerts, fair pump timetables, and a 14-day water-demand forecast the factory can plan with.`);
  }

  // ============================================================ 13. Responsible AI
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Responsible, explainable, human-in-the-loop', 'Designed around the governance section of the use case');
    const gov = [
      ['MdLock', 'Privacy (DPDP)', 'Anonymised plot IDs only; no farmer names or phone numbers stored; minimal feedback log'],
      ['MdVisibility', 'Explainability', 'Per-feature "why" vs regional median, probability bars, ± days uncertainty'],
      ['MdPeople', 'Human in the loop', 'Accept / override on every advisory; overrides become retraining data'],
      ['MdBalance', 'Fair evaluation', 'Tested on unseen plots across all 6 taluks; zones expose soil / climate differences'],
      ['MdSecurity', 'Security', 'Input validation and clamping on every API; no secrets in code; small attack surface'],
      ['MdFactCheck', 'Honest limits', 'Labels are agronomy-derived until real KIAAR data arrives, and we say so in the app'],
    ];
    for (let i = 0; i < gov.length; i += 1) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.6 + col * 4.1;
      const y = 1.85 + row * 2.55;
      card(s, x, y, 3.85, 2.3);
      await iconBubble(s, gov[i][0], x + 0.25, y + 0.25, 0.7);
      text(s, gov[i][1], { x: x + 1.12, y: y + 0.38, w: 2.6, h: 0.45, fontSize: 17, bold: true });
      text(s, gov[i][2], { x: x + 0.25, y: y + 1.15, w: 3.4, h: 1.0, fontSize: 12.5, color: C.muted });
    }
    footer(s, n);
    s.addNotes(`[Kushal] The use case puts strong emphasis on responsible AI, so we designed for it from day one. For privacy, plots are addressed only by anonymised IDs and we store no personal data. For explainability, every advice shows why, with probabilities and uncertainty. For human-in-the-loop, farmers and agronomists can override any recommendation, and those overrides become retraining data.
We evaluated on unseen plots across all taluks. The API validates and clamps every input. And we are honest about the limits: until real field data arrives, our labels come from agronomy, and the app states this openly.`);
  }

  // ============================================================ 14. Architecture
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Architecture & tech stack', 'Offline-first, one command to run: npm install && npm start');
    const boxes = [
      ['MdStorage', 'Data', 'IrrigationAdvisory\nDataset.csv\n1,000 plots + polygons', C.tint, C.ink],
      ['MdCode', 'Training (Python)', 'pandas · scikit-learn\nFAO-56 / FAO-33 labels\n→ models/*.json', C.tint, C.ink],
      ['MdDns', 'Backend (Node.js)', 'Express REST API\ntree inference · advisory\nscheduler · i18n · chat', C.green, C.white],
      ['MdWeb', 'Frontend', 'Vanilla JS SPA\nChart.js · Leaflet maps\nlight / dark, mobile', C.dark, C.white],
    ];
    for (let i = 0; i < boxes.length; i += 1) {
      const [ic, h, d, bg, fg] = boxes[i];
      const x = 0.6 + i * 3.1;
      s.addShape('roundRect', { x, y: 1.9, w: 2.75, h: 2.6, rectRadius: 0.12, fill: { color: bg }, line: { color: bg === C.tint ? C.line : bg }, shadow: shadow() });
      s.addImage({ data: await icon(ic, fg === C.white ? C.leaf : C.green), x: x + 0.25, y: 2.15, w: 0.55, h: 0.55 });
      text(s, h, { x: x + 0.25, y: 2.85, w: 2.35, h: 0.4, fontSize: 16, bold: true, color: fg });
      text(s, d, { x: x + 0.25, y: 3.3, w: 2.35, h: 1.1, fontSize: 12, color: fg === C.white ? 'E3F0E8' : C.muted });
      if (i < 3) text(s, '›', { x: x + 2.76, y: 2.9, w: 0.34, h: 0.6, fontSize: 30, bold: true, color: C.green, align: 'center' });
    }
    const api = ['GET /api/farms', 'GET /api/farms/:id?lang=kn', 'POST /api/predict', 'POST /api/schedule', 'GET /api/insights', 'GET /api/models', 'POST /api/chat', 'POST /api/feedback'];
    card(s, 0.6, 4.85, 6.0, 2.05);
    text(s, 'REST API (integrates with STEPS / mobile apps)', { x: 0.85, y: 5.0, w: 5.6, h: 0.35, fontSize: 14, bold: true });
    api.forEach((a, i) => text(s, a, { x: 0.85 + (i % 2) * 2.85, y: 5.45 + Math.floor(i / 2) * 0.35, w: 2.8, h: 0.32, fontSize: 11.5, fontFace: 'Courier New', color: C.green }));
    card(s, 6.85, 4.85, 5.9, 2.05, C.mint);
    text(s, 'Quality', { x: 7.1, y: 5.0, w: 5.4, h: 0.35, fontSize: 14, bold: true });
    text(s, [
      { text: '23 automated tests (models, engine, API)', options: { bullet: true, breakLine: true } },
      { text: 'Python ↔ JavaScript prediction parity verified', options: { bullet: true, breakLine: true } },
      { text: '1,000 plots scored in < 0.3 s on a laptop', options: { bullet: true, breakLine: true } },
      { text: 'Retrain on real data: npm run train', options: { bullet: true } },
    ], { x: 7.1, y: 5.4, w: 5.4, h: 1.4, fontSize: 12.5, paraSpaceAfter: 2 });
    footer(s, n);
    s.addNotes(`[Kartik] A quick look at the architecture. Python and scikit-learn are used only for training. The trained trees are exported to JSON, so at runtime everything is Node.js with Express. There is no Python dependency and no external service. The frontend is a lightweight single-page app with Chart.js and Leaflet maps.
Everything is exposed as a REST API, so the STEPS platform or a mobile app could use the same advisories. We have 23 automated tests, including tests that prove the JavaScript and Python predictions are identical.`);
  }

  // ============================================================ 15. Roadmap
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.white };
    title(s, 'Limitations & roadmap', 'What a real deployment with KIAAR and GBL would add');
    card(s, 0.6, 1.8, 5.2, 5.1, 'FDF3F2');
    await iconBubble(s, 'MdBugReport', 0.85, 2.05, 0.6, C.red);
    text(s, 'Current limitations', { x: 1.6, y: 2.12, w: 4, h: 0.45, fontSize: 18, bold: true });
    text(s, [
      { text: 'Labels come from FAO agronomy, not field records', options: { bullet: true, breakLine: true } },
      { text: 'Crop age is estimated (STEPS has the real planting dates)', options: { bullet: true, breakLine: true } },
      { text: 'One satellite snapshot; no daily time series yet', options: { bullet: true, breakLine: true } },
      { text: 'Translations are templates and need native-speaker review', options: { bullet: true, breakLine: true } },
      { text: 'Savings are estimates until validated in the field', options: { bullet: true } },
    ], { x: 0.9, y: 2.85, w: 4.7, h: 3.8, fontSize: 13.5, paraSpaceAfter: 8, valign: 'top' });
    const road = [
      ['MdSensors', 'IoT soil sensors + real irrigation logs', 'retrain the same pipeline on ground truth'],
      ['MdCloud', 'IMD forecast & Sentinel-2 feeds', 'daily automatic updates for every plot'],
      ['MdSmartToy', 'LLM + WhatsApp / IVR advisory', 'free-form questions in local languages'],
      ['MdPhoneAndroid', 'Mobile app + STEPS integration', 'field staff and farmers on one platform'],
      ['MdElectricBolt', 'Smart pump control', 'auto-start pumps inside the optimised windows'],
    ];
    for (let i = 0; i < road.length; i += 1) {
      const y = 1.8 + i * 1.03;
      card(s, 6.1, y, 6.65, 0.88);
      await iconBubble(s, road[i][0], 6.28, y + 0.14, 0.6);
      text(s, road[i][1], { x: 7.05, y: y + 0.1, w: 5.5, h: 0.36, fontSize: 14.5, bold: true });
      text(s, road[i][2], { x: 7.05, y: y + 0.47, w: 5.5, h: 0.3, fontSize: 12, color: C.muted });
    }
    footer(s, n);
    s.addNotes(`[Kartik] We want to be upfront about the limitations. Our labels come from agronomy, not field records. Crop age is estimated, because the real planting dates live in the STEPS platform. We have one satellite snapshot rather than a time series. The translations should be reviewed by native speakers.
The roadmap follows from this. First, connect IoT soil sensors and real irrigation logs, and retrain the same pipeline on ground truth. Second, add daily weather and Sentinel-2 feeds. Third, add an LLM on top of our structured output for WhatsApp and voice advisories. Then a mobile app, STEPS integration and, finally, automatic pump control inside the optimised windows.`);
  }

  // ============================================================ 16. Thank you
  {
    const s = pres.addSlide();
    n += 1;
    s.background = { color: C.dark };
    await iconBubble(s, 'MdWaterDrop', 0.7, 0.8, 0.9, C.leaf, C.dark);
    text(s, 'Thank you', { x: 0.7, y: 2.0, w: 7, h: 1.1, fontSize: 60, bold: true, color: C.white });
    text(s, 'Right water, right time, right plot.', { x: 0.7, y: 3.1, w: 7, h: 0.6, fontSize: 24, italic: true, color: C.leaf });
    text(s, [
      { text: 'Kartik Verma  ·  Kushal Soni', options: { fontSize: 20, bold: true, color: C.white, breakLine: true } },
      { text: 'Use case KJS-AGR-01 · K J Somaiya Institute of Technology', options: { fontSize: 13, color: '9FC2AE' } },
    ], { x: 0.7, y: 4.3, w: 7, h: 0.9 });
    s.addShape('roundRect', { x: 8.3, y: 1.9, w: 4.4, h: 3.6, rectRadius: 0.12, fill: { color: C.dark2 }, line: { color: '2A5A45' } });
    text(s, 'Run the demo', { x: 8.6, y: 2.15, w: 3.9, h: 0.45, fontSize: 18, bold: true, color: C.leaf });
    text(s, 'npm install\nnpm start\n→ http://localhost:3000', { x: 8.6, y: 2.7, w: 3.9, h: 1.2, fontSize: 15, fontFace: 'Courier New', color: C.white });
    text(s, 'Questions welcome - we would love to try SMA on real KIAAR field data.', { x: 8.6, y: 4.1, w: 3.9, h: 1.0, fontSize: 13, color: 'D8EADF' });
    s.addNotes(`[Both] Thank you for listening. SMA is about giving every sugarcane plot the right water, at the right time. We would be happy to take questions, and we would love the chance to test SMA on real KIAAR field data.
[Keep the app open on the Overview page for questions.]`);
  }

  const out = path.join(__dirname, 'SMA_Presentation.pptx');
  await pres.writeFile({ fileName: out });
  console.log('written', out, `${n} slides`);
})();
