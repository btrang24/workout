// Summaries, personal bests and chart series from logs.
import { S, index, logsFor } from "./state.js";
import { conv, fmtTime, num } from "./util.js";

/* ============================================================
   Summaries and stats
   ============================================================ */
export function setLabel(st, kind, unit) {
  if (kind === "time") return fmtTime(st.s);
  if (kind === "reps") return (st.r || 0) + (st.w ? " (+" + num(st.w) + " " + unit + ")" : "");
  return num(st.w) + " " + unit + " × " + (st.r || 0);
}
export function summary(log) {
  const sets = log.sets || [], k = log.kind, u = log.unit || "lb";
  if (!sets.length) return "";
  const same = sets.every((s) => s.w === sets[0].w && s.r === sets[0].r && s.s === sets[0].s);
  if (same) {
    const s = sets[0], n = sets.length;
    if (k === "time") return (n > 1 ? n + " × " : "") + fmtTime(s.s);
    if (k === "reps") return (n > 1 ? n + " × " : "") + (s.r || 0) + " reps" + (s.w ? " (+" + num(s.w) + " " + u + ")" : "");
    return (n > 1 ? n + " × " : "") + (s.r || 0) + " @ " + num(s.w) + " " + u;
  }
  if (k === "weight") return sets.map((s) => num(s.w) + "×" + (s.r || 0)).join(", ") + " " + u;
  return sets.map((s) => setLabel(s, k, u)).join(", ") + (k === "reps" ? " reps" : "");
}
export const METRICS = {
  weight: [{ id: "heavy", name: "Heaviest", agg: "max" }, { id: "e1rm", name: "Est. 1-rep max", agg: "max" }, { id: "vol", name: "Total volume", agg: "sum" }],
  reps: [{ id: "reps", name: "Most reps", agg: "max" }, { id: "treps", name: "Total reps", agg: "sum" }],
  time: [{ id: "long", name: "Longest", agg: "max" }, { id: "ttime", name: "Total time", agg: "sum" }],
};
export function setValue(st, metric, unit) {
  const w = conv(st.w || 0, unit, S.unit), r = Number(st.r) || 0;
  switch (metric) {
    case "heavy": return r > 0 ? w : null;
    case "e1rm": return r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : null;
    case "vol": return w * r;
    case "reps": case "treps": return r;
    case "long": case "ttime": return Number(st.s) || 0;
  }
  return null;
}
export function series(exId, kind, metricId) {
  const m = METRICS[kind].find((x) => x.id === metricId) || METRICS[kind][0];
  const byDay = {};
  for (const l of logsFor(exId)) {
    for (const st of l.sets || []) {
      const v = setValue(st, m.id, l.unit || "lb");
      if (v == null) continue;
      const d = byDay[l.date] || (byDay[l.date] = { date: l.date, v: m.agg === "max" ? -Infinity : 0, best: null });
      if (m.agg === "max") { if (v > d.v) { d.v = v; d.best = { st, unit: l.unit || "lb" }; } }
      else d.v += v;
    }
  }
  return Object.values(byDay).filter((d) => isFinite(d.v)).sort((a, b) => a.date.localeCompare(b.date));
}
export function fmtMetric(v, metricId) {
  if (metricId === "long" || metricId === "ttime") return fmtTime(v);
  if (metricId === "reps" || metricId === "treps") return Math.round(v) + " reps";
  if (metricId === "vol") return Math.round(v).toLocaleString() + " " + S.unit;
  return num(v) + " " + S.unit;
}
export function personalBest(ex) {
  const memo = index().best, key = ex.id + "|" + S.unit;
  if (memo.has(key)) return memo.get(key);
  let best = null;
  for (const l of logsFor(ex.id)) for (const st of l.sets || []) {
    const u = l.unit || "lb";
    let score, label;
    if (ex.kind === "time") { score = Number(st.s) || 0; label = fmtTime(st.s); }
    else if (ex.kind === "reps") { score = (Number(st.r) || 0) + conv(st.w || 0, u, "lb") / 1000; label = (st.r || 0) + " reps" + (st.w ? " +" + num(conv(st.w, u, S.unit)) + " " + S.unit : ""); }
    else { if (!(st.r > 0)) continue; score = conv(st.w || 0, u, "lb") + (Number(st.r) || 0) / 1000; label = num(conv(st.w, u, S.unit)) + " " + S.unit + " × " + st.r; }
    if (!best || score > best.score) best = { score, label, date: l.date };
  }
  memo.set(key, best);
  return best;
}
export function lastLog(exId) {
  return (index().byEx.get(exId) || [])[0];
}
