// Interval timer for timed workouts (Tabata, "30 sec on / 30 sec off" circuits, rounds).
// A saved routine with `timer: { work, rest, rounds, roundRest }` plays as a list of steps:
// get ready → (exercise → rest) × exercises × rounds, with extra rest between rounds.
// Each step stores its END time, so the clock stays right if the phone stalls; beeps,
// vibration and (optional) spoken names mark every change; the screen stays on.
import { thumb } from "../core/media.js";
import { S, exById, myName } from "../core/state.js";
import { saveMany } from "../core/store.js";
import { action, closeSheet, openSheet, run, runHooks } from "../core/ui.js";
import { $, esc, fmtClock, isoDay, toast } from "../core/util.js";

const READY = 10;
/** The steps of a timed routine. Pure: routine in, steps out. */
export function timeline(r) {
  const t = r.timer || {}, slots = r.slots || [], steps = [{ type: "ready", secs: READY, slot: 0, round: 1 }];
  const rounds = Math.max(1, Number(t.rounds) || 1);
  for (let round = 1; round <= rounds; round++) {
    slots.forEach((sl, i) => {
      steps.push({ type: "work", secs: Number(sl.secs) || Number(t.work) || 30, slot: i, round });
      const last = i === slots.length - 1;
      if (last && round < rounds && Number(t.roundRest) > 0) steps.push({ type: "roundrest", secs: Number(t.roundRest), slot: 0, round: round + 1 });
      else if (!(last && round === rounds) && Number(t.rest) > 0) steps.push({ type: "rest", secs: Number(t.rest), slot: last ? 0 : i + 1, round: last ? round + 1 : round });
    });
  }
  return steps;
}
export const totalSecs = (r) => timeline(r).slice(1).reduce((t, s) => t + s.secs, 0);
export function timerLabel(r) {
  const t = r.timer;
  if (!t) return "";
  return `${t.work} sec on · ${t.rest} sec off · ${t.rounds} round${t.rounds == 1 ? "" : "s"}${t.roundRest ? ` · ${t.roundRest} sec between rounds` : ""} · about ${Math.round(totalSecs(r) / 60)} min`;
}

/* ---------- sound, vibration, voice ---------- */
let audio = null;
const VOICE = "wk:ivVoice";
const voiceOn = () => localStorage.getItem(VOICE) !== "off";
function beep(freq = 880, len = 0.12) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = freq; g.gain.value = 0.18; o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + len);
  } catch {}
}
function say(text) {
  if (!voiceOn() || !("speechSynthesis" in window)) return;
  try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch {}
}

/* ---------- player ---------- */
let P = null; // { rid, steps, i, end, paused, left, el, tick, lastSec, started }
const nameOf = (r, i) => ((r.slots[i] || {}).options || [{}])[0].label || "Exercise";

export function startIntervals(rid) {
  const r = S.routines.find((x) => x.id === rid);
  if (!r || !r.timer) return;
  if (!audio) try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  const el = openSheet(`<div id="ivbody" class="iv"></div>`, () => { clearInterval(P && P.tick); P = null; runHooks("sessionClose"); if ("speechSynthesis" in window) speechSynthesis.cancel(); });
  P = { rid, steps: timeline(r), i: 0, end: 0, paused: false, left: 0, el, lastSec: null, started: Date.now() };
  runHooks("sessionOpen", rid);
  go(0);
  P.tick = setInterval(draw, 200);
}
function go(i) {
  const r = S.routines.find((x) => x.id === P.rid);
  if (i >= P.steps.length) { finish(); return; }
  P.i = Math.max(0, i);
  const st = P.steps[P.i];
  P.end = Date.now() + st.secs * 1000; P.left = st.secs * 1000; P.lastSec = null;
  if (navigator.vibrate) navigator.vibrate(st.type === "work" ? [250] : [120, 80, 120]);
  beep(st.type === "work" ? 1175 : 660, 0.25);
  say(st.type === "work" ? nameOf(r, st.slot) : st.type === "ready" ? "Get ready: " + nameOf(r, 0) : "Rest. Next: " + nameOf(r, st.slot));
  draw();
}
function draw() {
  if (!P) return;
  const r = S.routines.find((x) => x.id === P.rid), box = $("#ivbody", P.el);
  if (!r || !box) return;
  const st = P.steps[P.i];
  const msLeft = P.paused ? P.left : P.end - Date.now();
  if (!P.paused && msLeft <= 0) { go(P.i + 1); return; }
  const sec = Math.ceil(msLeft / 1000);
  if (!P.paused && sec !== P.lastSec) { if (sec <= 3 && sec >= 1) beep(880, 0.1); P.lastSec = sec; }
  const ex = exById(((r.slots[st.slot] || {}).options || [{}])[0].ex);
  const nextWork = P.steps.slice(P.i + 1).find((s) => s.type === "work");
  const done = P.steps.slice(1, P.i).reduce((t, s) => t + s.secs, 0) + (st.type === "ready" ? 0 : st.secs - Math.max(0, msLeft / 1000));
  const pct = Math.min(100, (done / totalSecs(r)) * 100);
  const label = { ready: "Get ready", work: "Work", rest: "Rest", roundrest: "Round rest" }[st.type];
  box.innerHTML = `
    <div class="sbar"><button class="btn sm" data-act="iv-stop">✕ End</button><div class="sp">${esc(r.name)}</div><button class="btn sm" data-act="iv-voice">${voiceOn() ? "🔊" : "🔈"}</button></div>
    <div class="ivphase ${st.type}">
      <div class="lab">${label}</div>
      <div class="clock">${fmtClock(Math.max(0, sec))}</div>
      <div class="ex">${esc(st.type === "work" ? nameOf(r, st.slot) : "Next: " + nameOf(r, st.slot))}</div>
      <div class="meta">Round ${st.round} of ${r.timer.rounds} · exercise ${st.slot + 1} of ${r.slots.length}</div>
    </div>
    <div class="ivbar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="ivph" data-act="ex" data-id="${esc(ex ? ex.id : "")}">${ex ? thumb(ex) : ""}</div>
    ${nextWork && st.type === "work" ? `<div class="small" style="text-align:center;margin-top:6px">Up next: <b>${esc(nameOf(r, nextWork.slot))}</b></div>` : ""}
    <div class="btnrow ivctl">
      <button class="btn" data-act="iv-prev" aria-label="Back">⏮</button>
      <button class="btn pri" data-act="iv-pause">${P.paused ? "▶ Resume" : "⏸ Pause"}</button>
      <button class="btn" data-act="iv-next" aria-label="Skip">⏭</button>
    </div>`;
}
function finish() {
  clearInterval(P.tick);
  const r = S.routines.find((x) => x.id === P.rid), mins = Math.round((Date.now() - P.started) / 60000);
  beep(1320, 0.4); say("Workout complete. Well done!");
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  $("#ivbody", P.el).innerHTML = `
    <div class="sbar"><button class="btn sm" data-act="close">Close</button><div class="sp">${esc(r.name)}</div><span style="width:60px"></span></div>
    <div class="ivphase done"><div class="lab">Done!</div><div class="clock">🎉</div><div class="ex">${r.timer.rounds} rounds · ${mins} min</div></div>
    <div class="pad"><button class="btn pri block" data-act="iv-save">Save to history</button>
    <div class="small" style="margin-top:6px;text-align:center">Saves each exercise as ${r.timer.rounds} × its work time.</div></div>`;
}
function saveToHistory() {
  if (!S.personId) { run("people"); toast("First, pick who's working out on this phone."); return; }
  const r = S.routines.find((x) => x.id === P.rid), ts = Date.now();
  const logs = r.slots.map((sl, i) => {
    const o = sl.options[0] || {}, ex = exById(o.ex), secs = Number(sl.secs) || Number(r.timer.work) || 30;
    return { exId: o.ex, exName: ex ? ex.name : o.label, kind: "time", date: isoDay(), unit: S.unit, sets: Array.from({ length: Number(r.timer.rounds) || 1 }, () => ({ s: secs })),
      notes: "", ts: ts + i, personId: S.personId, personName: myName(), planDay: r.name, routineId: r.id };
  });
  saveMany("logs", logs).then(() => toast("Saved to history 💪"));
  closeSheet();
}

action("iv-start", (a, e, id) => { while (document.querySelector(".sheet")) closeSheet(); startIntervals(id); });
action("iv-pause", () => {
  if (P.paused) { P.end = Date.now() + P.left; P.paused = false; } else { P.left = P.end - Date.now(); P.paused = true; }
  draw();
});
action("iv-next", () => go(P.i + 1));
action("iv-prev", () => go(Date.now() - (P.end - P.steps[P.i].secs * 1000) > 3000 ? P.i : P.i - 1));
action("iv-stop", () => { if (confirm("End this workout?")) closeSheet(); });
action("iv-voice", () => { localStorage.setItem(VOICE, voiceOn() ? "off" : "on"); draw(); });
action("iv-save", () => saveToHistory());
