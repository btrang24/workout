// Small helpers: HTML escaping, toast, dates, units.
/* ============================================================
   Helpers
   ============================================================ */
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function toast(msg, ms = 2600) {
  document.querySelectorAll(".toast").forEach((x) => x.remove());
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
export const pad2 = (n) => String(n).padStart(2, "0");
export const isoDay = (d = new Date()) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
export function dayLabel(iso) {
  const today = isoDay(), y = new Date(); y.setDate(y.getDate() - 1);
  if (iso === today) return "Today";
  if (iso === isoDay(y)) return "Yesterday";
  const d = new Date(iso + "T12:00:00");
  const opts = { weekday: "short", month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(undefined, opts);
}
export const shortDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const num = (n) => (n == null || n === "" || isNaN(n) ? "" : String(Math.round(Number(n) * 10) / 10));
export function fmtTime(s) {
  s = Math.round(Number(s) || 0);
  if (s < 60) return s + " sec";
  if (s >= 600 && s % 60 === 0) return s / 60 + " min";
  return Math.floor(s / 60) + ":" + pad2(s % 60);
}
export const fmtClock = (s) => { s = Math.round(Number(s) || 0); return Math.floor(s / 60) + ":" + pad2(s % 60); };
export function parseTime(str) {
  str = String(str || "").trim().toLowerCase();
  if (!str) return null;
  let m = str.match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  m = str.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?)$/);
  if (m) return Math.round(+m[1] * 60);
  m = str.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?)?$/);
  if (m) return Math.round(+m[1]);
  return null;
}
export const KG = 2.20462;
export function conv(w, from, to) {
  if (w == null || w === "") return w;
  if (from === to) return Number(w);
  return from === "kg" ? Number(w) * KG : Number(w) / KG;
}
export const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
