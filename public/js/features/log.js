import { GROUPS, S, allEx, exById, myName } from "../core/state.js";
import { bestOf, lastLog, personalBest, summary } from "../core/stats.js";
import { deleteDoc, saveDoc } from "../core/store.js";
import { action, closeSheet, collection, openSheet, runHooks, topSheet } from "../core/ui.js";
import { $, KG, conv, dayLabel, esc, fmtClock, fmtTime, isoDay, num, parseTime, toast } from "../core/util.js";
import { listen, micBtn, parseSpoken } from "./dictation.js";
import { suggest, suggestLabel } from "./overload.js";
import { openPeople } from "./people.js";

/* ---------- Log a workout ---------- */
export let LG = null;
export function blankSet(kind) { return kind === "time" ? { s: null } : { w: null, r: null }; }
export function openLog(opts = {}) {
  const exList = allEx();
  const existing = opts.logId ? S.logs.find((l) => l.id === opts.logId) : null;
  let ex = exById(existing ? existing.exId : opts.exId) || null;
  LG = existing
    ? { id: existing.id, exId: existing.exId, date: existing.date, unit: existing.unit || S.unit, sets: JSON.parse(JSON.stringify(existing.sets || [])), notes: existing.notes || "", active: 0, personId: existing.personId, personName: existing.personName, ts: existing.ts, sessionId: existing.sessionId, slot: existing.slot, planDay: existing.planDay, target: existing.target }
    : { exId: ex ? ex.id : "", date: isoDay(), unit: S.unit, sets: [], notes: "", active: 0 };
  if (!existing && opts.session) Object.assign(LG, opts.session);
  if (!LG.sets.length) prefill(ex);
  const opt = (e) => `<option value="${esc(e.id)}" ${LG.exId === e.id ? "selected" : ""}>${esc(e.name)}</option>`;
  const groups = GROUPS.filter((g) => exList.some((e) => e.group === g));
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">Cancel</button><div class="sp">${existing ? "Edit workout" : LG.planDay ? esc(LG.planDay) : "Log workout"}</div><button class="btn sm pri" data-act="log-save">Save</button></div>
    <div class="ed">
      ${LG.target ? `<div class="lastt" style="background:var(--hot-l);color:var(--hot)"><span class="sp">🎯 Plan: <b>${LG.target.sets} sets × ${esc(LG.target.reps)} reps</b>${LG.target.name ? " · " + esc(LG.target.name) : ""}</span></div>` : ""}
      <div class="f"><label>Say it or type it</label>
        <div class="withmic"><input id="lgquick" placeholder="e.g. squat 3 sets of 5 at 185" autocomplete="off" enterkeyhint="done">${micBtn("lg-mic")}<button class="btn" data-act="lg-fill">Fill</button></div>
        <div class="hint">Fills in the exercise, sets, reps, weight or time below.</div></div>
      <div class="row2">
        <div class="f" style="flex:2"><label for="lgex">Exercise</label><select id="lgex"><option value="">Choose…</option>${groups.map((g) => `<optgroup label="${g}">${exList.filter((e) => e.group === g).map(opt).join("")}</optgroup>`).join("")}</select></div>
        <div class="f" style="flex:1.2"><label for="lgdate">Date</label><input id="lgdate" type="date" value="${esc(LG.date)}" max="${isoDay()}"></div>
      </div>
      <div id="lgsets"></div>
      <div class="f" style="margin-top:16px"><label for="lgnotes">Notes</label>
        <div class="withmic"><textarea id="lgnotes" placeholder="How did it feel? Anything to remember next time?">${esc(LG.notes)}</textarea>${micBtn("notes-mic")}</div></div>
      <button class="btn pri block" data-act="log-save">Save</button>
      ${existing ? `<button class="btn dan block" style="margin-top:10px" data-act="log-del" data-id="${esc(existing.id)}">Delete this entry</button>` : ""}
    </div>`;
  const el = openSheet(html);
  $("#lgex", el).addEventListener("change", (e) => {
    const nx = exById(e.target.value), prev = exById(LG.exId);
    LG.exId = e.target.value;
    if (nx && !LG.sets.some((s) => s.done || (!s.pre && (s.w || s.r || s.s)))) prefill(nx);
    else if (nx && (!prev || prev.kind !== nx.kind)) { LG.sets = [blankSet(nx.kind)]; LG.active = 0; }
    renderSets();
  });
  $("#lgdate", el).addEventListener("change", (e) => (LG.date = e.target.value || isoDay()));
  $("#lgnotes", el).addEventListener("input", (e) => (LG.notes = e.target.value));
  $("#lgquick", el).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applySpoken($("#lgquick").value); } });
  if (opts.spoken) { $("#lgquick", el).value = opts.spoken; applySpoken(opts.spoken, true); }
  else renderSets();
}
export function lgEx() { return exById(LG.exId); }
/** New log: fill each set with today's suggestion (or last time), marked "pre" until ticked ✓ or edited. */
export function prefill(ex) {
  const last = ex && lastLog(ex.id);
  const sg = ex && suggest(ex, LG.target, last);
  LG.sg = sg;
  const n = Math.min(LG.target ? LG.target.sets : last ? last.sets.length : 1, 20) || 1;
  const w = (v, u) => (v == null ? null : Math.round(conv(v, u, LG.unit) * 2) / 2);
  const one = sg ? (ex.kind === "time" ? { s: sg.s } : { w: w(sg.w, sg.unit), r: sg.r })
    : last && last.sets[0] ? (ex.kind === "time" ? { s: last.sets[0].s } : { w: w(last.sets[0].w, last.unit || "lb"), r: last.sets[0].r }) : null;
  LG.sets = Array.from({ length: n }, () => (one ? { ...one, pre: true } : blankSet(ex ? ex.kind : "weight")));
  LG.active = 0;
}
export function chipVals(ex, field) {
  const c = ex.chips || {};
  let arr = field === "w" ? c.w : field === "r" ? c.r : c.t;
  if (!arr) arr = field === "w" ? (ex.kind === "reps" ? [0, 10, 25] : [10, 20, 30, 45, 65, 95, 135]) : field === "r" ? [5, 8, 10, 12, 15] : [30, 45, 60, 90, 120];
  if (field === "w" && LG.unit === "kg") {
    const set = new Set(arr.map((v) => (v === 0 ? 0 : Math.max(2.5, Math.round(v / KG / 2.5) * 2.5))));
    arr = [...set];
  }
  return arr;
}
export function renderSets() {
  const box = $("#lgsets");
  if (!box) return;
  const ex = lgEx();
  if (!ex) { box.innerHTML = `<div class="note">Pick an exercise (or say one) to start adding sets.</div>`; return; }
  const k = ex.kind, u = LG.unit;
  const last = lastLog(ex.id);
  const lastBox = last && last.id !== LG.id ? `<div class="lastt"><span class="sp">Last time (${esc(dayLabel(last.date))}): <b>${esc(summary(last))}</b></span><button class="btn sm" data-act="lg-repeat">Repeat</button></div>` : "";
  const sgBox = LG.sg && !LG.id ? `<div class="lastt sg"><span class="sp">💡 Today: <b>${esc(suggestLabel(ex, LG.sg, u))}</b><br><span class="small">${esc(LG.sg.note)}. Tap ✓ after each set you do.</span></span></div>` : "";
  const repPh = LG.target ? String(LG.target.reps).split(" ")[0] : "0";
  const rows = LG.sets.map((st, i) => {
    let inner;
    if (k === "time") inner = `<input inputmode="text" data-f="s" data-i="${i}" value="${st.s != null ? fmtClock(st.s) : ""}" placeholder="0:30" style="width:84px" aria-label="Time"><span class="u">min:sec</span>`;
    else if (k === "reps") inner = `<input inputmode="numeric" data-f="r" data-i="${i}" value="${num(st.r)}" placeholder="${repPh}" aria-label="Reps"><span class="u">reps</span><span class="u" style="margin-left:6px">+</span><input inputmode="decimal" data-f="w" data-i="${i}" value="${st.w ? num(st.w) : ""}" placeholder="0" style="width:56px" aria-label="Extra weight"><span class="u">${u}</span>`;
    else inner = `<input inputmode="decimal" data-f="w" data-i="${i}" value="${num(st.w)}" placeholder="0" aria-label="Weight"><span class="u">${u} ×</span><input inputmode="numeric" data-f="r" data-i="${i}" value="${num(st.r)}" placeholder="${repPh}" aria-label="Reps"><span class="u">reps</span>`;
    return `<div class="set ${i === LG.active ? "on" : ""} ${st.done ? "done" : ""} ${st.pre && !st.done ? "pre" : ""}" data-act="lg-active" data-i="${i}"><span class="no">${i + 1}</span>${inner}<button class="tick ${st.done ? "on" : ""}" data-act="lg-done" data-i="${i}" aria-label="Set done">✓</button>${LG.sets.length > 1 ? `<button class="x" data-act="lg-rm" data-i="${i}" aria-label="Remove set">✕</button>` : ""}</div>`;
  }).join("");
  const cur = LG.sets[LG.active];
  const chipRow = (field, label, fmt) => `<div class="chipblk"><div class="lbl">${label}</div><div class="chips wrap">${chipVals(ex, field).map((v) => `<button class="chip sm ${cur && cur[field] === v ? "on" : ""}" data-act="lg-chip" data-f="${field}" data-v="${v}">${fmt(v)}</button>`).join("")}${field === "w" ? `<button class="chip sm" data-act="lg-bump" data-v="-5">−5</button><button class="chip sm" data-act="lg-bump" data-v="5">+5</button>` : ""}</div></div>`;
  let chips = "";
  if (k === "time") chips = chipRow("s", "Quick pick: time", fmtTime);
  else {
    chips = chipRow("r", "Quick pick: reps", (v) => v);
    chips += chipRow("w", k === "reps" ? "Extra weight (" + u + ")" : "Quick pick: weight (" + u + ")", (v) => (v === 0 ? "Bodyweight" : v));
  }
  box.innerHTML = `${sgBox}${lastBox}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div class="lbl" style="flex:1;margin:0">Sets · tap a set, then a quick-pick</div>
    ${k !== "time" ? `<div class="seg"><button data-act="lg-unit" data-v="lb" class="${u === "lb" ? "on" : ""}">lb</button><button data-act="lg-unit" data-v="kg" class="${u === "kg" ? "on" : ""}">kg</button></div>` : ""}</div>
    <div class="sets">${rows}</div>
    <button class="btn block" style="margin-top:8px;font-size:15px" data-act="lg-add">+ Add set</button>
    ${chips}`;
  box.querySelectorAll("input[data-f]").forEach((inp) => {
    inp.addEventListener("focus", () => setActive(+inp.dataset.i));
    inp.addEventListener("input", () => {
      const i = +inp.dataset.i, f = inp.dataset.f;
      LG.sets[i].pre = false;
      inp.closest(".set").classList.remove("pre");
      if (f === "s") LG.sets[i].s = parseTime(inp.value);
      else LG.sets[i][f] = inp.value === "" ? null : Number(inp.value);
      refreshChipOn();
    });
  });
}
export function setActive(i) {
  LG.active = i;
  document.querySelectorAll("#lgsets .set").forEach((el, j) => el.classList.toggle("on", j === i));
  refreshChipOn();
}
export function refreshChipOn() {
  const cur = LG.sets[LG.active] || {};
  document.querySelectorAll("#lgsets [data-act=lg-chip]").forEach((c) => c.classList.toggle("on", cur[c.dataset.f] === Number(c.dataset.v)));
}
export function applySpoken(text, initial) {
  const p = parseSpoken(text, allEx());
  const got = p.ex || p.reps != null || p.w != null || p.secs != null || p.sets != null;
  if (!got) { toast("I didn't catch that. Try “squat 3 sets of 5 at 185”."); if (initial) renderSets(); return; }
  if (p.ex && p.ex.id !== LG.exId) { LG.exId = p.ex.id; const sel = $("#lgex"); if (sel) sel.value = p.ex.id; }
  if (p.unit) LG.unit = p.unit;
  const ex = lgEx();
  if (ex) {
    const n = Math.min(p.sets || (ex.kind === "time" && p.secs == null ? 1 : 1), 20);
    const st = ex.kind === "time" ? { s: p.secs ?? null } : { w: p.w ?? null, r: p.reps ?? null };
    if (ex.kind === "time" && st.s == null && p.reps != null) st.s = p.reps; // "plank 3 sets of 45" means seconds
    if (ex.kind !== "time" && st.w == null && st.r == null && p.sets) { LG.sets = Array.from({ length: n }, () => blankSet(ex.kind)); }
    else LG.sets = Array.from({ length: n }, () => ({ ...st }));
    LG.active = 0;
  }
  renderSets();
  if (!initial) toast(ex ? "Filled in. Check it, then Save." : "Pick the exercise to finish.");
}
export function saveLog(force) {
  const ex = lgEx();
  if (!ex) { toast("Choose an exercise first."); return; }
  const filled = LG.sets.filter((s) => (ex.kind === "time" ? s.s > 0 : s.r > 0 || s.w > 0));
  // Untouched suggestions don't count, unless nothing was ticked or edited (then Save means "did them all").
  const real = filled.filter((s) => s.done || !s.pre);
  const sets = (real.length ? real : filled).map((s) => (ex.kind === "time" ? { s: s.s } : { w: s.w || 0, r: s.r || 0 }));
  if (!sets.length) { toast(ex.kind === "time" ? "Enter how long you held it." : "Enter at least one set."); return; }
  if (!LG.id && !S.personId && !force) { openPeople(() => saveLog(true)); toast("First, who's working out on this phone?"); return; }
  const isNew = !LG.id;
  const pbBefore = personalBest(ex), mine = bestOf(ex, sets, LG.unit);
  const pr = isNew && pbBefore && mine && mine.score > pbBefore.score ? mine : null;
  saveDoc("logs", {
    id: LG.id, exId: ex.id, exName: ex.name, kind: ex.kind, date: LG.date || isoDay(), unit: LG.unit,
    sets, notes: (LG.notes || "").trim(), ts: LG.ts || Date.now(),
    personId: LG.personId || S.personId || "", personName: LG.personName || myName() || "",
    sessionId: LG.sessionId, slot: LG.slot, planDay: LG.planDay, target: LG.target, pr: pr ? true : undefined,
  });
  closeSheet();
  setTimeout(() => runHooks("logSaved", { ex, isNew, pr }), 150);
}

/* ---------- buttons ---------- */
action("log-new", (a, e, id) => { openLog({}); });
action("log-ex", (a, e, id) => { openLog({ exId: id }); });
action("log-edit", (a, e, id) => { if (!e.target.closest(".del")) openLog({ logId: id }); });
action("log-del", (a, e, id) => {
  e.stopPropagation();
  if (confirm("Delete this workout entry?")) { deleteDoc("logs", id); if (topSheet() && LG && LG.id === id) closeSheet(); toast("Deleted"); }
});
action("log-save", (a, e, id) => { saveLog(); });
action("lg-active", (a, e, id) => { if (e.target.tagName !== "BUTTON") setActive(+a.dataset.i); });
action("lg-add", (a, e, id) => {
  const lastS = LG.sets[LG.sets.length - 1];
  LG.sets.push(lastS ? { ...lastS, done: false, pre: false } : blankSet(lgEx().kind));
  LG.active = LG.sets.length - 1; renderSets();
});
action("lg-done", (a) => {
  const i = +a.dataset.i, st = LG.sets[i], ex = lgEx();
  st.done = !st.done; st.pre = false;
  if (st.done) {
    runHooks("setDone", ex);
    const next = LG.sets.findIndex((x, j) => j > i && !x.done);
    if (next >= 0) LG.active = next;
  }
  renderSets();
});
action("lg-rm", (a, e, id) => { LG.sets.splice(+a.dataset.i, 1); LG.active = Math.min(LG.active, LG.sets.length - 1); renderSets(); });
action("lg-chip", (a, e, id) => {
  const st = LG.sets[LG.active] || LG.sets[0];
  st[a.dataset.f] = Number(a.dataset.v); st.pre = false; renderSets();
});
action("lg-bump", (a, e, id) => {
  const st = LG.sets[LG.active] || LG.sets[0];
  const stepV = LG.unit === "kg" ? Math.sign(+a.dataset.v) * 2.5 : +a.dataset.v;
  st.w = Math.max(0, (Number(st.w) || 0) + stepV); st.pre = false; renderSets();
});
action("lg-unit", (a, e, id) => {
  const to = a.dataset.v;
  if (to !== LG.unit) { LG.sets.forEach((s) => { if (s.w) s.w = Math.round(conv(s.w, LG.unit, to) * 2) / 2; }); LG.unit = to; }
  renderSets();
});
action("lg-repeat", (a, e, id) => {
  const last = lastLog(LG.exId);
  if (last) { LG.sets = JSON.parse(JSON.stringify(last.sets)); LG.unit = last.unit || LG.unit; LG.active = 0; renderSets(); }
});
action("lg-fill", (a, e, id) => { applySpoken($("#lgquick").value); });
action("lg-mic", (a, e, id) => { listen(a, (txt) => { $("#lgquick").value = txt; applySpoken(txt); }); });
action("notes-mic", (a, e, id) => {
  listen(a, (txt) => { const t = $("#lgnotes"); t.value = (t.value ? t.value.trim() + " " : "") + txt; LG.notes = t.value; });
});

collection("logs", (arr) => { S.logs = arr; });
