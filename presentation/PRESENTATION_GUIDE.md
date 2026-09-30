# Presentation Guide - SMA (Smart Moisture Advisor)

**Presenters:** Kartik Verma & Kushal Soni
**Deck:** `presentation/SMA_Presentation.pptx` (16 slides; the full script is also in each slide's speaker notes)
**Target length:** 12-15 minutes + 5 minutes of questions

The split below is a suggestion. Kartik opens and covers the problem, data and ML (slides 1-7, 14-15). Kushal runs the live demo and covers impact and governance (slides 8-13). You close together. Swap sections freely.

---

## 1. Before the presentation (checklist)

| When | What |
|---|---|
| Day before | `npm install`, then `npm start`. Open http://localhost:3000 and click through every page once |
| Day before | Rehearse the demo at least twice with a timer. Practise switching between PowerPoint and the browser (Alt+Tab) |
| 30 min before | Start the server, open the app in a browser tab, press **F11** for full screen, zoom to 110-125% so the back row can read it |
| 30 min before | In the app, choose **Satellite snapshot** and **English**, and open the **Overview** page |
| 30 min before | Test the projector resolution. The app is responsive and adapts |
| Just before | Mute notifications. Close other tabs. Keep a charger plugged in |
| Backup | If the laptop or internet fails, slides 8-11 contain screenshots of every demo step, so you can still tell the full story |

> The app works fully **offline**. Only the satellite basemap on the Farm Map needs internet. If there is no internet, the plots still show, with village labels.

---

## 2. Script (slide by slide)

### Slide 1 - Title (Kartik, 30 s)
> "Good morning, Professor. We are Kartik Verma and Kushal Soni. Our project is **SMA, the Smart Moisture Advisor**. It is our solution to use case KJS-AGR-01, an AI irrigation advisory system for sugarcane. In one line: SMA tells every farmer **when** to irrigate, **how long** to run the pump, **how much fertiliser** to give, and **what they lose if they wait**, in their own language."

### Slide 2 - Problem (Kartik, 1 min)
> "Between 18 and 25 thousand farmers grow sugarcane in the KIAAR and Godavari network. One crop needs 1,500 to 2,500 mm of water, yet irrigation is decided by habit. That causes two opposite mistakes. Over-irrigation wastes water, power and fertiliser. Delayed irrigation causes stress and yield loss. With thousands of scattered plots, nobody can monitor them manually."

### Slide 3 - What SMA does (Kartik, 45 s)
> "SMA answers four questions per plot. When? How long? How much fertiliser? What if I wait? Underneath, data flows into seven ML models. A decision engine adds rain adjustment, fertigation and pump scheduling, and the output is a plain-language advisory in four languages."

### Slide 4 - Dataset (Kartik, 1 min)
> "We have 1,000 geofenced plots in Mandya: 6 taluks, 10 villages, 736 hectares. Our data audit found one big problem: **there are no labels**. Nothing says when a plot was irrigated or what it yielded. We also imputed 6 cloud-masked NDVI values, dropped constant columns, and noted that the weather variables are strongly correlated."

### Slide 5 - Physics-informed ML (Kartik, 1.5 min) ← key technical slide, go slowly
> "So how do you do supervised learning without labels? We used **agronomic science to create them**. Each plot is expanded into 12 seasonal scenarios, which gives 12,000 rows. We label each row with **FAO-56**, the international standard for crop water balance, and **FAO-33**, which models yield response to water. Then we add realistic noise.
> Why not just use the formula? First, the day KIAAR gives us real irrigation logs, we retrain with `npm run train` and nothing else changes. Second, ensembles give uncertainty and explanations. Third, they are robust to noisy sensors. We also split by plot, so the models are always tested on plots they have never seen."

### Slide 6 - Accuracy (Kartik, 1 min)
> "On 200 unseen plots, every model beats its linear baseline. Next-irrigation date has R² 0.96 and an average error under 0.7 days. The stress and disease classifiers reach about 88% accuracy, and their errors are mostly between neighbouring classes. The models run natively in Node.js, and 23 tests prove they match Python exactly."

### Slide 7 - Coverage (Kartik, 30 s → hand-over)
> "The use case lists 11 models. We implemented all 11, plus management zones. **Now Kushal will show you the live system.**"

### Slide 8 - Dashboard → LIVE DEMO (Kushal, 2 min)
Switch to the browser.
1. On **Overview** with *Satellite snapshot*: "Right now, after the monsoon pass, soils are moist. Only 20 plots are due this week, and SMA already saves about 38% water versus a fixed 8-day schedule."
2. Click **Summer dry spell**: "Seven dry days and eight degrees hotter. Now 637 plots must irrigate today, 204 are stressed, and 790 tonnes of cane are at risk." Point at the red bar in the calendar.
3. Point at **Priority plots**: "the models rank plots by stress and cane at risk." Then open **Farm Advisor**, type **MM-MD-0110** and press **Get advisory**. The numbers below are for this plot.

### Slide 9 - Farm Advisor (Kushal, 2 min)
1. Read the red banner: "Irrigate today, about 22 hours of pumping, 1,120 m³."
2. Switch the language (top-right) to **ಕನ್ನಡ**, then press **Read aloud**. *(Test the volume beforehand. If no Kannada voice is installed, use Hindi or English.)*
3. Scroll: "14-day moisture projection with and without irrigation. The yield-loss curve shows the cost of waiting. The fertigation plan gives exact kilograms of urea, 12-61-0 and potash."
4. Point at **Why this advice?**: "Soil moisture brings irrigation 4.8 days earlier. The AI is not a black box."
5. Click **Accept advice**: "Farmers and agronomists stay in control. Overrides are logged for retraining."
6. Switch the language back to English.

### Slide 10 - Rain-aware (Kushal, 1 min)
Click **Dry spell + rain forecast** and go back to **Overview**.
> "Same dry spell, but 40 mm of rain is forecast. Irrigate-today alerts drop from 637 to **zero**. 894 plots are told to skip, and pumping this week falls from 387k to 62k m³."

### Slide 11 - Pump scheduler (Kushal, 1.5 min)
Select **Summer dry spell**, open **Pump Scheduler** (village Hosur), and click **Optimise schedule**.
> "Farm pumps get three-phase power for only about 7 hours a day, and a feeder can run only so many pumps. We use Weighted Shortest Processing Time, which orders plots by cane at risk divided by pumping hours. Compared with a first-come rotation, we avoid about 5 tonnes of cane loss in one village and serve 7 of 14 high-stress plots instead of 2."
Toggle **SMA optimised / Rotation (FCFS)** to show the Gantt chart change.

*(Optional, if time allows: open **What-If Simulator** and click **Heat wave, dry soil**. Move the soil-moisture slider and watch the predictions update live.)*

Switch back to PowerPoint.

### Slide 12 - Impact (Kushal, 45 s)
> "Under normal conditions: 38% less water, 56% with drip, and 12.9k kWh of pump energy saved per week across 736 ha. **These are model estimates against a documented baseline.** Validating them in the field is our first next step."

### Slide 13 - Responsible AI (Kushal, 45 s)
> "Privacy by design: anonymised IDs only. Explainability on every advisory. Human-in-the-loop overrides. Evaluation on unseen plots, input validation, and honesty about our limits."

### Slide 14 - Architecture (Kartik, 45 s)
> "Python is used only for training. Trees are exported to JSON and served by Node.js and Express, with a Chart.js and Leaflet frontend. Everything is a REST API, so the STEPS platform or a mobile app can plug in."

### Slide 15 - Limitations & roadmap (Kartik, 1 min)
> "Our limits: agronomy-derived labels, estimated crop age, one satellite snapshot, and template translations. Next steps: IoT sensors and real logs, daily IMD and Sentinel-2 feeds, an LLM on WhatsApp or voice, a mobile app with STEPS integration, and finally automatic pump control."

### Slide 16 - Thank you (Both, 15 s)
> "Right water, right time, right plot. Thank you. We are happy to take questions."

---

## 3. Likely questions and good answers

**Q: Your labels are synthetic. Isn't the model just learning your formula?**
A: Yes, and that is deliberate at this stage. It is *physics-informed ML*. We add noise so the model cannot memorise the formula, and we test on unseen plots. The value is the pipeline: once KIAAR gives real irrigation logs or sensor readings, the same code retrains on ground truth. The agronomy then acts as a prior, which is how many operational agri-AI systems start.

**Q: Why Random Forest / Gradient Boosting and not deep learning?**
A: The data is small, tabular and has 10 features. Tree ensembles are state-of-the-art for this kind of data. They need no GPU, give feature importance and uncertainty, and can be exported to plain JSON and run in Node.js. A neural network would be less explainable and gain nothing here.

**Q: How do you prevent data leakage?**
A: Each plot generates 12 scenarios, so we use `GroupShuffleSplit` by plot. All scenarios of a test plot are unseen during training. A random row split would have inflated the scores.

**Q: How accurate is "next irrigation date"?**
A: R² 0.96, with a mean absolute error of about 0.7 days on unseen plots. The UI also shows the spread across the 40 trees as ± days of uncertainty.

**Q: What is the baseline for water savings?**
A: A fixed schedule of about 70 mm gross every 8 days, which is typical farmer practice. SMA recommends ETc × 7 days minus effective rain, divided by irrigation efficiency. It is defined in `src/config.js` and can be changed.

**Q: Where does crop age come from?**
A: It is not in the dataset. We assign a stable estimate per plot, and the Farm Advisor has a slider to override it. In production it comes from the STEPS planting records.

**Q: How does the rain adjustment work?**
A: Forecast rain is a model input. We also predict a "no-rain" counterfactual. If rain pushes the irrigation date later, the advice becomes "skip". The water saved is the effective rain, 80% of the rain above 3 mm.

**Q: Why WSPT for pump scheduling? Is it optimal?**
A: Smith's rule (WSPT) is provably optimal for minimising total weighted completion time on a single machine. For parallel feeders with power windows it is a strong, fast heuristic. An exact solution would need integer programming, which we list as future work.

**Q: How is the explanation computed?**
A: By sensitivity analysis. We replace one feature at a time with the regional median and measure how much the prediction changes. It is model-agnostic and fast, and conceptually close to SHAP.

**Q: Is the chatbot an LLM?**
A: Not yet. It uses keyword intent detection in four languages and template answers generated from the same model outputs, so it never contradicts the dashboard and works offline. The structured output is ready to be passed to an LLM for free-form conversation.

**Q: How would this scale to 25,000 farms?**
A: Scoring 1,000 plots takes under 0.3 s in Node.js, so 25,000 takes a few seconds and is easily run daily. The API is stateless, and results are cached per scenario.

**Q: What about data privacy (DPDP Act)?**
A: We only use anonymised plot IDs, store no names or phone numbers, and the feedback log holds only plot ID, role and decision.

**If you don't know an answer:** say *"That's a great point. We haven't tested that yet, but here is how we would approach it..."*. Never guess numbers.

---

## 4. Presenting tips

- **Start with the farmer, not the tech.** The first two minutes decide whether the audience cares.
- **One idea per slide.** Say the headline first, then the evidence.
- **Slide 5 is the heart of the talk.** Slow down there. That is where you show you understand the ML.
- **Demo narration: say what you will click, click it, then say what changed.** Keep the mouse still while you talk.
- **Use numbers confidently but honestly.** Say "model estimate" for savings. Professors respect stated limitations far more than over-claiming.
- **Hand-overs:** end your part with the other person's name ("Now Kushal will show you the live system").
- **Face the audience, not the screen.** Glance at the screen only to point.
- **Timing:** aim for about 13 minutes. If you run late, skip the optional What-If Simulator step and shorten slide 14.
- **Body language:** stand still, keep your hands visible, pause after key numbers (637 → 0).
- **Rehearse the demo path until it is muscle memory:** Overview → Summer dry spell → Farm Advisor (MM-MD-0110) → Kannada + Read aloud → Accept → Rain forecast → Pump Scheduler → back to slides.
- **Backup plan:** if anything breaks, say "Let me show you the screenshot" and continue from slides 8-11. Don't debug live.

---

## 5. Regenerating the slides or screenshots

```bash
# app screenshots (the server must be running on port 3000)
cd presentation
npm install                        # pptxgenjs, react-icons, sharp (deck builder)
npm i -D playwright && npx playwright install chromium   # only for screenshots
npm run screenshots
npm run build                      # writes SMA_Presentation.pptx
```
