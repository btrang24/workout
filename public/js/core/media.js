// Photos, diagrams and thumbnails for exercises.
import { PHOTOS, drawSvg } from "./data.js";
import { GROUP_EMOJI, S } from "./state.js";
import { $, esc } from "./util.js";

/* ============================================================
   Diagram / thumbnail helpers
   ============================================================ */
export function media(ex) { return ex.custom ? { photo: ex.photo, video: ex.video } : S.media[ex.id] || {}; }
export function thumb(ex, cls = "dg") {
  const md = media(ex);
  if (md.photo) return `<img src="${esc(md.photo)}" alt="">`;
  const bp = PHOTOS[ex.id];
  if (bp) return `<img src="${esc(bp.src)}" alt="" loading="lazy">`;
  if (ex.poses) return drawSvg(ex, ex.thumbT ?? (ex.id === "deadlift" ? 0 : 1), cls);
  return `<span>${ex.emoji || GROUP_EMOJI[ex.group] || "🏋️"}</span>`;
}
export function ytId(url) {
  const m = String(url || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
