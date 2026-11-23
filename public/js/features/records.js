// New personal record: a 🏆 pop-up when a saved log beats your best, and a badge on the log.
// The log feature decides "is this a PR?" before saving (stats.bestOf vs personalBest) and
// fires hook("logSaved", { ex, isNew, pr }); this file only celebrates.
import { hook, action } from "../core/ui.js";
import { esc, toast } from "../core/util.js";

export function celebrate(ex, label) {
  document.querySelectorAll(".prpop").forEach((x) => x.remove());
  const el = document.createElement("div");
  el.className = "prpop";
  el.setAttribute("data-act", "pr-close");
  el.innerHTML = `<div class="prcard"><div class="cup">🏆</div><div class="h">New personal best!</div>
    <div class="v">${esc(ex.name)}: <b>${esc(label)}</b></div><div class="small">Tap to close</div></div>`;
  document.body.appendChild(el);
  if (navigator.vibrate) navigator.vibrate([80, 60, 80, 60, 200]);
  setTimeout(() => el.remove(), 4500);
}

hook("logSaved", ({ ex, isNew, pr }) => {
  if (pr) celebrate(ex, pr.label);
  else toast(isNew ? "Saved " + ex.name : "Updated");
});
action("pr-close", (a) => a.remove());
