# Architecture plan

How the app is organised, and the plan for the next round of features. Written before the work starts so every future change follows the same shape. (Markdown only, so changing this file doesn't cost a Netlify deploy.)

## Status

- **Phase 0 done:** split into modules, lookups, history paging, offline-first service worker, tests in `tests/`.
- **Phase 1 done:** `overload.js` (suggestions), tick-to-repeat sets in `log.js`, `timer.js`, `records.js`, `wakelock.js`, `workoutmode.js`. Settings live on the "You & settings" sheet via `slot("settings")`; the session screen has `slot("session-top")`.
- **Phase 2 done:** `muscles.js` (weekly sets per muscle + body map; Progress and Today), `bodyweight.js` (collection `bodyweight`), `theme.js` (dark mode via colour variables in `app.css`). The Progress tab is now built from `slot("progress")` sections.
- **Phase 3 done:** `coach.js` + `netlify/functions/coach.mts` (Gemini, owner's key, sends a compact training summary), `importer.js` (Strong/Hevy/FitNotes CSV, matching, preview, undo; `saveMany` in `core/store.js` for batches). Shared Gemini access lives in `netlify/functions/_lib/gemini.mts`.
- **Timed workouts:** routines can carry `timer: { work, rest, rounds, roundRest }` (slots may have their own `secs`). `intervals.js` plays them (pure `timeline()` + player). The video reader returns `timer` and, when it can't open a page itself (Reddit often blocks servers), lets Gemini read it with the URL context tool.

## Where we were (before phase 0)

| Part | Today |
|---|---|
| App | One 1,700-line `public/index.html`: CSS, markup and all JavaScript in one `<script type="module">` |
| Data files | `exercises.js`, `exercises-more.js`, `plans.js`, `photos.js` set `window.*` globals |
| Storage | Firebase Firestore under `/gyms/{householdId}/{logs, exercises, people, media, sessions, routines}`, or localStorage when Firebase is off |
| Server | One Netlify function, `import-workout.mts` (video → routine with Gemini, using the owner's key) |
| Offline | Service worker, network-first for everything |
| Tests | Ad-hoc Playwright scripts in the scratchpad (lost between sessions) |

What works well and stays:
- No build step, no framework.
- One click handler using `data-act` attributes.
- Full-screen "sheets".
- Plan days and video routines share one "slot" format.
- The data layer hides Firebase vs. local.

What will hurt as features are added:
- **One giant file.** Every feature edits the same file, and the central `switch` of actions grows with each one.
- **The Today and Progress screens are hard-coded lists.** A new card means editing the screen code.
- **Repeated work.** Derived data (best lifts, last time, logs per exercise) is recomputed by scanning all logs, again and again on every render.
- **Network-first loading** makes the app wait for the internet on every launch.
- **Tests aren't kept**, so each session rebuilds them.

## Target structure (still no build step)

Browsers load ES modules natively, so the single page splits into small files with `import`/`export`. There is nothing to compile, and Netlify still just serves files.

```
public/
  index.html            shell only: <link> to CSS, one <script type="module" src="js/main.js">
  css/app.css           all styles; colours as variables (light + dark)
  data/                 exercises.js, exercises-more.js, plans.js, photos.js  (become `export` modules)
  js/
    main.js             start-up: open store, register features, first render
    core/
      store.js          Firebase/local data layer + collection registry (subscribe once, keep in state)
      state.js          the shared state object + derived indexes (see "Speed")
      ui.js             sheets, toast, render scheduling, the action registry, "slots"
      util.js           esc(), dates, units, number formatting
      charts.js         the SVG line chart (Progress, body weight)
    features/           one file per feature; each registers itself (see below)
      library.js  exercise.js  log.js  dictation.js  plans.js  session.js
      routines.js (video import)  progress.js  history.js  people.js
      timer.js  overload.js  muscles.js  bodyweight.js  records.js
      workoutmode.js  wakelock.js  theme.js  coach.js  importer.js
  sw.js  manifest.webmanifest  icons  photos/
netlify/functions/
  _lib/http.mts         shared helpers (JSON replies, rate-limit config, error messages)
  import-workout.mts    video → routine (Gemini with the owner's API key; watches YouTube videos)
  coach.mts             AI coach (Gemini with the owner's API key)
tests/                  Playwright tests kept in the repo (see "Tests")
```

### The one pattern every feature follows

Each feature is a module that **registers** what it adds. It doesn't edit other files:

```js
// features/bodyweight.js
import { collection, action, slot } from "../core/ui.js";
collection("bodyweight", { sort: byDateDesc });                 // auto-subscribed into state
action("bw-add", () => openBodyWeightSheet());                  // replaces a case in the big switch
slot("progress", 30, () => bodyWeightCard());                   // a card on the Progress tab, at position 30
slot("settings", 50, () => bodyWeightUnitsRow());               // optional extra rows in settings
```

- **Actions.** `action(name, fn)` replaces the central `switch`. A button with `data-act="bw-add"` calls it.
- **Slots.** `slot(screen, order, render)` lets a feature add a card to a screen. Today, Progress, the session sheet, the log sheet and settings each render their slots in order. Adding or removing a feature is then one import line in `main.js`.
- **Collections.** `collection(name)` subscribes to the Firestore or local collection once and keeps it in `state`. New data types need no changes to the data layer.
- **Pure logic is kept apart from screen code.** Examples are the overload suggestion, PR detection, CSV parsing and weekly muscle counts. That makes them easy to test and reuse.

### Data (additions only; nothing existing changes shape)

| Collection / field | Used by |
|---|---|
| `bodyweight` `{personId, date, w, unit}` | Body weight log |
| `people.prefs` `{rest: {heavy, light}, theme, keepAwake}` | Timer defaults, dark mode, screen-on (per person, shared) |
| Exercise `muscleMap: {primary:[...], secondary:[...]}` | "Muscles this week" body map (added to the data files) |
| Log `source: "strong" \| "hevy" \| "fitnotes"` | Importer (so imports can be undone) |

Per-phone choices that shouldn't follow the person between devices stay in localStorage: the theme override, sound on/off and the last tab.

## Speed

1. **Instant start (service worker).**
   - App files are precached at install and served **cache-first**, then refreshed in the background ("stale-while-revalidate").
   - Photos and the versioned Firebase SDK are cache-first: they never change for a given URL.
   - `/api/*` always goes to the network.
   - One `VERSION` constant drives everything.
2. **Indexes instead of scans.** When logs change, build once:
   - `logsByEx` (Map)
   - `lastByEx`
   - `bestByEx`
   - `logsByDay`

   Screens read from these instead of filtering every log for each tile. The cost per render goes from "all logs × all exercises" to "a lookup".
3. **Render only what's visible.**
   - Only the active tab renders.
   - An open sheet re-renders only itself.
   - History shows the last 60 days, with "Show older".
4. **Firebase.** Keep the persistent local cache. The SDK becomes cache-first through the service worker, so it isn't downloaded on each launch.

## Features: how each one fits

| # | Feature | Design |
|---|---|---|
| 1 | Rest timer | `timer.js`. Starts when a set is saved. It stores an **end time**, not a counter, so it survives the phone sleeping. Floating pill with −15s / +15s / skip; vibration and a beep at 0. The default depends on the exercise: heavy compound lifts 2:00, isolation 1:00, both per person in prefs. Honest limit: phones won't sound an alarm while the app is fully closed. |
| 2 | Progressive overload | `overload.js`, a pure function: last session + target range → suggestion. If every set reached the top of the range, add 5 lb / 2.5 kg (dumbbells: 5 lb / 2 kg); if not, keep the weight. Shown on session slots and pre-filled in the log sheet. |
| 3 | Muscles this week | `muscles.js`. Each exercise gets a `muscleMap`. Count working sets per muscle Mon–Sun (primary = 1, secondary = ½). Body outline SVG (front/back) shaded by sets, plus a list. A Progress card plus a mini version on Today. |
| 4 | Body weight | `bodyweight.js`. Quick entry, a chart (shared `charts.js`), weekly average and change. |
| 5 | AI coach (decided: Gemini inside the app) | `coach.mts` + `coach.js`, using **Google Gemini with the owner's own API key** (`GOOGLE_API_KEY`, the same key the video reader uses, set as a secret environment variable in Netlify, scope Functions; never in code or chat), through Google's official `@google/genai` SDK. The model name comes from `GEMINI_MODEL`, with a sensible Flash default, so it can change without a code edit. The phone sends a **compact summary** (last 8 weeks per exercise, plan, body weight), not raw logs. The answer is in plain English. Rate-limited like the importer. Billing is on the owner's Google account, not Netlify credits. If the key is missing, the coach card says so and links to the setup steps. |
| 6 | Import from Strong / Hevy / FitNotes | `importer.js`. Parses their CSV exports on the phone. Names are matched with the existing alias matcher; unknown names become custom exercises. A preview screen shows what will be imported; everything is tagged with `source` so it can be undone in one tap. |
| 7 | Workout mode | `workoutmode.js`. A full-screen view over a session: one exercise at a time, big buttons for ✓ set, rest timer, next/previous, and a photo. Uses the same session data, so leaving it loses nothing. |
| 8 | Tick-to-repeat sets | In `log.js`. Sets are pre-filled from the overload suggestion or last time and show a big ✓. One tap saves the set as is and starts the rest timer. Editing a number is still one tap away. |
| 9 | PR celebration | `records.js`. When a saved log beats `bestByEx` (heaviest, estimated 1-rep max, or most reps / longest time), show a 🏆 pop-up and mark the log. |
| 10 | Dark mode | `theme.js` + colour variables in `app.css`. Follows the phone setting by default, with an override per phone. Photos get a slightly darker frame. |
| 11 | Screen stays on | `wakelock.js`. Screen Wake Lock while a session or workout mode is open; re-acquired when the app returns to the front; on by default and switchable. |
| 12–14 | Speed | Service worker and indexes above. |
| 15 | Long history | History paginates; indexes keep Progress fast. |

## Tests (kept in the repo from now on)

- `tests/` holds Playwright tests. A tiny static server serves `public/` and fakes Firebase and `/api/*`.
- Unit tests for the pure modules (overload, PRs, CSV import, muscle counts) run in Node with no browser.
- One command runs everything: `npm test`.
- Netlify's `ignore` rule is widened to skip `tests/` as well as Markdown, so test-only changes don't cost a deploy.
- Screenshots still go to the scratchpad, never the repo.

## Order of work (each phase = one pull request with a free preview)

| Phase | What | Visible change |
|---|---|---|
| 0 | Split into modules, service worker speed-up, indexes, kept tests | None (should feel faster) |
| 1 | In the gym: rest timer, tick-to-repeat sets, overload suggestions, PR pop-up, screen stays on, workout mode | Big |
| 2 | Progress: muscles this week, body weight, history paging, dark mode | Medium |
| 3 | Extras: AI coach, import from other apps | Medium |

Phase 0 changes no behaviour. It's checked by running the same tests before and after the split.

Publishing: every phase gets a preview link. Each **publish** is one production deploy (15 credits). The cheapest option is to publish once after phase 3. A good middle ground is two publishes: after phase 1, and after phase 3.

## Conventions

- One feature, one file. A feature only talks to others through `core/` (state, actions, slots), never by reaching into another feature's code.
- Screen code returns HTML strings built with `esc()` for anything typed by a person or returned by the AI.
- Pure logic takes plain data in and returns plain data out: no DOM, no state.
- Keep a file under about 300 lines; split it if it grows past that.
- Anything that changes the app bumps `VERSION` in `sw.js`.
- Exercise instructions follow ASD-STE100: short commands, one action per sentence.
