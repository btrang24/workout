import { thumb } from "../core/media.js";
import { S, exById, index, myName } from "../core/state.js";
import { summary } from "../core/stats.js";
import { action, render, view } from "../core/ui.js";
import { dayLabel, esc, isoDay } from "../core/util.js";

export function logCard(l, showWho) {
  const ex = exById(l.exId);
  return `<div class="card" data-act="log-edit" data-id="${esc(l.id)}">
    <div class="th">${ex ? thumb(ex) : "🏋️"}</div>
    <div class="bd"><div class="tt">${esc(ex ? ex.name : l.exName || "Exercise")}</div>
    <div class="sm">${esc(summary(l))}</div>
    ${l.planDay ? `<div class="mt">📋 ${esc(l.planDay)}</div>` : ""}
    ${showWho && l.personName ? `<div class="mt">${esc(l.personName)}</div>` : ""}
    ${l.notes ? `<div class="nt">${esc(l.notes)}</div>` : ""}</div>
    <button class="del" data-act="log-del" data-id="${esc(l.id)}" aria-label="Delete">🗑️</button></div>`;
}
export function viewHistory() {
  // Newest first. Only the last S.histDays days are drawn; "Show older" adds more.
  const all = S.histAll ? S.logs.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0)) : index().mine;
  const seg = S.people.length > 1 ? `<div class="chips"><button class="chip ${!S.histAll ? "on" : ""}" data-act="hist" data-v="me">${esc(myName() || "Me")}</button><button class="chip ${S.histAll ? "on" : ""}" data-act="hist" data-v="all">Everyone</button></div>` : "";
  if (!all.length) return seg + `<div class="empty"><div class="big">🗓️</div>No workouts yet. Your logged workouts will show up here, grouped by day.</div>`;
  const from = new Date(); from.setDate(from.getDate() - S.histDays);
  const cutoff = isoDay(from);
  let list = all.filter((l) => l.date >= cutoff);
  if (!list.length) list = all.slice(0, 20); // nothing recent: show the latest few anyway
  let html = seg, cur = "";
  for (const l of list) {
    if (l.date !== cur) { cur = l.date; html += `<div class="dayh">${esc(dayLabel(cur))}</div>`; }
    html += logCard(l, S.histAll);
  }
  const older = all.length - list.length;
  if (older > 0) html += `<div class="pad"><button class="btn block" data-act="hist-more">Show older (${older} more)</button></div>`;
  return html;
}

/* ---------- buttons ---------- */
action("hist", (a, e, id) => { S.histAll = a.dataset.v === "all"; render(); });
action("hist-more", () => { S.histDays += 180; render(); });

view("history", { order: 4, title: "History", icon: "🗓️", label: "History", render: viewHistory });
