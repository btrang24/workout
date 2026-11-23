import { CARDIO, PLANS, SPECIALS } from "../core/data.js";
import { thumb } from "../core/media.js";
import { S, exById, me, myLogs, myName } from "../core/state.js";
import { lastLog, summary } from "../core/stats.js";
import { deleteDoc, saveDoc } from "../core/store.js";
import { action, closeSheet, collection, hook, openSheet, render, reopenTop, rerender, sheets, slot, slots } from "../core/ui.js";
import { $, dayLabel, esc, isoDay, toast } from "../core/util.js";
import { openLog } from "./log.js";
import { openPeople } from "./people.js";

/* ============================================================
   Workout plans
   ============================================================ */
export const planById = (id) => PLANS.find((p) => p.id === id);
export const myPlan = () => (me() ? planById(me().planId) : null);
export const specialFor = (person) => SPECIALS.find((d) => d.key === (person && person.special)) || SPECIALS[0];
export function planSeq(plan, person) {
  return plan.sequence.map((d) => (d === "SPECIAL" ? specialFor(person) : d));
}
export const mySessions = () => S.sessions.filter((x) => x.personId === S.personId);
export function activeSession() {
  return mySessions().filter((x) => !x.finishedAt).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0];
}
export function lastFinished(planId) {
  return mySessions().filter((x) => x.finishedAt && x.planId === planId).sort((a, b) => b.finishedAt - a.finishedAt)[0];
}
export function nextSeqIndex(plan) {
  const last = lastFinished(plan.id);
  const n = plan.sequence.length;
  return last ? (Number(last.seq) + 1) % n : 0;
}
export function dayForSession(sess) {
  if (sess.routineId) return sess.day || null; // workouts from videos keep a copy of the routine as it was when started
  const plan = planById(sess.planId);
  if (!plan) return null;
  const owner = S.people.find((p) => p.id === sess.personId);
  if (sess.dayKey && sess.dayKey.startsWith("SP_")) return SPECIALS.find((d) => d.key === sess.dayKey);
  return planSeq(plan, owner)[sess.seq] || null;
}
export function slotChoice(slot, sess, i) {
  if (sess && sess.choices && sess.choices[i]) return sess.choices[i];
  const ids = slot.options.map((o) => o.ex);
  const recent = myLogs().filter((l) => ids.includes(l.exId)).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  return recent ? recent.exId : ids[0];
}
export const slotLabel = (slot, exId) => (slot.options.find((o) => o.ex === exId) || {}).label || (exById(exId) || {}).name || "";
export function restNote(plan) {
  const last = lastFinished(plan.id);
  if (!last) return "";
  const y = new Date(); y.setDate(y.getDate() - 1);
  const lastDay = dayForSession(last);
  const name = lastDay ? lastDay.name : "";
  if (last.date === isoDay()) return `✅ You did ${esc(name)} today. Nice work! Next one is below.`;
  if (last.date === isoDay(y) && (plan.restAfterEvery || (plan.restAfter || []).includes(last.dayKey)))
    return `😴 Rest day suggested today (you did ${esc(name)} yesterday). Cardio is fine today.`;
  return "";
}
export function weekRange() {
  const d = new Date(), dow = (d.getDay() + 6) % 7; // Monday = 0
  const mon = new Date(d); mon.setDate(d.getDate() - dow);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [isoDay(mon), isoDay(sun)];
}
export function cardioWeek() {
  const [a, b] = weekRange();
  const logs = myLogs().filter((l) => l.date >= a && l.date <= b && (exById(l.exId) || {}).group === "Cardio");
  const secs = logs.reduce((t, l) => t + (l.sets || []).reduce((u, st) => u + (Number(st.s) || 0), 0), 0);
  return { min: Math.round(secs / 60), sessions: logs.length };
}
export function slotList(day, sess) {
  return `<ol class="slots">${day.slots.map((sl, i) => {
    const exId = slotChoice(sl, sess, i);
    return `<li><div class="nm">${esc(slotLabel(sl, exId))}<div class="sub">${esc(sl.body)} · ${esc(sl.name)}</div></div><div class="sr">${sl.sets} × ${esc(sl.reps)}</div></li>`;
  }).join("")}</ol>`;
}
export function planCards() {
  let html = "";
  const person = me();
  const act = activeSession();
  if (act) {
    const day = dayForSession(act);
    const done = new Set(S.logs.filter((l) => l.sessionId === act.id).map((l) => l.slot)).size;
    html += `<div class="plan"><div class="ph"><div class="k">Workout in progress</div><div class="t">${esc(day ? day.name : "Workout")}</div><div class="f">${done} of ${day ? day.slots.length : "?"} exercises done</div></div>
      <div class="bd"><button class="btn pri block" data-act="sess-open" data-id="${esc(act.id)}">Continue workout</button></div></div>`;
  }
  const plan = myPlan();
  if (!plan && !act) {
    html += `<div class="plan"><div class="ph"><div class="k">Workout plan</div><div class="t">Pick a plan</div><div class="f">3, 4, 5 or 6-day Push Pull Legs, plus Cardio</div></div>
      <div class="bd"><div class="small">Choose a plan and the app tells you what's on today, in order, with sets and reps.</div><button class="btn pri block" style="margin-top:10px" data-act="plans">Choose a plan</button></div></div>`;
  } else if (plan && !act) {
    const idx = nextSeqIndex(plan), seq = planSeq(plan, person), day = seq[idx];
    const note = restNote(plan);
    html += `<div class="plan"><div class="ph"><div class="k">${esc(plan.short)} · up next</div><div class="t">${esc(day.name)}</div><div class="f">${esc(day.focus)} · ${day.slots.length} exercises</div></div>
      <div class="bd">${note ? `<div class="rest">${note}</div>` : ""}
      ${slotList(day, null)}
      <div class="btnrow"><button class="btn pri" data-act="sess-start" data-seq="${idx}">Start workout</button><button class="btn" data-act="plan-days">Other day</button></div>
      <div class="small" style="margin-top:8px;text-align:center"><a href="#" data-act="plans">Plan settings</a></div></div></div>`;
  }
  if (person && person.cardio) {
    const c = cardioWeek(), pct = Math.min(100, Math.round((c.min / CARDIO.minutesPerWeek) * 100));
    html += `<div class="plan cardio"><div class="ph"><div class="k">Cardio this week</div><div class="t">${c.min} / ${CARDIO.minutesPerWeek} min</div><div class="f">${c.sessions} session${c.sessions === 1 ? "" : "s"} · Monday to Sunday</div></div>
      <div class="bd"><div class="bar2"><i style="width:${pct}%"></i></div>
      <div class="small">${c.min >= CARDIO.minutesPerWeek ? "🎉 Weekly goal done!" : `${CARDIO.minutesPerWeek - c.min} min to go. Conversational pace, and keep it at least 6 hours away from lifting.`}</div>
      <div class="chips wrap">${CARDIO.exercises.map((id) => `<button class="chip sm" data-act="log-ex" data-id="${id}">${exById(id).emoji || ""} ${esc(exById(id).name)}</button>`).join("")}</div></div></div>`;
  }
  return html;
}

export function openPlans() {
  if (!me()) { openPeople(() => openPlans()); toast("First, who's this plan for?"); return; }
  const person = me();
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">Done</button><div class="sp">${esc(person.name)}'s plan</div><span style="width:60px"></span></div>
    <div class="ed">
      <div class="lbl">Lifting plan</div>
      ${PLANS.map((p) => `<div class="pl ${person.planId === p.id ? "on" : ""}" data-act="plan-set" data-id="${p.id}">
        <div class="t">${person.planId === p.id ? "✓ " : ""}${esc(p.name)}</div><div class="d">${esc(p.blurb)}</div>
        ${person.planId === p.id ? `<div class="sec" style="margin-top:10px"><div class="lbl">Suggested week</div><ul class="bul good">${p.schedule.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          ${p.specials ? `<div class="lbl" style="margin-top:10px">Your specialized day (the body part you want to improve)</div><div class="chips wrap">${p.specials.map((d) => `<button class="chip sm ${specialFor(person).key === d.key ? "on" : ""}" data-act="plan-special" data-v="${d.key}">${esc(d.name)}</button>`).join("")}</div>` : ""}
          <div class="lbl" style="margin-top:10px">The days in order</div>${planSeq(p, person).map((d, i) => `<div class="small">${i + 1}. <b>${esc(d.name)}</b>: ${esc(d.focus)}</div>`).join("")}
          <div class="lbl" style="margin-top:10px">How to use it</div><ul class="bul good">${p.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      </div>`).join("")}
      ${person.planId ? `<button class="btn block" data-act="plan-set" data-id="">Stop following a plan</button>` : ""}
      <div class="lbl" style="margin-top:20px">Add-on</div>
      <div class="pl ${person.cardio ? "on" : ""}" data-act="plan-cardio">
        <div class="t">${person.cardio ? "✓ " : ""}Cardio: ${CARDIO.minutesPerWeek} min a week</div><div class="d">${esc(CARDIO.blurb)} Tracks your weekly minutes on the Today tab.</div>
        ${person.cardio ? `<ul class="bul good" style="margin-top:8px">${CARDIO.rules.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>
      <p class="small">Plans typed in from ${esc(window.WORKOUT_PLANS.source)}.</p>
    </div>`;
  openSheet(html);
}
export function updateMe(patch) {
  const p = me();
  if (!p) return;
  Object.assign(p, patch);
  saveDoc("people", { ...p, ...patch });
}

export function openDayPicker() {
  const plan = myPlan(); if (!plan) return;
  const seq = planSeq(plan, me()), next = nextSeqIndex(plan);
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">Cancel</button><div class="sp">Pick a different day</div><span style="width:60px"></span></div>
    <div class="ed"><p class="small" style="margin-top:0">After this workout, the plan carries on from the day you pick.</p>
    ${seq.map((d, i) => `<div class="pl ${i === next ? "on" : ""}" data-act="sess-start" data-seq="${i}"><div class="t">${esc(d.name)}${i === next ? " · up next" : ""}</div><div class="d">${esc(d.focus)} · ${d.slots.length} exercises</div></div>`).join("")}
    </div>`;
  openSheet(html);
}
export function startSession(seq) {
  const plan = myPlan(); if (!plan) return;
  const act = activeSession();
  if (act) { openSession(act.id); return; }
  const day = planSeq(plan, me())[seq];
  const id = saveDoc("sessions", {
    personId: S.personId, personName: myName(), planId: plan.id, seq, dayKey: day.key, dayName: day.name,
    date: isoDay(), startedAt: Date.now(), finishedAt: null, choices: {},
  });
  while (sheets.length) closeSheet();
  setTimeout(() => openSession(id), 50);
}
export let SESS = null; // { id, el }
export function openSession(id) {
  const el = openSheet(`<div id="sessbody"></div>`, () => { SESS = null; });
  SESS = { id, el };
  renderSession();
}
export function refreshSessionSheet() { if (SESS) renderSession(); }
export function renderSession() {
  const sess = S.sessions.find((x) => x.id === SESS.id);
  const box = $("#sessbody", SESS.el);
  if (!sess) { box.innerHTML = `<div class="sbar"><button class="btn sm" data-act="close">Close</button><div class="sp">Workout</div></div><div class="empty">This workout was removed.</div>`; return; }
  const day = dayForSession(sess), plan = planById(sess.planId);
  const logs = S.logs.filter((l) => l.sessionId === sess.id);
  const doneCount = new Set(logs.map((l) => l.slot)).size;
  const finished = !!sess.finishedAt;
  box.innerHTML = `
    <div class="sbar"><button class="btn sm" data-act="close">‹ Back</button><div class="sp">${esc(day.name)}</div>${finished ? `<span style="width:60px"></span>` : `<button class="btn sm pri" data-act="sess-finish">Finish</button>`}</div>
    <div class="det" style="padding-bottom:4px"><div class="small">${esc(plan ? plan.short : "From a video")}${day.focus ? " · " + esc(day.focus) : ""} · ${esc(dayLabel(sess.date))}</div>
    ${sess.routineId ? `${day.notes ? `<div class="note" style="margin-top:8px">${esc(day.notes)}</div>` : ""}${day.url ? `<div class="small" style="margin-top:6px"><a href="${esc(day.url)}" target="_blank" rel="noopener">▶ Watch the video</a></div>` : ""}` : ""}
    <div class="bar2" style="margin-top:8px"><i style="width:${Math.round((doneCount / day.slots.length) * 100)}%;background:var(--ok)"></i></div>
    <div class="small">${doneCount} of ${day.slots.length} done · do them in this order</div></div>
    ${day.slots.map((sl, i) => {
      const exId = slotChoice(sl, sess, i), ex = exById(exId);
      const mine = logs.filter((l) => l.slot === i);
      const last = !mine.length && lastLog(exId);
      const uniq = [...new Map(sl.options.map((o) => [o.ex, o])).values()];
      return `<div class="slot ${mine.length ? "done" : ""}">
        <div class="tg">${i + 1}. ${esc(sl.body)}${sl.name ? " · " + esc(sl.name) : ""}</div>
        <div class="top" style="margin-top:6px"><div class="th" data-act="ex" data-id="${esc(exId)}">${ex ? thumb(ex) : ""}</div>
          <div style="flex:1;min-width:0"><div class="nm">${esc(slotLabel(sl, exId))}</div><div class="small"><a href="#" data-act="ex" data-id="${esc(exId)}">How to do it</a></div></div>
          <div class="target">${sl.sets} × ${esc(sl.reps)}</div></div>
        ${uniq.length > 1 && !mine.length ? `<div class="chips wrap">${uniq.map((o) => `<button class="chip sm ${o.ex === exId ? "on" : ""}" data-act="slot-pick" data-i="${i}" data-v="${o.ex}">${esc(o.label)}</button>`).join("")}</div>` : ""}
        ${sl.note ? `<div class="last">${esc(sl.note)}</div>` : ""}
        ${last ? `<div class="last">Last time: ${esc(summary(last))} (${esc(dayLabel(last.date))})</div>` : ""}
        ${mine.map((l) => `<div class="ok" data-act="log-edit" data-id="${esc(l.id)}" style="cursor:pointer">✓ ${esc(summary(l))} <span class="small">· edit</span></div>`).join("")}
        <button class="btn ${mine.length ? "" : "pri"} block" style="margin-top:10px;font-size:15px" data-act="slot-log" data-i="${i}">${mine.length ? "+ Log more sets" : "Log sets"}</button>
      </div>`;
    }).join("")}
    <div class="pad">${finished ? `<div class="rest">✅ Finished ${esc(dayLabel(sess.date))}</div>` : `<button class="btn pri block" data-act="sess-finish">Finish workout</button>
      <button class="btn block" style="margin-top:10px" data-act="sess-discard">${logs.length ? "Stop for now (keep what's logged)" : "Cancel this workout"}</button>`}</div>`;
}
export function logSlot(i) {
  const sess = S.sessions.find((x) => x.id === SESS.id), day = dayForSession(sess), sl = day.slots[i];
  const exId = slotChoice(sl, sess, i);
  openLog({ exId, session: { sessionId: sess.id, slot: i, planDay: day.name, target: { sets: sl.sets, reps: sl.reps, name: sl.name } } });
}
export function finishSession(discard) {
  const sess = S.sessions.find((x) => x.id === SESS.id);
  if (!sess) return;
  const logs = S.logs.filter((l) => l.sessionId === sess.id);
  if (discard) {
    if (!logs.length) { deleteDoc("sessions", sess.id); closeSheet(); toast("Workout cancelled"); return; }
    closeSheet(); toast("Saved for later. Continue it from the Today tab."); return;
  }
  if (!logs.length && !confirm("Nothing is logged yet. Finish anyway? The plan will move on to the next day.")) return;
  saveDoc("sessions", { ...sess, finishedAt: Date.now() });
  closeSheet();
  const day = dayForSession(sess);
  toast("💪 " + (day ? day.name : "Workout") + " done!", 3000);
}

/* ---------- buttons ---------- */
action("plans", (a, e, id) => { e.preventDefault(); openPlans(); });
action("plan-set", (a, e, id) => { updateMe({ planId: id }); reopenTop(openPlans); render(); });
action("plan-cardio", (a, e, id) => { updateMe({ cardio: !me().cardio }); reopenTop(openPlans); render(); });
action("plan-special", (a, e, id) => { e.stopPropagation(); updateMe({ special: a.dataset.v }); reopenTop(openPlans); render(); });
action("plan-days", (a, e, id) => { openDayPicker(); });
action("sess-start", (a, e, id) => { startSession(+a.dataset.seq); });
action("sess-open", (a, e, id) => { openSession(id); });
action("sess-finish", (a, e, id) => { finishSession(false); });
action("sess-discard", (a, e, id) => { finishSession(true); });
action("slot-pick", (a, e, id) => {
  const sess = S.sessions.find((x) => x.id === SESS.id);
  saveDoc("sessions", { ...sess, choices: { ...(sess.choices || {}), [a.dataset.i]: a.dataset.v } });
});
action("slot-log", (a, e, id) => { logSlot(+a.dataset.i); });

slot("today", 10, planCards);
hook("rerender", refreshSessionSheet);
collection("sessions", (arr) => { S.sessions = arr; });
