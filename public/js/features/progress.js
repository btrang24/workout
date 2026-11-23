import { S, exById, logsFor, myLogs } from "../core/state.js";
import { METRICS, fmtMetric, lastLog, personalBest, series, setLabel, summary } from "../core/stats.js";
import { action, render, slot, slots, view } from "../core/ui.js";
import { $, conv, dayLabel, esc, fmtClock, num, shortDate } from "../core/util.js";

/* ---------- Progress ---------- */
/** Progress tab = its sections in order (muscles this week, exercise chart, body weight...). */
export const viewProgress = () => slots("progress");

/** Exercise chart section. */
export function exerciseProgress() {
  const withData = [];
  const seen = new Set();
  for (const l of myLogs().sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    if (seen.has(l.exId)) continue; seen.add(l.exId);
    const ex = exById(l.exId); if (ex) withData.push(ex);
  }
  if (!withData.length) return `<div class="dayh">Exercise progress</div><div class="empty"><div class="big">📈</div>Log an exercise a few times and your progress chart shows up here.</div>`;
  if (!withData.find((e) => e.id === S.progEx)) S.progEx = withData[0].id;
  const ex = exById(S.progEx);
  const mets = METRICS[ex.kind] || METRICS.weight;
  if (!mets.find((m) => m.id === S.progMetric)) S.progMetric = mets[0].id;
  const data = series(ex.id, ex.kind, S.progMetric);
  const pb = personalBest(ex), last = lastLog(ex.id);
  const sessions = new Set(logsFor(ex.id).map((l) => l.date)).size;
  const metName = mets.find((m) => m.id === S.progMetric).name;
  const recent = logsFor(ex.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return `
    <div class="dayh">Exercise progress</div>
    <div class="pad"><div class="f" style="margin:4px 0 0"><select id="progex" aria-label="Exercise">${withData.map((e) => `<option value="${esc(e.id)}" ${e.id === ex.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></div></div>
    <div class="chips">${mets.map((m) => `<button class="chip sm ${m.id === S.progMetric ? "on" : ""}" data-act="metric" data-v="${m.id}">${m.name}</button>`).join("")}</div>
    <div class="chartbox"><div class="ctitle">${esc(metName)} per day${ex.kind === "weight" && S.progMetric !== "vol" ? " (" + S.unit + ")" : ""}</div>${chartSvg(data)}</div>
    <div class="pad statrow">
      <div class="stat"><div class="k">🏆 Personal best</div><div class="v">${pb ? esc(pb.label) : "–"}</div><div class="s">${pb ? esc(shortDate(pb.date)) : ""}</div></div>
      <div class="stat"><div class="k">Sessions</div><div class="v">${sessions}</div><div class="s">days logged</div></div>
      <div class="stat"><div class="k">Last session</div><div class="v" style="font-size:15px">${last ? esc(summary(last)) : "–"}</div><div class="s">${last ? esc(dayLabel(last.date)) : ""}</div></div>
    </div>
    <div class="dayh">Recent sessions</div>
    ${recent.map((l) => `<div class="card" data-act="log-edit" data-id="${esc(l.id)}"><div class="bd"><div class="tt">${esc(dayLabel(l.date))}</div><div class="sm">${esc(summary(l))}</div>${l.notes ? `<div class="nt">${esc(l.notes)}</div>` : ""}</div></div>`).join("")}
    <div class="pad"><button class="btn block" data-act="ex" data-id="${esc(ex.id)}" style="margin-top:6px">How to do ${esc(ex.name)}</button></div>`;
}
export let chartPts = [];
export function chartSvg(data) {
  const W = 340, H = 180, L = 40, R = 14, T = 16, B = 26;
  if (!data.length) return `<div class="small" style="padding:20px">No data for this view yet.</div>`;
  const vals = data.map((d) => d.v);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo = lo - Math.max(1, lo * 0.1); hi = hi + Math.max(1, hi * 0.1); }
  const span = hi - lo, stepRaw = span / 4, mag = Math.pow(10, Math.floor(Math.log10(stepRaw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= stepRaw) || stepRaw;
  lo = Math.max(0, Math.floor(lo / step) * step); hi = Math.ceil(hi / step) * step;
  const t0 = new Date(data[0].date + "T12:00:00").getTime(), t1 = new Date(data[data.length - 1].date + "T12:00:00").getTime();
  const x = (d) => data.length === 1 ? (L + W - R) / 2 : L + ((new Date(d.date + "T12:00:00").getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const isTime = S.progMetric === "long" || S.progMetric === "ttime";
  const tickLbl = (v) => isTime ? fmtClock(v) : (v >= 10000 ? Math.round(v / 1000) + "k" : num(v));
  let g = "";
  for (let v = lo; v <= hi + 1e-9; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${tickLbl(v)}</text>`;
  const xl = data.length === 1 ? [data[0]] : [data[0], data[data.length - 1]];
  g += xl.map((d, i) => `<text x="${x(d)}" y="${H - 7}" text-anchor="${data.length === 1 ? "middle" : i ? "end" : "start"}" font-size="11" fill="var(--muted)">${shortDate(d.date)}</text>`).join("");
  chartPts = data.map((d) => ({ x: x(d), y: y(d.v), d }));
  const path = chartPts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const maxI = vals.indexOf(Math.max(...vals));
  const dots = chartPts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${i === maxI ? "var(--hot)" : "var(--acc)"}" stroke="var(--card)" stroke-width="2"/>`).join("");
  const lastP = chartPts[chartPts.length - 1];
  const lbl = `<text id="lastlbl" x="${Math.min(lastP.x, W - R)}" y="${lastP.y - 9}" text-anchor="end" font-size="12" font-weight="700" fill="var(--ink)">${esc(fmtMetric(lastP.d.v, S.progMetric))}</text>`;
  return `<svg id="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">${g}<path d="${path}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-linejoin="round"/><line id="xh" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-dasharray="3 3" class="hide"/>${dots}${lbl}<rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/></svg><div class="tip hide" id="tip"></div>`;
}
export function wireChart() {
  const svg = $("#chart"), tip = $("#tip"), xh = $("#xh"), lbl = $("#lastlbl");
  if (!svg) return;
  const show = (ev) => {
    const r = svg.getBoundingClientRect(), sx = 340 / r.width;
    const px = (ev.clientX - r.left) * sx;
    let best = chartPts[0];
    for (const p of chartPts) if (Math.abs(p.x - px) < Math.abs(best.x - px)) best = p;
    const d = best.d;
    let detail = "";
    if (d.best && S.progMetric !== "e1rm") detail = setLabel({ ...d.best.st, w: num(conv(d.best.st.w, d.best.unit, S.unit)) }, exById(S.progEx).kind, S.unit);
    tip.innerHTML = `<b>${esc(fmtMetric(d.v, S.progMetric))}</b>${esc(dayLabel(d.date))}${detail && detail !== fmtMetric(d.v, S.progMetric) ? " · " + esc(detail) : ""}`;
    tip.style.left = Math.max(60, Math.min(r.width - 60, best.x / sx)) + 8 + "px";
    tip.style.top = best.y / sx + 4 + "px";
    tip.classList.remove("hide"); if (lbl) lbl.classList.add("hide");
    xh.setAttribute("x1", best.x); xh.setAttribute("x2", best.x); xh.classList.remove("hide");
  };
  const hide = () => { if (lbl) lbl.classList.remove("hide"); tip.classList.add("hide"); xh.classList.add("hide"); };
  svg.addEventListener("pointermove", show);
  svg.addEventListener("pointerdown", show);
  svg.addEventListener("pointerleave", hide);
  $("#progex").addEventListener("change", (e) => { S.progEx = e.target.value; S.progMetric = ""; render(); });
}

/* ---------- buttons ---------- */
action("metric", (a, e, id) => { S.progMetric = a.dataset.v; render(); });

slot("progress", 20, exerciseProgress);
view("progress", { order: 3, title: "Progress", icon: "📈", label: "Progress", render: viewProgress, after: wireChart });
