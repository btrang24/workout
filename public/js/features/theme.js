// Dark mode. Follows the phone's setting ("Auto") unless this phone picks Light or Dark.
// The choice is applied before the page draws by a tiny script in index.html (no white flash).
import { action, slot } from "../core/ui.js";

const KEY = "wk:theme";
const get = () => localStorage.getItem(KEY) || "auto";
export function applyTheme(t = get()) {
  const root = document.documentElement;
  if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#121619" : "#1e5f74");
}
applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => applyTheme());

action("theme", (a) => {
  localStorage.setItem(KEY, a.dataset.v); applyTheme(a.dataset.v);
  a.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === a));
});
slot("settings", 30, () => `<div class="f"><span class="lbl">Colours on this phone</span>
  <div class="seg">${[["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]].map(([v, n]) => `<button data-act="theme" data-v="${v}" class="${get() === v ? "on" : ""}">${n}</button>`).join("")}</div>
  <div class="hint">Auto follows your phone's dark mode.</div></div>`);
