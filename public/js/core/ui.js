// Screen plumbing shared by every feature:
// - registries: tabs (view), buttons (action), screen sections (slot), data (collection), hooks
// - the app shell (header, tab bar, + Log button) and render scheduling
// - full-screen "sheets"
// Core files never import features; features register themselves here.
import { $, esc } from "./util.js";
import { S, myName } from "./state.js";
import { store, subscribe } from "./store.js";

/* ---------- registries ---------- */
const VIEWS = {};      // tab id -> { title, icon, label, order, render, after, search }
const ACTIONS = {};    // data-act name -> (el, event, id) => void
const SLOTS = {};      // screen name -> [{ order, render }]
const COLLS = [];      // [{ name, apply }]
const HOOKS = {};      // name -> [fn]

export const view = (id, def) => { VIEWS[id] = def; };
export const action = (name, fn) => { ACTIONS[name] = fn; };
export const run = (name, ...args) => ACTIONS[name] && ACTIONS[name](...args);
export function slot(screen, order, render) {
  (SLOTS[screen] ||= []).push({ order, render });
  SLOTS[screen].sort((a, b) => a.order - b.order);
}
export const slots = (screen, ...args) => (SLOTS[screen] || []).map((s) => s.render(...args) || "").join("");
export const collection = (name, apply) => COLLS.push({ name, apply });
export const hook = (name, fn) => (HOOKS[name] ||= []).push(fn);
export const runHooks = (name, ...args) => (HOOKS[name] || []).forEach((fn) => fn(...args));

/** Subscribe every registered collection (call once, after the store is open). */
export function startCollections() {
  for (const c of COLLS) subscribe(c.name, (arr) => { c.apply(arr); runHooks("data", c.name); rerender(); });
}

/* ---------- app shell ---------- */
const app = $("#app");
export function render() {
  const v = VIEWS[S.tab] || VIEWS[Object.keys(VIEWS)[0]];
  const sync = store.mode === "cloud" ? `<span class="sync">Shared</span>` : `<span class="sync local" title="Saved on this device only">This device</span>`;
  const tabs = Object.entries(VIEWS).sort((a, b) => a[1].order - b[1].order);
  app.innerHTML = `
    <header class="top"><h1>${v.title} <span class="sp"></span>${sync}<button class="who" data-act="people">👤 ${esc(myName() || "Who?")}</button></h1>${v.search ? v.search() : ""}</header>
    ${v.render()}
    <button class="fab" data-act="log-new"><b>+</b> Log</button>
    <nav class="tabs">
      ${tabs.map(([id, t]) => `<button data-tab="${id}" class="${S.tab === id ? "on" : ""}"><span class="ic">${t.icon}</span>${t.label}</button>`).join("")}
    </nav>`;
  if (v.after) v.after();
}

let renderQueued = false;
/** Re-draw on the next frame (many data changes in a row cause one redraw). */
export function rerender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const q = document.activeElement && document.activeElement.id === "q";
    render();
    runHooks("rerender");
    if (q) { const el = $("#q"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
  });
}

/* ---------- sheets (full-screen views) ---------- */
export const sheets = [];
export function openSheet(html, onClose) {
  const el = document.createElement("div");
  el.className = "sheet";
  el.innerHTML = `<div class="in">${html}</div>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  sheets.push({ el, onClose });
  return el;
}
export function closeSheet() {
  const s = sheets.pop();
  if (!s) return;
  if (s.onClose) s.onClose();
  s.el.remove();
  if (!sheets.length) document.body.style.overflow = "";
}
export const topSheet = () => sheets[sheets.length - 1];
export const closeAllSheets = () => { while (sheets.length) closeSheet(); };
export function reopenTop(fn) { closeSheet(); fn(); }

/* ---------- one click handler for the whole app ---------- */
document.addEventListener("click", (e) => {
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) { S.tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const a = e.target.closest("[data-act]");
  if (!a || a.tagName === "INPUT") return;
  const fn = ACTIONS[a.dataset.act];
  if (fn) fn(a, e, a.dataset.id);
});
action("close", () => closeSheet());
