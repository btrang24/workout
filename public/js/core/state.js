// Shared app state and quick lookups.
// Lookups over logs and exercises are built once per data change (see `index()`),
// so screens read from maps instead of scanning every log for every tile.
import { BUILTIN } from "./data.js";

export const GROUPS = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Cardio", "Full body"];
export const EQUIP = ["None", "Barbell", "Dumbbells", "Kettlebell", "Machine", "Cable", "Band", "Pull-up bar", "Bench", "Other"];
export const GROUP_EMOJI = { Legs: "🦵", Chest: "💪", Back: "🚣", Shoulders: "🏋️", Arms: "💪", Core: "🧘", Cardio: "🏃", "Full body": "🤸" };
export const S = {
  tab: "library", q: "", filter: "All",
  logs: [], custom: [], people: [], media: {}, sessions: [], routines: [],
  loaded: { people: false },
  personId: localStorage.getItem("wk:person") || "",
  unit: localStorage.getItem("wk:unit") || "lb",
  histAll: false, histDays: 60, progEx: "", progMetric: "",
};
export const me = () => S.people.find((p) => p.id === S.personId);
export const myName = () => (me() ? me().name : "");
export const isNoEquip = (e) => /^(none|bodyweight)$/i.test(e.equip || "");

/* ---------- exercises: rebuilt only when custom exercises change ---------- */
let exMemo = { custom: null, list: [], byId: new Map() };
export function allEx() {
  if (exMemo.custom !== S.custom) {
    const list = [...BUILTIN, ...S.custom.map((c) => ({ ...c, custom: true }))];
    exMemo = { custom: S.custom, list, byId: new Map(list.map((e) => [e.id, e])) };
  }
  return exMemo.list;
}
export const exById = (id) => (allEx(), exMemo.byId.get(id));

/* ---------- logs: rebuilt only when logs or the chosen person change ---------- */
const newestFirst = (a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0);
let logMemo = { logs: null, pid: null };
/** Index of this person's logs: all (newest first) and grouped by exercise. Shared memo, don't mutate. */
export function index() {
  if (logMemo.logs !== S.logs || logMemo.pid !== S.personId) {
    const mine = S.logs.filter((l) => !S.personId || l.personId === S.personId).sort(newestFirst);
    const byEx = new Map();
    for (const l of mine) (byEx.get(l.exId) || byEx.set(l.exId, []).get(l.exId)).push(l);
    logMemo = { logs: S.logs, pid: S.personId, mine, byEx, best: new Map() };
  }
  return logMemo;
}
/** This person's logs, newest first (a copy, safe to sort or change). */
export const myLogs = () => index().mine.slice();
/** This person's logs for one exercise, newest first (a copy). */
export const logsFor = (exId) => (index().byEx.get(exId) || []).slice();
