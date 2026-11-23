// Start-up: load every feature (each registers its tabs, buttons, cards and data),
// open the data store, then draw the app.
import { initStore } from "./core/store.js";
import { render, startCollections, runHooks } from "./core/ui.js";

// Tabs (in the order they appear) and the features that add to them.
import "./features/library.js";
import "./features/today.js";
import "./features/progress.js";
import "./features/history.js";
import "./features/exercise.js";
import "./features/custom.js";
import "./features/log.js";
import "./features/dictation.js";
import "./features/people.js";
import "./features/plans.js";
import "./features/routines.js";
// In the gym (phase 1)
import "./features/timer.js";
import "./features/wakelock.js";
import "./features/records.js";
import "./features/workoutmode.js";
// Progress and looks (phase 2)
import "./features/muscles.js";
import "./features/bodyweight.js";
import "./features/theme.js";

await initStore();
startCollections();
render();
runHooks("start");
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});

// A new version took over (see sw.js): reload once so every file is from the same version.
// If something is open (a log being typed), wait until the next time the app is opened.
if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!document.querySelector(".sheet")) location.reload();
  });
}
