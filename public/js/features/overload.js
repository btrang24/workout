// Progressive overload: what to lift today, from last time and the plan's target.
// Pure functions (no screen code), so they're easy to test and reuse.
import { lastLog } from "../core/stats.js";
import { conv, num } from "../core/util.js";

/** "8-12" -> [8, 12]; "10" -> [10, 10]; "15 each leg" -> [15, 15]; anything else -> null. */
export function parseRange(reps) {
  const m = String(reps || "").match(/(\d+)\s*(?:[-–]\s*(\d+))?/);
  return m ? [+m[1], +(m[2] || m[1])] : null;
}

/** Weight step for one jump: 5 lb, or 2.5 kg. */
const step = (unit) => (unit === "kg" ? 2.5 : 5);

/**
 * Suggest today's set for an exercise.
 * Returns { w, r, s, unit, up, note } or null when there's no history.
 * Rule (double progression): if every working set reached the top of the rep range,
 * add one weight step and start again at the bottom of the range; otherwise keep the
 * weight and aim for one more rep. Timed exercises: 5 seconds longer.
 */
export function suggest(ex, target, last = lastLog(ex.id)) {
  const sets = (last && last.sets) || [];
  if (!sets.length) return null;
  const unit = last.unit || "lb";
  if (ex.kind === "time") {
    const s = Math.max(...sets.map((x) => Number(x.s) || 0));
    return s ? { s: s + 5, unit, up: true, note: "5 seconds longer than last time" } : null;
  }
  const top = Math.max(...sets.map((x) => Number(x.w) || 0));
  const work = sets.filter((x) => (Number(x.w) || 0) === top);
  const minR = Math.min(...work.map((x) => Number(x.r) || 0));
  const range = parseRange(target && target.reps) || (ex.kind === "weight" ? [8, 12] : [minR + 1, minR + 1]);
  const [lo, hi] = range;
  if (ex.kind === "reps") {
    const r = Math.min(hi, minR + 1);
    return { w: top, r, unit, up: r > minR, note: r > minR ? "One more rep than last time" : "Same as last time: keep it strict" };
  }
  if (minR >= hi) {
    const w = top + step(unit);
    return { w, r: lo, unit, up: true, note: `You did ${hi}+ reps on every set last time: add ${step(unit)} ${unit}` };
  }
  return { w: top, r: Math.min(hi, Math.max(lo, minR + 1)), unit, up: false, note: `Same weight: aim for ${Math.min(hi, Math.max(lo, minR + 1))} reps` };
}

/** Short text for a suggestion, shown in the user's chosen unit. */
export function suggestLabel(ex, sg, unit) {
  if (!sg) return "";
  if (ex.kind === "time") return `${sg.s} sec`;
  const w = num(conv(sg.w, sg.unit, unit));
  if (ex.kind === "reps") return `${sg.r} reps${sg.w ? ` +${w} ${unit}` : ""}`;
  return `${w} ${unit} × ${sg.r}`;
}
