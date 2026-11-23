import { S } from "../core/state.js";
import { saveDoc, store } from "../core/store.js";
import { action, closeSheet, collection, openSheet, render, topSheet } from "../core/ui.js";
import { $, esc } from "../core/util.js";

/* ---------- People & settings ---------- */
export function openPeople(after) {
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">Done</button><div class="sp">Who's on this phone?</div><span style="width:60px"></span></div>
    <div class="ed">
      <p class="small" style="margin-top:0">Pick your name so your workouts and progress stay separate from the rest of the household. Each phone remembers its own choice.</p>
      <ul class="plist">${S.people.map((p) => `<li class="${p.id === S.personId ? "on" : ""}" data-act="person" data-id="${esc(p.id)}"><span>👤</span><span class="sp">${esc(p.name)}</span>${p.id === S.personId ? "✓" : ""}</li>`).join("") || `<li style="cursor:default" class="small">No one added yet.</li>`}</ul>
      <div class="f" style="margin-top:14px"><label for="pname">Add a person</label><div class="withmic"><input id="pname" placeholder="Name" autocomplete="off" enterkeyhint="done"><button class="btn pri" data-act="person-add">Add</button></div></div>
      <div class="f"><span class="lbl">Weights on this phone</span><div class="seg"><button data-act="unit" data-v="lb" class="${S.unit === "lb" ? "on" : ""}">Pounds (lb)</button><button data-act="unit" data-v="kg" class="${S.unit === "kg" ? "on" : ""}">Kilograms (kg)</button></div></div>
      <p class="small">${store.mode === "cloud" ? "✅ Workouts are shared with everyone who has this app's link." : "⚠️ Not connected to the shared database. Workouts are saved on this device only."}</p>
    </div>`;
  const el = openSheet(html);
  el._after = after;
  $("#pname", el).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addPerson(); } });
}
export function choosePerson(id) {
  S.personId = id;
  localStorage.setItem("wk:person", id);
  const el = topSheet().el, after = el._after;
  closeSheet();
  render();
  if (after) after();
}
export function addPerson() {
  const inp = $("#pname"), name = inp.value.trim();
  if (!name) return;
  const id = saveDoc("people", { name });
  choosePerson(id);
}

/* ---------- buttons ---------- */
action("people", (a, e, id) => { openPeople(); });
action("person", (a, e, id) => { choosePerson(id); });
action("person-add", (a, e, id) => { addPerson(); });
action("unit", (a, e, id) => {
  S.unit = a.dataset.v; localStorage.setItem("wk:unit", S.unit);
  a.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === a)); render();
});

collection("people", (arr) => { S.people = arr.sort((a, b) => a.name.localeCompare(b.name)); S.loaded.people = true; });
