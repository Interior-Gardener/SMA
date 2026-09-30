/**
 * Pump scheduling optimisation under electricity constraints.
 *
 * Rural feeders in Karnataka supply 3-phase power to irrigation pump sets
 * only in fixed windows (typically ~7 hours/day) and a transformer can only
 * carry a limited number of pumps at once. Given the plots that need water,
 * we decide who pumps when.
 *
 * Algorithm: Weighted-Shortest-Processing-Time (WSPT) list scheduling on
 * parallel "feeder lanes". WSPT - ordering jobs by weight / duration - is the
 * optimal rule for minimising total weighted completion time on a single
 * machine (Smith's rule) and a strong heuristic for parallel machines. The
 * weight of a plot is the cane (tonnes) put at risk if its irrigation slips,
 * as predicted by the yield-loss model, boosted when water stress is high.
 * Jobs may be split across power windows (the pump simply stops when power
 * goes off and resumes in the next window).
 *
 * The result is compared with the common first-come-first-served rotation.
 */
const { PUMP_KW } = require('../config');

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

function buildSlots(windows, days) {
  const slots = [];
  for (let d = 0; d < days; d++) {
    for (const w of windows) {
      const s = toMinutes(w.start);
      const e = toMinutes(w.end);
      if (e > s) slots.push([d * 1440 + s, d * 1440 + e]);
    }
  }
  return slots.sort((a, b) => a[0] - b[0]);
}

function pack(jobs, slots, lanes) {
  const state = Array.from({ length: lanes }, () => ({ slot: 0, t: slots.length ? slots[0][0] : Infinity }));
  const segments = [];
  const results = [];
  for (const job of jobs) {
    // lane that becomes free earliest
    let li = 0;
    state.forEach((s, i) => {
      const ti = s.slot < slots.length ? Math.max(s.t, slots[s.slot][0]) : Infinity;
      const tb = state[li].slot < slots.length ? Math.max(state[li].t, slots[state[li].slot][0]) : Infinity;
      if (ti < tb) li = i;
    });
    const lane = state[li];
    let remaining = job.minutes;
    let start = null;
    let end = null;
    while (remaining > 0 && lane.slot < slots.length) {
      const [s, e] = slots[lane.slot];
      const t = Math.max(lane.t, s);
      if (t >= e) {
        lane.slot += 1;
        lane.t = lane.slot < slots.length ? slots[lane.slot][0] : Infinity;
        continue;
      }
      const use = Math.min(remaining, e - t);
      segments.push({ lane: li, id: job.id, start: t, end: t + use, stressClass: job.stressClass });
      if (start === null) start = t;
      end = t + use;
      remaining -= use;
      lane.t = t + use;
      if (lane.t >= e) {
        lane.slot += 1;
        lane.t = lane.slot < slots.length ? slots[lane.slot][0] : Infinity;
      }
    }
    results.push({ ...job, start, end, complete: remaining <= 0, remainingMinutes: Math.round(remaining) });
  }
  return { segments, results };
}

function evaluate({ results }, horizonEnd, powerMinutesPerDay) {
  // Unfinished work continues in future power windows.
  const completion = (r) => (r.complete ? r.end : horizonEnd + (r.remainingMinutes * 1440) / Math.max(60, powerMinutesPerDay));
  const days = (m) => m / 1440;
  // Estimated cane lost while waiting: the yield-loss model's 5-day risk,
  // scaled by how many days past the due date the plot is finally watered.
  const lossT = results.reduce((s, r) => s + r.tonnesAtRisk * Math.max(0, days(completion(r)) - r.dueInDays) / 5, 0);
  const done = results.filter((r) => r.complete);
  const high = results.filter((r) => r.stressClass >= 2);
  const pumpHours = results.reduce((s, r) => s + (r.minutes - r.remainingMinutes) / 60, 0);
  return {
    plotsCompleted: done.length,
    plotsPending: results.length - done.length,
    tonnesAtRiskPending: +results.filter((r) => !r.complete).reduce((s, r) => s + r.tonnesAtRisk, 0).toFixed(2),
    estimatedLossT: +lossT.toFixed(2),
    avgHighStressCompletionHours: high.length ? +(high.reduce((s, r) => s + completion(r), 0) / high.length / 60).toFixed(1) : null,
    highStressPlots: high.length,
    highStressServed: high.filter((r) => r.complete).length,
    pumpHours: +pumpHours.toFixed(1),
    energyKwh: +(pumpHours * PUMP_KW).toFixed(0),
  };
}

/**
 * @param summaries farm summaries (from advisory.summarize) already filtered to the area
 * @param opts { windows:[{start,end}], capacity, days }
 */
function schedule(summaries, { windows, capacity, days = 2, method = 'furrow' }) {
  const lanes = Math.max(1, Math.min(100, Math.round(capacity)));
  const slots = buildSlots(windows, days);
  const perDay = slots.filter((s) => s[1] <= 1440).reduce((a, s) => a + (s[1] - s[0]), 0);

  // Drip plots are watered little and often (every day); surface-irrigated
  // plots only when their predicted irrigation date falls inside the horizon.
  const drip = method === 'drip';
  const jobs = summaries
    .filter((f) => f.status !== 'rain_skip' && (drip || f.dueInDays < days))
    .map((f) => {
      const hours = drip ? f.dripDailyHours : f.hours;
      const urgency = f.dueInDays === 0 ? 2 : 1;
      const weight = urgency * (f.tonnesAtRisk + 0.5 * f.stressProbability) + 0.01;
      return {
        id: f.id,
        village: f.village,
        dueInDays: f.dueInDays,
        stressClass: f.stressClass,
        tonnesAtRisk: f.tonnesAtRisk,
        hours,
        minutes: Math.max(drip ? 10 : 30, Math.round(hours * 60)),
        weight: +weight.toFixed(3),
      };
    });

  const optimisedOrder = [...jobs].sort((a, b) => b.weight / b.minutes - a.weight / a.minutes);
  const fcfsOrder = [...jobs].sort((a, b) => a.id.localeCompare(b.id));

  const optimised = pack(optimisedOrder, slots, lanes);
  const fcfs = pack(fcfsOrder, slots, lanes);
  const horizonEnd = days * 1440;

  return {
    lanes,
    days,
    slots,
    powerMinutesPerDay: perDay,
    demandPumpHours: +jobs.reduce((s, j) => s + j.minutes / 60, 0).toFixed(1),
    capacityPumpHoursPerDay: +((perDay / 60) * lanes).toFixed(1),
    jobs: jobs.length,
    optimised: { ...optimised, kpi: evaluate(optimised, horizonEnd, perDay) },
    fcfs: { kpi: evaluate(fcfs, horizonEnd, perDay), segments: fcfs.segments },
  };
}

module.exports = { schedule, buildSlots, toMinutes };
