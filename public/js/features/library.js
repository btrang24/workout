import { thumb } from "../core/media.js";
import { GROUPS, S, allEx, isNoEquip } from "../core/state.js";
import { personalBest } from "../core/stats.js";
import { action, render, view } from "../core/ui.js";
import { $, esc } from "../core/util.js";

export function filteredEx() {
  const q = S.q.trim().toLowerCase();
  return allEx().filter((e) => {
    if (S.filter === "No equipment" && !isNoEquip(e)) return false;
    if (S.filter === "Mine" && !e.custom) return false;
    if (GROUPS.includes(S.filter) && e.group !== S.filter) return false;
    if (q && !(e.name + " " + (e.aliases || []).join(" ") + " " + (e.muscles || "") + " " + e.group + " " + (e.equip || "")).toLowerCase().includes(q)) return false;
    return true;
  });
}
export function libGrid() {
  const list = filteredEx();
  const tiles = list.map((e) => {
    const pb = personalBest(e);
    return `<button class="tile" data-act="ex" data-id="${esc(e.id)}">
      <div class="ph">${thumb(e)}</div>
      <div class="tx"><div class="tt">${esc(e.name)}</div>
      <div class="mt">${esc(e.group)} · ${isNoEquip(e) ? "No equipment" : esc(e.equip || "")}</div>
      ${pb ? `<div class="pb">🏆 ${esc(pb.label)}</div>` : ""}</div></button>`;
  }).join("");
  const note = S.filter === "No equipment" ? `<div class="note" style="grid-column:1/-1">No gym today? Every exercise also lists a <b>no-equipment swap</b> under “Alternatives”.</div>` : "";
  return `<div class="grid" id="libgrid">${note}${tiles}
    <button class="tile add" data-act="ex-new"><span class="big">+</span>Add your own exercise</button></div>`;
}
export function viewLibrary() {
  const used = new Set(allEx().map((e) => e.group));
  const chips = ["All", "No equipment", ...GROUPS.filter((g) => used.has(g)), ...(S.custom.length ? ["Mine"] : [])];
  return `<div class="chips">${chips.map((c) => `<button class="chip ${S.filter === c ? "on" : ""}" data-act="filter" data-v="${esc(c)}">${esc(c)}</button>`).join("")}</div>${libGrid()}`;
}

/* ---------- buttons ---------- */
action("filter", (a, e, id) => { S.filter = a.dataset.v; render(); });

view("library", {
  order: 1, title: "Exercises", icon: "🏋️", label: "Exercises", render: viewLibrary,
  search: () => `<input class="search" id="q" type="search" placeholder="Search exercises" value="${esc(S.q)}" autocomplete="off">`,
  after: () => {
    const q = $("#q");
    if (q) q.addEventListener("input", () => { S.q = q.value; const g = $("#libgrid"); if (g) g.outerHTML = libGrid(); });
  },
});
