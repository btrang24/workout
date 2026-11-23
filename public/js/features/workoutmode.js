// Workout mode: a full-screen view over a session, one exercise at a time, with big buttons.
// "✓ Done" logs one set in a single tap (today's suggestion, or the set before), starts the
// rest timer, and adds to that exercise's log for this session. Same data as the session list.
import { thumb } from "../core/media.js";
import { S, exById, myName } from "../core/state.js";
import { bestOf, lastLog, personalBest, summary } from "../core/stats.js";
import { saveDoc } from "../core/store.js";
import { action, closeSheet, hook, openSheet, run, runHooks, slot } from "../core/ui.js";
import { $, conv, dayLabel, esc, isoDay } from "../core/util.js";
import { openLog } from "./log.js";
import { suggest, suggestLabel } from "./overload.js";
import { dayForSession, slotChoice, slotLabel } from "./plans.js";

let WM = null; // { sid, i, el }
const sessLogs = (sid, i) => S.logs.filter((l) => l.sessionId === sid && l.slot === i).sort((a, b) => (a.ts || 0) - (b.ts || 0));

/** The set a single tap will log: repeat the set before, else today's suggestion, else last time. */
function nextSet(ex, sl, log) {
  const prev = log && log.sets[log.sets.length - 1];
  if (prev) return { ...prev, unit: log.unit || "lb" };
  const last = lastLog(ex.id), sg = suggest(ex, sl, last);
  if (sg) return ex.kind === "time" ? { s: sg.s, unit: sg.unit } : { w: sg.w, r: sg.r, unit: sg.unit };
  const f = last && last.sets[0];
  return f ? { ...f, unit: last.unit || "lb" } : null;
}
const label = (ex, st) => (st ? suggestLabel(ex, { ...st, s: st.s }, S.unit) : "");

export function openWorkoutMode(sid, i) {
  const sess = S.sessions.find((x) => x.id === sid), day = sess && dayForSession(sess);
  if (!day) return;
  if (i == null) { i = day.slots.findIndex((_, j) => !sessLogs(sid, j).length); if (i < 0) i = 0; }
  const el = openSheet(`<div id="wmbody" class="wm"></div>`, () => { WM = null; });
  WM = { sid, i, el };
  renderWM();
}
function renderWM() {
  const sess = S.sessions.find((x) => x.id === WM.sid), box = $("#wmbody", WM.el);
  const day = sess && dayForSession(sess);
  if (!day) { closeSheet(); return; }
  const n = day.slots.length, i = Math.min(WM.i, n - 1), sl = day.slots[i];
  const exId = slotChoice(sl, sess, i), ex = exById(exId);
  const logs = sessLogs(sess.id, i), log = logs[logs.length - 1];
  const done = logs.reduce((t, l) => t + (l.sets || []).length, 0);
  const nx = ex && nextSet(ex, sl, log);
  const last = lastLog(exId), sg = ex && !log ? suggest(ex, sl, last) : null;
  const enough = done >= sl.sets;
  box.innerHTML = `
    <div class="sbar"><button class="btn sm" data-act="close">‹ List</button><div class="sp">${i + 1} of ${n} · ${esc(day.name)}</div><span style="width:60px"></span></div>
    <div class="wmph" data-act="ex" data-id="${esc(exId)}">${ex ? thumb(ex) : ""}</div>
    <div class="det">
      <div class="tg small">${esc(sl.body)}${sl.name ? " · " + esc(sl.name) : ""}</div>
      <h2 style="margin:2px 0 4px">${esc(slotLabel(sl, exId))}</h2>
      <div class="wmtarget">Target: <b>${sl.sets} × ${esc(sl.reps)}</b> · done <b>${done}</b></div>
      ${sg ? `<div class="last sgline">💡 Today: <b>${esc(suggestLabel(ex, sg, S.unit))}</b> · ${esc(sg.note)}</div>` : ""}
      ${last && !log ? `<div class="last">Last time: ${esc(summary(last))} (${esc(dayLabel(last.date))})</div>` : ""}
      ${log ? `<div class="wmsets">${logs.flatMap((l) => l.sets).map((st, j) => `<span class="chip sm on">${j + 1}: ${esc(label(ex, { ...st, unit: log.unit }))} ✓</span>`).join("")}</div>` : ""}
      ${sl.note ? `<div class="last">${esc(sl.note)}</div>` : ""}
      <button class="btn ${enough ? "" : "pri"} block wmbig" data-act="wm-set">${nx ? `✓ Done set ${done + 1}: ${esc(label(ex, nx))}` : "Enter set " + (done + 1)}</button>
      <div class="btnrow"><button class="btn" data-act="wm-edit">Edit sets</button><button class="btn" data-act="wm-rest">⏱ Rest</button></div>
      <div class="btnrow wmnav">
        <button class="btn" data-act="wm-go" data-v="${i - 1}" ${i ? "" : "disabled"}>◀ Previous</button>
        ${i < n - 1 ? `<button class="btn ${enough ? "pri" : ""}" data-act="wm-go" data-v="${i + 1}">Next ▶</button>` : `<button class="btn ${enough ? "pri" : ""}" data-act="wm-finish">Finish workout</button>`}
      </div>
    </div>`;
}

function logOneSet() {
  const sess = S.sessions.find((x) => x.id === WM.sid), day = dayForSession(sess), i = WM.i, sl = day.slots[i];
  const ex = exById(slotChoice(sl, sess, i));
  const logs = sessLogs(sess.id, i), log = logs[logs.length - 1];
  const nx = nextSet(ex, sl, log);
  if (!nx) { editSets(); return; }
  const unit = log ? log.unit || "lb" : S.unit;
  const set = ex.kind === "time" ? { s: nx.s } : { w: Math.round(conv(nx.w || 0, nx.unit, unit) * 2) / 2, r: nx.r || 0 };
  const pb = personalBest(ex), mine = bestOf(ex, [set], unit);
  const pr = pb && mine && mine.score > pb.score ? mine : null;
  saveDoc("logs", log ? { ...log, sets: [...log.sets, set], pr: log.pr || (pr ? true : undefined) } : {
    exId: ex.id, exName: ex.name, kind: ex.kind, date: isoDay(), unit, sets: [set], notes: "", ts: Date.now(),
    personId: S.personId || "", personName: myName() || "", sessionId: sess.id, slot: i, planDay: day.name,
    target: { sets: sl.sets, reps: sl.reps, name: sl.name }, pr: pr ? true : undefined,
  });
  runHooks("setDone", ex);
  if (pr) runHooks("logSaved", { ex, isNew: true, pr });
}
function editSets() {
  const sess = S.sessions.find((x) => x.id === WM.sid), day = dayForSession(sess), i = WM.i, sl = day.slots[i];
  const logs = sessLogs(sess.id, i);
  if (logs.length) openLog({ logId: logs[logs.length - 1].id });
  else openLog({ exId: slotChoice(sl, sess, i), session: { sessionId: sess.id, slot: i, planDay: day.name, target: { sets: sl.sets, reps: sl.reps, name: sl.name } } });
}

slot("session-top", 10, (sess) => `<button class="btn pri block" style="margin-top:10px" data-act="wm-open" data-id="${esc(sess.id)}">▶ Workout mode: one exercise at a time</button>`);
hook("rerender", () => { if (WM) renderWM(); });
action("wm-open", (a, e, id) => openWorkoutMode(id));
action("wm-set", () => logOneSet());
action("wm-edit", () => editSets());
action("wm-rest", () => {
  const sess = S.sessions.find((x) => x.id === WM.sid), sl = dayForSession(sess).slots[WM.i];
  runHooks("setDone", exById(slotChoice(sl, sess, WM.i)));
});
action("wm-go", (a) => { WM.i = +a.dataset.v; renderWM(); WM.el.scrollTo(0, 0); });
action("wm-finish", () => { closeSheet(); run("sess-finish"); });
