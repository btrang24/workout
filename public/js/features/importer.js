// Import workout history from Strong, Hevy or FitNotes (their CSV exports).
// Everything happens on the phone: read the file, match exercise names to the library
// (unknown ones become your own exercises), show a preview, then save. Each import is
// tagged so it can be undone in one tap. Logs that were already imported are skipped.
import { S, allEx, myName } from "../core/state.js";
import { deleteDoc, newId, saveDoc, saveMany } from "../core/store.js";
import { action, closeSheet, openSheet, slot, topSheet } from "../core/ui.js";
import { $, esc, isoDay, toast } from "../core/util.js";

/* ---------- CSV ---------- */
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim());
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/* ---------- formats ---------- */
const n = (v) => { const x = parseFloat(String(v || "").replace(",", ".")); return isFinite(x) ? x : 0; };
const day = (v) => { const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const t = Date.parse(String(v).replace(",", "")); return isFinite(t) ? isoDay(new Date(t)) : ""; };
const clock = (v) => { const p = String(v || "").split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : n(v); };
export const FORMATS = {
  strong: { name: "Strong", test: (h) => h.includes("Exercise Name") && h.includes("Set Order"),
    row: (r) => ({ date: day(r.Date), name: r["Exercise Name"], w: n(r.Weight), r: n(r.Reps), s: n(r.Seconds), unit: null, warmup: /^w/i.test(r["Set Order"]) }) },
  hevy: { name: "Hevy", test: (h) => h.includes("exercise_title") && h.includes("set_index"),
    row: (r) => ({ date: day(r.start_time), name: r.exercise_title, w: n(r.weight_lbs ?? r.weight_kg), r: n(r.reps), s: n(r.duration_seconds), unit: "weight_kg" in r ? "kg" : "lb", warmup: r.set_type === "warmup" }) },
  fitnotes: { name: "FitNotes", test: (h) => h.includes("Exercise") && h.includes("Category") && h.some((x) => /^Weight/.test(x)),
    row: (r) => { const wk = Object.keys(r).find((k) => /^Weight/.test(k)); return { date: day(r.Date), name: r.Exercise, w: n(r[wk]), r: n(r.Reps), s: clock(r.Time), unit: /kg/i.test(wk) ? "kg" : "lb", category: r.Category }; } },
};
export const detect = (rows) => Object.keys(FORMATS).find((k) => rows.length && FORMATS[k].test(Object.keys(rows[0]))) || null;

/* ---------- names ---------- */
const norm = (s) => String(s).toLowerCase().replace(/\(([^)]*)\)/g, " $1 ").replace(/[^a-z0-9]+/g, " ").trim();
const base = (s) => norm(String(s).replace(/\([^)]*\)/g, ""));
// Common names in Strong / Hevy / FitNotes -> library ids (matched after norm()).
const KNOWN = {
  "bench press barbell": "bench", "flat barbell bench press": "bench", "bench press dumbbell": "dbbench", "flat dumbbell bench press": "dbbench",
  "incline bench press barbell": "inclinebench", "incline bench press dumbbell": "inclinedb", "squat barbell": "squat", "barbell squat": "squat",
  "front squat barbell": "frontsquat", "deadlift barbell": "deadlift", "romanian deadlift barbell": "rdl", "romanian deadlift dumbbell": "rdl",
  "stiff leg deadlift barbell": "stiffleg", "overhead press barbell": "ohp", "strict military press barbell": "ohp", "shoulder press dumbbell": "dbohp",
  "seated dumbbell press": "dbohp", "bent over row barbell": "row", "barbell row": "row", "bent over one arm row dumbbell": "dbrow", "dumbbell row": "dbrow",
  "pull up": "pullup", "chin up": "chinup", "lat pulldown cable": "latpulldown", "lat pulldown": "latpulldown", "seated row cable": "cablerow",
  "seated cable row": "cablerow", "push up": "pushup", "triceps dip": "dips", "chest dip": "dips", "plank": "plank", "lunge": "lunge",
  "lunge dumbbell": "lunge", "bicep curl dumbbell": "curl", "dumbbell curl": "curl", "bicep curl barbell": "bbcurl", "ez bar curl": "bbcurl",
  "hammer curl dumbbell": "hammer", "preacher curl ez bar": "preacher", "concentration curl dumbbell": "concentration", "triceps pushdown cable straight bar": "pushdown",
  "triceps rope pushdown": "pushdown", "skullcrusher barbell": "skullcrusher", "skullcrusher dumbbell": "skullcrusher", "triceps extension dumbbell": "ohtriceps",
  "leg press": "legpress", "leg press machine": "legpress", "hack squat": "hacksquat", "leg extension machine": "legext", "lying leg curl machine": "hamcurl",
  "seated leg curl machine": "hamcurl", "hip thrust barbell": "hipthrust", "glute bridge": "bridge", "good morning barbell": "goodmorning",
  "standing calf raise": "calfraise", "calf raise": "calfraise", "lateral raise dumbbell": "lateralraise", "lateral raise cable": "cablelateral",
  "reverse fly dumbbell": "reardelt", "reverse fly machine": "pecdeck", "face pull cable": "facepull", "face pull": "facepull", "chest fly dumbbell": "dbfly",
  "cable crossover": "cablefly", "chest fly cable": "cablefly", "pullover dumbbell": "pullover", "straight arm pulldown cable": "straightarm",
  "walking": "walk", "treadmill": "inclinewalk", "cycling": "cycling", "elliptical trainer": "elliptical", "swimming": "swim",
};
/** Library id for an imported name, or null. */
export function matchExercise(name, list = allEx()) {
  const full = norm(name), b = base(name);
  if (KNOWN[full]) return KNOWN[full];
  if (KNOWN[b]) return KNOWN[b];
  for (const e of list) {
    const names = [e.name, ...(e.aliases || [])].map(norm);
    if (names.includes(full) || names.includes(b)) return e.id;
  }
  return null;
}
const GROUP_OF = { chest: "Chest", back: "Back", legs: "Legs", shoulders: "Shoulders", biceps: "Arms", triceps: "Arms", arms: "Arms", abs: "Core", core: "Core", cardio: "Cardio" };

/** Rows -> { logs, newEx } grouped per day + exercise, warm-up sets left out. */
export function toLogs(rows, fmt, unitIfUnknown = S.unit) {
  const by = new Map(), newEx = new Map();
  for (const raw of rows) {
    const x = FORMATS[fmt].row(raw);
    if (!x.date || !x.name || x.warmup) continue;
    const key = x.date + "|" + x.name;
    if (!by.has(key)) by.set(key, { date: x.date, name: x.name, unit: x.unit || unitIfUnknown, sets: [], category: x.category });
    by.get(key).sets.push({ w: x.w, r: x.r, s: x.s });
  }
  const logs = [];
  for (const g of by.values()) {
    const hasReps = g.sets.some((s) => s.r > 0), hasW = g.sets.some((s) => s.w > 0);
    const kind = !hasReps && g.sets.some((s) => s.s > 0) ? "time" : hasW ? "weight" : "reps";
    let exId = matchExercise(g.name);
    if (!exId) {
      const k = norm(g.name);
      if (!newEx.has(k)) newEx.set(k, { id: "c_" + newId(), name: g.name, kind, group: GROUP_OF[norm(g.category || "")] || (kind === "time" ? "Cardio" : "Full body") });
      exId = newEx.get(k).id;
    }
    const sets = g.sets.map((s) => (kind === "time" ? { s: s.s } : { w: s.w || 0, r: s.r || 0 })).filter((s) => s.s > 0 || s.r > 0 || s.w > 0);
    if (sets.length) logs.push({ date: g.date, exId, exName: g.name, kind, unit: g.unit, sets, importKey: fmt + "|" + g.date + "|" + norm(g.name) });
  }
  return { logs: logs.sort((a, b) => a.date.localeCompare(b.date)), newEx: [...newEx.values()] };
}

/* ---------- screens ---------- */
let IMP = null; // { fmt, rows, unit, result }
function openImporter() {
  IMP = null;
  openSheet(`<div class="sbar"><button class="btn sm" data-act="close">Cancel</button><div class="sp">Import history</div><span style="width:60px"></span></div>
    <div class="ed"><p class="small" style="margin-top:0">Bring in your workouts from <b>Strong</b>, <b>Hevy</b> or <b>FitNotes</b>. In that app, export your data as a CSV file, then choose the file here.</p>
      <ul class="bul good"><li>Strong: Profile → Settings → Export data.</li><li>Hevy: Profile → Settings → Export & import data → Export workouts.</li><li>FitNotes: Settings → Spreadsheet export.</li></ul>
      <div class="f"><input type="file" accept=".csv,text/csv,text/plain" id="impfile"></div><div id="impbody"></div></div>`);
  $("#impfile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rows = parseCsv(await f.text()), fmt = detect(rows);
    IMP = { fmt, rows, unit: S.unit };
    renderPreview();
  });
}
function renderPreview() {
  const box = $("#impbody", topSheet().el);
  if (!IMP.fmt) { box.innerHTML = `<div class="note">That file doesn't look like a Strong, Hevy or FitNotes export. Check you picked the CSV file.</div>`; return; }
  IMP.result = toLogs(IMP.rows, IMP.fmt, IMP.unit);
  const have = new Set(S.logs.filter((l) => l.importKey && l.personId === S.personId).map((l) => l.importKey));
  const fresh = IMP.result.logs.filter((l) => !have.has(l.importKey));
  const { logs, newEx } = IMP.result;
  const days = new Set(fresh.map((l) => l.date)).size;
  box.innerHTML = `<div class="rest" style="margin-top:12px">Found <b>${days} workout days</b> (${fresh.length} exercise logs) from ${esc(FORMATS[IMP.fmt].name)}${logs.length ? `, ${esc(logs[0].date)} to ${esc(logs[logs.length - 1].date)}` : ""}.${logs.length > fresh.length ? ` ${logs.length - fresh.length} already imported, skipped.` : ""}</div>
    ${IMP.fmt === "strong" ? `<div class="f"><span class="lbl">Weights in that file are in</span><div class="seg"><button data-act="imp-unit" data-v="lb" class="${IMP.unit === "lb" ? "on" : ""}">lb</button><button data-act="imp-unit" data-v="kg" class="${IMP.unit === "kg" ? "on" : ""}">kg</button></div></div>` : ""}
    ${newEx.length ? `<div class="small">These will be added as your own exercises: ${newEx.map((x) => esc(x.name)).join(", ")}.</div>` : `<div class="small">Every exercise matched the library.</div>`}
    <button class="btn pri block" style="margin-top:12px" data-act="imp-go" ${fresh.length ? "" : "disabled"}>Import for ${esc(myName() || "me")}</button>`;
}
async function runImport() {
  if (!S.personId) { toast("First, pick who's on this phone (👤 at the top)."); return; }
  const have = new Set(S.logs.filter((l) => l.importKey && l.personId === S.personId).map((l) => l.importKey));
  const batch = "imp_" + newId(), src = IMP.fmt;
  const logs = IMP.result.logs.filter((l) => !have.has(l.importKey))
    .map((l) => ({ ...l, notes: "", ts: Date.parse(l.date + "T12:00:00") || Date.now(), personId: S.personId, personName: myName(), source: src, importId: batch }));
  const used = new Set(logs.map((l) => l.exId));
  const btn = $("[data-act=imp-go]", topSheet().el); if (btn) { btn.disabled = true; btn.textContent = "Importing…"; }
  try {
    await saveMany("exercises", IMP.result.newEx.filter((x) => used.has(x.id)).map((x) => ({ ...x, equip: "Other", photo: "", video: "", muscles: "", steps: [], tips: [], mistakes: [], alts: [], aliases: [x.name.toLowerCase()] })));
    await saveMany("logs", logs);
  } catch (e) { console.error(e); toast("Import stopped partway: check your connection, then import again (finished parts are skipped)."); return; }
  const p = S.people.find((x) => x.id === S.personId);
  if (p) saveDoc("people", { ...p, imports: [...(p.imports || []), { id: batch, source: src, date: isoDay(), count: logs.length }] });
  closeSheet();
  toast(`Imported ${logs.length} exercise logs from ${FORMATS[src].name}.`, 3500);
}
function undoImport(id) {
  const p = S.people.find((x) => x.id === S.personId);
  const logs = S.logs.filter((l) => l.importId === id);
  if (!confirm(`Remove the ${logs.length} workouts from this import? Workouts you logged yourself stay.`)) return;
  logs.forEach((l) => deleteDoc("logs", l.id));
  if (p) saveDoc("people", { ...p, imports: (p.imports || []).filter((i) => i.id !== id) });
  toast("Import removed");
  closeSheet();
}

action("imp-open", () => openImporter());
action("imp-unit", (a) => { IMP.unit = a.dataset.v; renderPreview(); });
action("imp-go", () => runImport());
action("imp-undo", (a, e, id) => { e.preventDefault(); undoImport(id); });
slot("settings", 40, () => {
  const p = S.people.find((x) => x.id === S.personId);
  const imps = (p && p.imports) || [];
  return `<div class="f"><span class="lbl">Workouts from other apps</span>
    <button class="btn block" data-act="imp-open">Import from Strong, Hevy or FitNotes</button>
    ${imps.map((i) => `<div class="small" style="margin-top:6px">${esc(FORMATS[i.source] ? FORMATS[i.source].name : i.source)}, ${esc(i.date)}: ${i.count} logs · <a href="#" data-act="imp-undo" data-id="${esc(i.id)}">Undo</a></div>`).join("")}</div>`;
});
