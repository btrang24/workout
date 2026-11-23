// Rest timer between sets. Starts when a set is ticked ✓ (hook "setDone").
// Stores the END time (not a countdown), so it stays right if the phone sleeps or the app reloads.
// Limit: phones don't let a web app ring while it's fully closed.
import { action, hook, slot } from "../core/ui.js";
import { esc, fmtClock, toast } from "../core/util.js";

const KEY = "wk:rest", PREF = "wk:restPref";
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const pref = () => load(PREF, "auto"); // "auto" | "off" | seconds

/** Rest length for an exercise: heavy barbell lifts 2:00, other weights 1:30, bodyweight 1:00. */
export function restFor(ex) {
  const p = pref();
  if (p === "off" || !ex || ex.group === "Cardio") return 0;
  if (p !== "auto") return Number(p) || 0;
  if (ex.kind === "weight") return /barbell/i.test(ex.equip || "") ? 120 : 90;
  return 60;
}

let T = load(KEY, null); // { end, total, label }
let tick = null, audio = null;
const pill = document.createElement("div");
pill.className = "restpill hide";
document.body.appendChild(pill);

function beep() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; g.gain.value = 0.15;
      o.connect(g).connect(audio.destination);
      o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.15);
    });
  } catch {}
}
function draw() {
  if (!T) { pill.classList.add("hide"); return; }
  const left = Math.ceil((T.end - Date.now()) / 1000);
  if (left <= 0) {
    stop();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    beep();
    toast("⏱ Rest over: next set!", 4000);
    return;
  }
  const pct = Math.max(0, Math.min(100, (left / T.total) * 100));
  pill.classList.remove("hide");
  pill.innerHTML = `<div class="bar" style="width:${pct}%"></div>
    <button data-act="rest-add" data-v="-15" aria-label="15 seconds less">−15</button>
    <div class="t"><b>${fmtClock(left)}</b><span>Rest${T.label ? " · " + esc(T.label) : ""}</span></div>
    <button data-act="rest-add" data-v="15" aria-label="15 seconds more">+15</button>
    <button data-act="rest-stop" aria-label="Stop the timer">✕</button>`;
}
export function startRest(sec, label = "") {
  if (!sec) return;
  if (audio && audio.state === "suspended") audio.resume();
  T = { end: Date.now() + sec * 1000, total: sec, label };
  localStorage.setItem(KEY, JSON.stringify(T));
  clearInterval(tick); tick = setInterval(draw, 250); draw();
}
export function stop() {
  T = null; localStorage.removeItem(KEY);
  clearInterval(tick); tick = null; draw();
}
if (T && T.end > Date.now()) { tick = setInterval(draw, 250); draw(); } else if (T) stop();

hook("setDone", (ex) => { if (!audio) try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {} startRest(restFor(ex), ex && ex.name); });
action("rest-add", (a) => { if (!T) return; T.end += +a.dataset.v * 1000; T.total = Math.max(T.total, Math.ceil((T.end - Date.now()) / 1000)); localStorage.setItem(KEY, JSON.stringify(T)); draw(); });
action("rest-stop", () => stop());
action("rest-pref", (a) => {
  localStorage.setItem(PREF, JSON.stringify(a.dataset.v));
  a.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === a));
});
slot("settings", 10, () => {
  const p = String(pref());
  const opts = [["auto", "Auto"], ["60", "1:00"], ["90", "1:30"], ["120", "2:00"], ["180", "3:00"], ["off", "Off"]];
  return `<div class="f"><span class="lbl">Rest timer between sets</span>
    <div class="chips wrap" style="padding:0">${opts.map(([v, n]) => `<button class="chip sm ${p === v ? "on" : ""}" data-act="rest-pref" data-v="${v}">${n}</button>`).join("")}</div>
    <div class="hint">Auto: 2:00 for barbell lifts, 1:30 for other weights, 1:00 for bodyweight. Starts when you tick ✓ a set.</div></div>`;
});
