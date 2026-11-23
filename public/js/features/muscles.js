// Muscles trained this week (Monday to Sunday): working sets per muscle, a body map and a list.
// An exercise's first listed muscle counts 1 per set; the others count ½ (they help).
import { S, index, exById } from "../core/state.js";
import { slot } from "../core/ui.js";
import { esc, isoDay, num } from "../core/util.js";

export const MUSCLES = {
  chest: "Chest", shoulders: "Front & side shoulders", reardelt: "Rear shoulders", upperback: "Upper back", lats: "Lats",
  lowback: "Lower back", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs & core",
  glutes: "Glutes", quads: "Quads", hams: "Hamstrings", calves: "Calves",
};
const WORDS = [
  [/upper chest|chest/, ["chest"]], [/rear shoulder|rotator/, ["reardelt"]], [/shoulder/, ["shoulders"]],
  [/upper back/, ["upperback"]], [/lower back/, ["lowback"]], [/lats/, ["lats"]], [/^back$/, ["upperback", "lats"]],
  [/biceps|brachialis/, ["biceps"]], [/triceps/, ["triceps"]], [/^arms$/, ["biceps", "triceps"]], [/forearm|grip/, ["forearms"]],
  [/abs|core/, ["abs"]], [/glute/, ["glutes"]], [/quad/, ["quads"]], [/hamstring/, ["hams"]], [/calves|calf/, ["calves"]],
  [/^legs$/, ["quads", "hams", "glutes"]],
];
const BY_GROUP = { Legs: ["quads", "glutes", "hams"], Chest: ["chest", "triceps"], Back: ["lats", "upperback", "biceps"], Shoulders: ["shoulders"], Arms: ["biceps", "triceps"], Core: ["abs"] };

/** { primary: [...keys], secondary: [...keys] } for an exercise, from its "Works:" text (or its group). */
export function muscleMap(ex) {
  const parts = String(ex.muscles || "").toLowerCase().split(/,| and /).map((x) => x.trim()).filter(Boolean);
  const keys = (w) => (WORDS.find(([re]) => re.test(w)) || [, []])[1];
  if (!parts.length) { const g = BY_GROUP[ex.group] || []; return { primary: g.slice(0, 1), secondary: g.slice(1) }; }
  const primary = keys(parts[0]);
  const secondary = parts.slice(1).flatMap(keys).filter((k) => !primary.includes(k));
  return { primary, secondary: [...new Set(secondary)] };
}

/** Sets per muscle for this person, this week. */
export function weekSets(today = new Date()) {
  const dow = (today.getDay() + 6) % 7, mon = new Date(today); mon.setDate(today.getDate() - dow);
  const from = isoDay(mon), to = isoDay(today);
  const out = Object.fromEntries(Object.keys(MUSCLES).map((k) => [k, 0]));
  for (const l of index().mine) {
    if (l.date < from || l.date > to) continue;
    const ex = exById(l.exId); if (!ex) continue;
    const n = (l.sets || []).length, m = muscleMap(ex);
    m.primary.forEach((k) => (out[k] += n));
    m.secondary.forEach((k) => (out[k] += n / 2));
  }
  return out;
}

const shade = (v) => (v > 0 ? `fill="var(--hot)" fill-opacity="${(0.25 + 0.75 * Math.min(1, v / 12)).toFixed(2)}"` : `fill="var(--line)"`);
/** Front and back body outline, each muscle shaded by its sets (12+ sets = full colour). */
export function bodySvg(w) {
  const e = (k, cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${shade(w[k])}><title>${MUSCLES[k]}: ${num(w[k])} sets</title></ellipse>`;
  const pair = (k, cx, d, cy, rx, ry) => e(k, cx - d, cy, rx, ry) + e(k, cx + d, cy, rx, ry);
  const body = (cx) => `<circle cx="${cx}" cy="16" r="10" fill="var(--dg-bg)"/>
    <rect x="${cx - 17}" y="29" width="34" height="58" rx="11" fill="var(--dg-bg)"/>
    <rect x="${cx - 30}" y="33" width="10" height="58" rx="5" fill="var(--dg-bg)"/><rect x="${cx + 20}" y="33" width="10" height="58" rx="5" fill="var(--dg-bg)"/>
    <rect x="${cx - 16}" y="84" width="14" height="86" rx="7" fill="var(--dg-bg)"/><rect x="${cx + 2}" y="84" width="14" height="86" rx="7" fill="var(--dg-bg)"/>`;
  const front = body(50) + pair("shoulders", 50, 19, 39, 7, 7) + pair("chest", 50, 7, 45, 7, 7) + `<rect x="43" y="55" width="14" height="27" rx="4" ${shade(w.abs)}><title>Abs & core: ${num(w.abs)} sets</title></rect>`
    + pair("biceps", 50, 25, 55, 4, 9) + pair("forearms", 50, 25, 78, 3.5, 9) + pair("quads", 50, 9, 111, 6.5, 18) + pair("calves", 50, 9, 148, 4.5, 12);
  const back = body(150) + `<ellipse cx="150" cy="41" rx="15" ry="7" ${shade(w.upperback)}><title>Upper back: ${num(w.upperback)} sets</title></ellipse>`
    + pair("reardelt", 150, 19, 39, 7, 7) + pair("lats", 150, 10, 59, 7, 11) + `<rect x="144" y="70" width="12" height="13" rx="3" ${shade(w.lowback)}><title>Lower back: ${num(w.lowback)} sets</title></rect>`
    + pair("triceps", 150, 25, 55, 4, 9) + pair("forearms", 150, 25, 78, 3.5, 9) + pair("glutes", 150, 8, 92, 7.5, 8) + pair("hams", 150, 9, 116, 6.5, 15) + pair("calves", 150, 9, 148, 6, 12);
  return `<svg class="body" viewBox="0 0 200 186" role="img" aria-label="Muscles trained this week, front and back">${front}${back}
    <text x="50" y="184" text-anchor="middle" font-size="9" fill="var(--muted)">Front</text><text x="150" y="184" text-anchor="middle" font-size="9" fill="var(--muted)">Back</text></svg>`;
}

function weekCard() {
  if (!index().mine.length) return "";
  const w = weekSets();
  const rows = Object.entries(w).sort((a, b) => b[1] - a[1]);
  const trained = rows.filter(([, v]) => v > 0), none = rows.filter(([, v]) => !v);
  return `<div class="dayh">Muscles this week</div>
    <div class="chartbox">${bodySvg(w)}
      <div class="mlist">${trained.map(([k, v]) => `<div class="mrow"><span>${MUSCLES[k]}</span><i><b style="width:${Math.min(100, (v / 20) * 100)}%"></b></i><span class="n">${num(v)}</span></div>`).join("") || `<div class="small">Nothing logged yet this week.</div>`}</div>
      ${none.length && trained.length ? `<div class="small" style="margin-top:6px">Not trained yet: ${none.map(([k]) => MUSCLES[k].toLowerCase()).join(", ")}.</div>` : ""}
      <div class="small" style="margin-top:4px">Sets since Monday. Aim for about 10–20 sets a week for each muscle.</div></div>`;
}
function todayLine() {
  if (!index().mine.length) return "";
  const top = Object.entries(weekSets()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!top.length) return "";
  return `<div class="pad"><button class="btn block mweek" data-tab="progress">💪 This week: ${top.map(([k, v]) => `${esc(MUSCLES[k])} ${num(v)}`).join(" · ")} ›</button></div>`;
}
slot("progress", 10, weekCard);
slot("today", 30, todayLine);
