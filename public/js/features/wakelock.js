// Keep the screen on while a workout is open, so the phone doesn't lock between sets.
// Uses the Screen Wake Lock API where the phone supports it; re-acquired when the app comes back.
import { action, hook, slot } from "../core/ui.js";

const PREF = "wk:awake";
const on = () => localStorage.getItem(PREF) !== "off";
let lock = null, open = 0;

async function acquire() {
  if (!("wakeLock" in navigator) || !on() || lock || open <= 0 || document.visibilityState !== "visible") return;
  try { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } catch {}
}
function release() { if (lock) { lock.release().catch(() => {}); lock = null; } }

hook("sessionOpen", () => { open++; acquire(); });
hook("sessionClose", () => { open = Math.max(0, open - 1); if (!open) release(); });
document.addEventListener("visibilitychange", () => acquire());

action("awake-pref", (a) => {
  localStorage.setItem(PREF, a.dataset.v);
  a.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === a));
  if (a.dataset.v === "off") release(); else acquire();
});
slot("settings", 20, () => ("wakeLock" in navigator ? `<div class="f"><span class="lbl">Keep the screen on during a workout</span>
  <div class="seg"><button data-act="awake-pref" data-v="on" class="${on() ? "on" : ""}">On</button><button data-act="awake-pref" data-v="off" class="${on() ? "" : "on"}">Off</button></div></div>` : ""));
