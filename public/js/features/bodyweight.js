// Body weight log: one entry per person per day, a 90-day chart, the 7-day average and the change.
import { S } from "../core/state.js";
import { deleteDoc, saveDoc } from "../core/store.js";
import { action, collection, slot } from "../core/ui.js";
import { $, conv, dayLabel, esc, isoDay, num, shortDate, toast } from "../core/util.js";

const mine = () => S.bodyweight.filter((b) => b.personId === S.personId).sort((a, b) => a.date.localeCompare(b.date));
const inUnit = (b) => conv(b.w, b.unit || "lb", S.unit);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };
const avg = (arr) => (arr.length ? arr.reduce((t, b) => t + inUnit(b), 0) / arr.length : null);

function chart(list) {
  if (list.length < 2) return "";
  const W = 340, H = 110, L = 34, R = 8, T = 10, B = 18;
  const vals = list.map(inUnit), lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const t0 = Date.parse(list[0].date), t1 = Date.parse(list[list.length - 1].date) || t0 + 1;
  const x = (b) => L + ((Date.parse(b.date) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  const path = list.map((b, i) => (i ? "L" : "M") + x(b).toFixed(1) + " " + y(inUnit(b)).toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Body weight chart">
    ${[lo, hi].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join("")}
    <path d="${path}" fill="none" stroke="var(--acc)" stroke-width="2"/>
    ${list.map((b) => `<circle cx="${x(b)}" cy="${y(inUnit(b))}" r="2.5" fill="var(--acc)"/>`).join("")}
    <text x="${L}" y="${H - 4}" font-size="10" fill="var(--muted)">${shortDate(list[0].date)}</text>
    <text x="${W - R}" y="${H - 4}" text-anchor="end" font-size="10" fill="var(--muted)">${shortDate(list[list.length - 1].date)}</text></svg>`;
}

function card() {
  if (!S.personId) return "";
  const all = mine(), recent = all.filter((b) => b.date >= daysAgo(90));
  const last = all[all.length - 1], week = avg(all.filter((b) => b.date >= daysAgo(6)));
  const month = all.filter((b) => b.date >= daysAgo(30)), change = month.length > 1 ? inUnit(month[month.length - 1]) - inUnit(month[0]) : null;
  const today = all.find((b) => b.date === isoDay());
  return `<div class="dayh">Body weight</div>
    <div class="chartbox">
      <div class="withmic"><input id="bwin" inputmode="decimal" placeholder="Today's weight (${S.unit})" value="${today ? num(inUnit(today)) : ""}" autocomplete="off"><button class="btn pri" data-act="bw-save">${today ? "Update" : "Save"}</button></div>
      ${last ? `<div class="statrow" style="grid-template-columns:1fr 1fr 1fr;margin-top:10px">
        <div class="stat"><div class="k">Latest</div><div class="v">${num(inUnit(last))}</div><div class="s">${esc(dayLabel(last.date))}</div></div>
        <div class="stat"><div class="k">7-day average</div><div class="v">${week != null ? num(week) : "–"}</div><div class="s">${S.unit}</div></div>
        <div class="stat"><div class="k">30 days</div><div class="v">${change != null ? (change > 0 ? "+" : "") + num(change) : "–"}</div><div class="s">${S.unit}</div></div></div>` : `<div class="small" style="margin-top:6px">Weigh in at the same time of day (for example, in the morning). The 7-day average smooths out day-to-day changes.</div>`}
      ${chart(recent)}
      ${all.length ? `<div class="small" style="margin-top:6px">${all.slice(-5).reverse().map((b) => `${esc(dayLabel(b.date))}: <b>${num(inUnit(b))}</b> <a href="#" data-act="bw-del" data-id="${esc(b.id)}" aria-label="Delete">✕</a>`).join(" · ")}</div>` : ""}
    </div>`;
}

action("bw-save", () => {
  const v = parseFloat(($("#bwin") || {}).value);
  if (!(v > 0 && v < 1000)) { toast("Enter your weight in " + S.unit + "."); return; }
  saveDoc("bodyweight", { id: S.personId + "_" + isoDay(), personId: S.personId, date: isoDay(), w: v, unit: S.unit, ts: Date.now() });
  toast("Saved " + num(v) + " " + S.unit);
});
action("bw-del", (a, e, id) => { e.preventDefault(); if (confirm("Delete this weigh-in?")) deleteDoc("bodyweight", id); });
collection("bodyweight", (arr) => { S.bodyweight = arr; });
slot("progress", 30, card);
