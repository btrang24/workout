import { ytId } from "../core/media.js";
import { GROUPS, S, allEx, exById, me, myName } from "../core/state.js";
import { deleteDoc, newId, saveDoc } from "../core/store.js";
import { action, closeSheet, collection, hook, openSheet, render, sheets, slot, slots, topSheet } from "../core/ui.js";
import { $, esc, isoDay, toast } from "../core/util.js";
import { openPeople } from "./people.js";
import { timerLabel } from "./intervals.js";
import { activeSession, openSession } from "./plans.js";

/* ============================================================
   Workouts from videos (YouTube, Instagram, TikTok, Reddit...)
   A link is read on the server (/api/import-workout), AI turns it into a
   list of exercises, you check it, and it's saved for the whole household.
   ============================================================ */
export const SRC_ICON = { youtube: "▶️", instagram: "📸", tiktok: "🎵", reddit: "💬" };
export function srcKind(url) {
  const u = String(url || "").toLowerCase();
  if (ytId(u)) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("reddit.com") || u.includes("redd.it")) return "reddit";
  return u ? "link" : "";
}
export const rtIcon = (r) => SRC_ICON[srcKind(r.url)] || "🎬";
export function routineCard() {
  return `<div class="dayh">Workouts from videos</div>
    <div style="padding:0 16px">
      ${S.routines.map((r) => `<div class="pl" data-act="rt-open" data-id="${esc(r.id)}"><div class="t">${rtIcon(r)} ${esc(r.name)}</div>
        <div class="d">${r.timer ? "⏱ Timed · " : ""}${(r.slots || []).length} exercises${r.focus ? " · " + esc(r.focus) : ""}</div></div>`).join("")}
      <button class="btn block" data-act="rt-import">＋ Add a workout from a video</button>
      ${S.routines.length ? "" : `<div class="small" style="margin-top:6px">Saw a workout on YouTube, Instagram, TikTok or Reddit? Paste the link and the app turns it into a workout you can follow and log.</div>`}
    </div>`;
}

export function openImport(pre = {}) {
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">Cancel</button><div class="sp">Workout from a video</div><span style="width:60px"></span></div>
    <div class="ed">
      <div class="f"><label for="imurl">Video link</label><input id="imurl" inputmode="url" autocomplete="off" placeholder="Paste a YouTube, Instagram, TikTok or Reddit link" value="${esc(pre.url || "")}"></div>
      <div class="f"><label for="imtext">Caption or exercise list (optional)</label><textarea id="imtext" style="min-height:80px" placeholder="e.g. 3 rounds: 12 goblet squats, 10 push-ups, 30 sec plank">${esc(pre.text || "")}</textarea>
        <div class="hint">Helps when a site won't let the app read it (Instagram often blocks this). Copy the caption from the post and paste it here.</div></div>
      <button class="btn pri block" data-act="im-go" id="imgo">✨ Read the video</button>
      <div id="imstatus"></div>
      <p class="small" style="text-align:center"><a href="#" data-act="rt-new">Or type the workout in yourself</a></p>
      <div class="lbl" style="margin-top:16px">How it works</div>
      <ul class="bul good"><li>For YouTube, AI watches the video itself. For other sites, it reads the title and caption.</li>
        <li>Google Gemini turns that into a list of exercises with sets and reps, matched to your exercise library.</li>
        <li>You check it and fix anything before it's saved. Instagram and TikTok videos can't be watched, only their captions, so moves that are only shown there can be missed.</li></ul>
    </div>`;
  openSheet(html);
  if (pre.auto && (pre.url || pre.text)) runImport();
}
export async function runImport() {
  const el = topSheet().el;
  const url = $("#imurl", el).value.trim(), text = $("#imtext", el).value.trim();
  const status = $("#imstatus", el), btn = $("#imgo", el);
  if (!url && !text) { toast("Paste a link first."); return; }
  const show = (html) => { if (el.isConnected) status.innerHTML = html; };
  if (location.protocol === "file:") {
    show(`<div class="note" style="margin-top:10px">Reading videos only works on the website version of the app. You can still <a href="#" data-act="rt-new">type the workout in yourself</a>.</div>`);
    return;
  }
  btn.disabled = true; btn.textContent = "Reading…";
  show(`<div class="rest" style="margin-top:10px">⏳ Reading the video and working out the exercises. This can take up to a minute…</div>`);
  try {
    const library = allEx().map((e) => ({ id: e.id, name: e.name, group: e.group, kind: e.kind }));
    const r = await fetch("/api/import-workout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, text, library }) });
    let j = null;
    try { j = await r.json(); } catch { j = { message: r.status === 404 ? "The video reader isn't set up on this site yet." : "Something went wrong reading that link. Try again." }; }
    if (!el.isConnected) return;
    if (!r.ok) {
      show(`<div class="note" style="margin-top:10px">${esc(j.message || "That didn't work. Try again.")}${j.error === "couldnt_read" ? "" : ` You can also <a href="#" data-act="rt-new">type the workout in yourself</a>.`}</div>`);
      return;
    }
    const rt = j.routine || {};
    if (!rt.found || !(rt.exercises || []).length) {
      show(`<div class="note" style="margin-top:10px">Couldn't find a workout in that${j.source && j.source.title ? ` (“${esc(j.source.title)}”)` : ""}. If the exercises are only shown in the video, paste the caption or type the list above and try again.</div>`);
      return;
    }
    show("");
    openRoutineEditor({
      fromAI: true, name: rt.name || (j.source && j.source.title) || "Video workout", focus: rt.focus || "", notes: rt.notes || "", url,
      sourceTitle: (j.source && j.source.title) || "", sourceKind: (j.source && j.source.kind) || srcKind(url),
      timer: rt.timer && rt.timer.timed ? { work: rt.timer.work || 30, rest: rt.timer.rest || 0, rounds: rt.timer.rounds || 1, roundRest: rt.timer.roundRest || 0 } : null,
      items: rt.exercises.map((x) => ({
        ex: x.libraryId && exById(x.libraryId) ? x.libraryId : "", newName: x.name || "", name: x.name || "",
        group: GROUPS.includes(x.group) ? x.group : "Full body", kind: x.kind || "reps",
        sets: x.sets || 3, reps: x.reps || "10", secs: x.seconds || "", note: x.note || "",
      })),
    });
  } catch (e) {
    console.error(e);
    show(`<div class="note" style="margin-top:10px">Couldn't reach the app's server. Check your internet connection and try again.</div>`);
  } finally {
    if (el.isConnected) { btn.disabled = false; btn.textContent = "✨ Read the video"; }
  }
}

export const blankItem = () => ({ ex: "", newName: "", name: "", group: "Full body", kind: "reps", sets: 3, reps: "10", note: "" });
export function openRoutineEditor(draft) {
  const el = openSheet(`<div id="rtbody"></div>`);
  el._rt = JSON.parse(JSON.stringify(draft));
  if (!el._rt.items.length) el._rt.items.push(blankItem());
  renderRoutineEditor(el);
}
export function routineToDraft(r) {
  return {
    id: r.id, createdAt: r.createdAt, addedBy: r.addedBy, name: r.name, focus: r.focus || "", notes: r.notes || "", url: r.url || "",
    sourceTitle: r.sourceTitle || "", sourceKind: r.sourceKind || "", timer: r.timer || null,
    items: (r.slots || []).map((sl) => {
      const o = sl.options[0] || {}, ex = exById(o.ex);
      return { ex: ex ? o.ex : "", newName: ex ? "" : o.label || "", name: o.label || "", group: sl.body || "Full body", kind: (ex && ex.kind) || "reps", sets: sl.sets, reps: sl.reps, secs: sl.secs || "", note: sl.note || "" };
    }),
  };
}
export function renderRoutineEditor(el) {
  const st = el._rt;
  const lib = allEx().slice().sort((a, b) => a.name.localeCompare(b.name));
  const opts = (sel) => GROUPS.map((g) => {
    const xs = lib.filter((e) => e.group === g);
    return xs.length ? `<optgroup label="${esc(g)}">${xs.map((e) => `<option value="${esc(e.id)}" ${e.id === sel ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</optgroup>` : "";
  }).join("");
  const sel = (f, i, vals, cur) => `<select data-rf="${f}" data-i="${i}">${vals.map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
  $("#rtbody", el).innerHTML = `
    <div class="sbar"><button class="btn sm" data-act="close">Cancel</button><div class="sp">${st.id ? "Edit workout" : "Check the workout"}</div><button class="btn sm pri" data-act="rt-save">Save</button></div>
    <div class="ed">
      ${st.fromAI ? `<div class="note" style="margin-bottom:12px">✨ Here's what the AI found${st.sourceTitle ? ` in “${esc(st.sourceTitle)}”` : ""}. Check it against the video, fix anything that's off, then tap <b>Save</b>.</div>` : ""}
      <div class="f"><label>Name</label><input data-rt="name" value="${esc(st.name)}" placeholder="e.g. 20-minute dumbbell legs"></div>
      <div class="f"><label>Focus</label><input data-rt="focus" value="${esc(st.focus)}" placeholder="e.g. Legs and glutes"></div>
      <div class="f"><label>Video link</label><input data-rt="url" inputmode="url" value="${esc(st.url)}" placeholder="Optional"></div>
      <div class="f"><label>How to do it</label><textarea data-rt="notes" style="min-height:60px" placeholder="Rounds, rest times, warm-up… (optional)">${esc(st.notes)}</textarea></div>
      <div class="f"><span class="lbl">How it's done</span>
        <div class="seg"><button data-act="rt-mode" data-v="sets" class="${st.timer ? "" : "on"}">Sets & reps</button><button data-act="rt-mode" data-v="timed" class="${st.timer ? "on" : ""}">⏱ Timed intervals</button></div></div>
      ${st.timer ? `<div class="rx ivset"><div class="row2">
          <div class="f"><label>Work (sec)</label><input data-rtt="work" inputmode="numeric" value="${esc(st.timer.work)}"></div>
          <div class="f"><label>Rest (sec)</label><input data-rtt="rest" inputmode="numeric" value="${esc(st.timer.rest)}"></div></div>
        <div class="row2"><div class="f"><label>Rounds</label><input data-rtt="rounds" inputmode="numeric" value="${esc(st.timer.rounds)}"></div>
          <div class="f"><label>Rest between rounds (sec)</label><input data-rtt="roundRest" inputmode="numeric" value="${esc(st.timer.roundRest)}"></div></div>
        <div class="hint">Example: Tabata is 20 sec work, 10 sec rest, 8 rounds.</div></div>` : ""}
      <div class="lbl">Exercises, in order</div>
      ${st.items.map((it, i) => `<div class="rx">
        <div class="rxh"><b>${i + 1}.</b><select data-rf="ex" data-i="${i}"><option value="" ${it.ex ? "" : "selected"}>➕ New exercise${it.newName ? ": " + esc(it.newName) : ""}</option>${opts(it.ex)}</select>
          ${i ? `<button class="btn sm" data-act="rt-up" data-i="${i}" aria-label="Move up">↑</button>` : ""}<button class="btn sm" data-act="rt-rm" data-i="${i}" aria-label="Remove">✕</button></div>
        ${it.ex ? "" : `<div class="f" style="margin-top:8px"><label>New exercise name</label><input data-rf="name" data-i="${i}" value="${esc(it.name)}" placeholder="e.g. Bear crawl"></div>
          <div class="row2"><div class="f"><label>Muscle group</label>${sel("group", i, GROUPS.map((g) => [g, g]), it.group)}</div>
          <div class="f"><label>Track it by</label>${sel("kind", i, [["weight", "Weight × reps"], ["reps", "Reps"], ["time", "Time"]], it.kind)}</div></div>`}
        ${st.timer ? `<div class="f" style="margin-top:8px"><label>Work time for this exercise (sec)</label><input data-rf="secs" data-i="${i}" inputmode="numeric" value="${esc(it.secs || "")}" placeholder="${esc(st.timer.work)} (same as above)"></div>`
          : `<div class="row2" style="margin-top:8px"><div class="f"><label>Sets</label><input data-rf="sets" data-i="${i}" inputmode="numeric" value="${esc(it.sets)}"></div>
          <div class="f"><label>Reps or time</label><input data-rf="reps" data-i="${i}" value="${esc(it.reps)}" placeholder="10, 8-12, 30 sec"></div></div>`}
        <div class="f"><label>Note</label><input data-rf="note" data-i="${i}" value="${esc(it.note)}" placeholder="Optional"></div>
      </div>`).join("")}
      <button class="btn block" data-act="rt-add">＋ Add an exercise</button>
      ${st.id ? `<button class="btn dan block" style="margin-top:10px" data-act="rt-del" data-id="${esc(st.id)}">Delete this workout</button>` : ""}
    </div>`;
}
export function saveRoutine() {
  const el = topSheet().el, st = el._rt;
  const name = (st.name || "").trim();
  if (!name) { toast("Give the workout a name."); return; }
  const items = st.items.filter((it) => it.ex || (it.name || "").trim());
  if (!items.length) { toast("Add at least one exercise."); return; }
  const n = (v, d, min = 0) => Math.max(min, Math.round(Number(v) || d));
  const timer = st.timer ? { work: n(st.timer.work, 30, 5), rest: n(st.timer.rest, 0), rounds: n(st.timer.rounds, 1, 1), roundRest: n(st.timer.roundRest, 0) } : null;
  const routineSlots = items.map((it) => {
    let exId = it.ex, label = "", group = it.group;
    if (exId) { const ex = exById(exId); label = ex.name; group = ex.group; }
    else {
      label = it.name.trim();
      const hit = allEx().find((e) => e.name.toLowerCase() === label.toLowerCase());
      exId = hit ? hit.id : saveDoc("exercises", {
        id: "c_" + newId(), name: label, group: GROUPS.includes(it.group) ? it.group : "Full body", equip: "Other", kind: it.kind || "reps",
        photo: "", video: st.url || "", muscles: "", steps: it.note ? [it.note] : [], tips: [], mistakes: [], alts: [], aliases: [label.toLowerCase()],
      });
    }
    if (timer) {
      const secs = Math.round(Number(it.secs) || 0);
      return { body: group || "", name: "", sets: timer.rounds, reps: (secs || timer.work) + " sec", secs, note: (it.note || "").trim(), options: [{ label, ex: exId }] };
    }
    return { body: group || "", name: "", sets: Math.max(1, Math.round(Number(it.sets) || 3)), reps: String(it.reps || "").trim() || "10", note: (it.note || "").trim(), options: [{ label, ex: exId }] };
  });
  const id = saveDoc("routines", {
    id: st.id || undefined, name, focus: (st.focus || "").trim(), notes: (st.notes || "").trim(), url: (st.url || "").trim(),
    sourceTitle: st.sourceTitle || "", sourceKind: st.sourceKind || srcKind(st.url), slots: routineSlots, timer,
    createdAt: st.createdAt || Date.now(), addedBy: st.addedBy || myName(),
  });
  while (sheets.length) closeSheet();
  toast("Saved " + name);
  if (S.tab !== "today") { S.tab = "today"; render(); }
  setTimeout(() => openRoutine(id), 120);
}

export function openRoutine(id) {
  const r = S.routines.find((x) => x.id === id);
  if (!r) return;
  const vid = ytId(r.url);
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">‹ Back</button><div class="sp">${esc(r.name)}</div><button class="btn sm" data-act="rt-edit" data-id="${esc(r.id)}">Edit</button></div>
    <div class="det">
      ${vid ? `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" allowfullscreen title="Video"></iframe></div>` : r.url ? `<a class="btn block" style="margin-bottom:10px" href="${esc(r.url)}" target="_blank" rel="noopener">${rtIcon(r)} Open the video</a>` : ""}
      <h2>${esc(r.name)}</h2>
      <div class="small">${esc([r.focus, r.addedBy ? "added by " + r.addedBy : "", r.sourceTitle && r.sourceTitle !== r.name ? "from “" + r.sourceTitle + "”" : ""].filter(Boolean).join(" · "))}</div>
      ${r.timer ? `<div class="rest" style="margin-top:10px">⏱ ${esc(timerLabel(r))}</div>` : ""}
      ${r.notes ? `<div class="note" style="margin-top:10px">${esc(r.notes)}</div>` : ""}
      <div class="sec"><ol class="slots">${(r.slots || []).map((sl) => {
        const o = sl.options[0] || {};
        return `<li><div class="nm"><a href="#" data-act="ex" data-id="${esc(o.ex)}">${esc(o.label)}</a><div class="sub">${esc(sl.body)}${sl.note ? " · " + esc(sl.note) : ""}</div></div><div class="sr">${sl.sets} × ${esc(sl.reps)}</div></li>`;
      }).join("")}</ol></div>
      <div class="sec">${r.timer ? `<button class="btn pri block" data-act="iv-start" data-id="${esc(r.id)}">▶ Start the timer</button>
        <button class="btn block" style="margin-top:8px" data-act="rt-start" data-id="${esc(r.id)}">Start as a checklist instead</button>`
        : `<button class="btn pri block" data-act="rt-start" data-id="${esc(r.id)}">Start this workout</button>`}</div>
    </div>`;
  openSheet(html);
}
export function startRoutine(id) {
  const r = S.routines.find((x) => x.id === id);
  if (!r) return;
  if (!me()) { openPeople(() => startRoutine(id)); toast("First, who's working out?"); return; }
  const act = activeSession();
  if (act) {
    if (!confirm("You have a workout in progress. Continue that one instead?\n\nTap Cancel to start this one anyway (the other keeps what's logged).")) {
      saveDoc("sessions", { ...act, finishedAt: Date.now() });
    } else { while (sheets.length) closeSheet(); setTimeout(() => openSession(act.id), 50); return; }
  }
  const sid = saveDoc("sessions", {
    personId: S.personId, personName: myName(), routineId: r.id, seq: 0, dayKey: "R", dayName: r.name,
    day: { key: "R:" + r.id, name: r.name, focus: r.focus || "", notes: r.notes || "", url: r.url || "", slots: r.slots || [] },
    date: isoDay(), startedAt: Date.now(), finishedAt: null, choices: {},
  });
  while (sheets.length) closeSheet();
  setTimeout(() => openSession(sid), 50);
}
// Shared to the app from another app (Android "Share" → Workouts)
export function handleShare() {
  const p = new URLSearchParams(location.search);
  if (!["share_url", "share_text", "share_title"].some((k) => p.has(k))) return;
  const all = ["share_url", "share_text", "share_title"].map((k) => p.get(k) || "").join(" ").trim();
  const m = all.match(/https?:\/\/\S+/);
  const url = m ? m[0] : "";
  const rest = (url ? all.replace(url, "") : all).trim();
  history.replaceState(null, "", location.pathname);
  S.tab = "today"; render();
  openImport({ url, text: rest.length > 25 ? rest : "", auto: true });
}

// Routine editor fields: keep the draft in sync as you type.
export function syncRoutineField(e) {
  const t = e.target;
  if (!t.dataset || !(t.dataset.rt || t.dataset.rf || t.dataset.rtt)) return;
  const sh = t.closest(".sheet"), st = sh && sh._rt;
  if (!st) return;
  if (t.dataset.rt) { st[t.dataset.rt] = t.value; return; }
  if (t.dataset.rtt) { st.timer[t.dataset.rtt] = t.value; return; }
  const it = st.items[+t.dataset.i];
  it[t.dataset.rf] = t.value;
  if (t.dataset.rf === "ex" && e.type === "change") {
    if (t.value) { const ex = exById(t.value); it.kind = ex.kind; it.group = ex.group; }
    renderRoutineEditor(sh);
  }
}
document.addEventListener("input", syncRoutineField);
document.addEventListener("change", syncRoutineField);

/* ---------- buttons ---------- */
action("rt-import", (a, e, id) => { openImport(); });
action("im-go", (a, e, id) => { runImport(); });
action("rt-new", (a, e, id) => {
  e.preventDefault();
  const u = $("#imurl", topSheet() ? topSheet().el : document);
  openRoutineEditor({ name: "", focus: "", notes: "", url: u ? u.value.trim() : "", items: [] });
});
action("rt-open", (a, e, id) => { openRoutine(id); });
action("rt-start", (a, e, id) => { startRoutine(id); });
action("rt-edit", (a, e, id) => { const r = S.routines.find((x) => x.id === id); if (r) openRoutineEditor(routineToDraft(r)); });
action("rt-save", (a, e, id) => { saveRoutine(); });
action("rt-del", (a, e, id) => {
  if (confirm("Delete this workout? Anything you've logged from it stays in your history.")) { deleteDoc("routines", id); while (sheets.length) closeSheet(); toast("Deleted"); }
});
action("rt-mode", (a) => {
  const el = topSheet().el, st = el._rt;
  st.timer = a.dataset.v === "timed" ? st.timer || { work: 30, rest: 30, rounds: 3, roundRest: 60 } : null;
  renderRoutineEditor(el);
});
action("rt-add", (a, e, id) => { const el = topSheet().el; el._rt.items.push(blankItem()); renderRoutineEditor(el); });
action("rt-rm", (a, e, id) => { const el = topSheet().el; el._rt.items.splice(+a.dataset.i, 1); renderRoutineEditor(el); });
action("rt-up", (a, e, id) => {
  const el = topSheet().el, i = +a.dataset.i, it = el._rt.items;
  [it[i - 1], it[i]] = [it[i], it[i - 1]]; renderRoutineEditor(el);
});

slot("today", 20, routineCard);
hook("start", handleShare);
collection("routines", (arr) => { S.routines = arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); });
