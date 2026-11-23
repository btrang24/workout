# Working on Our Workouts

A household workout tracker. Static web app in `public/` (no build step), shared data in Firebase (`/gyms/{householdId}/...`), two Netlify functions using Google Gemini with the owner's own API key: `import-workout.mts` (reads workout videos) and `coach.mts` (AI coach), sharing `netlify/functions/_lib/gemini.mts`. See `README.md` for the file map and the Netlify how-to.

- Live site: https://workoutbaobao.netlify.app (Netlify project `workoutbaobao`, production branch `main`)
- Repo: `btrang24/workout`

## Talking to the owner

- The owner is not a developer. Explain everything in plain English: what changed, why, and what it means for them. Skip jargon, or explain it in a few words when it can't be avoided.
- Always end with **what to check on their phone**: which tab or button to tap, what they should see, and what to tell you if it looks wrong.
- When they need to change a setting (GitHub, Netlify, Firebase), give click-by-click steps for the phone. If a step doesn't match their screen, ask for a screenshot rather than guessing.

## Git: never touch main directly

- Never commit or push to `main`. Work on your own branch (the one this session was given, e.g. `claude/...`) and push to it as often as you like.
- Changes reach `main` only by merging a pull request, and only when the owner says **"publish"** (see below).

## Test before showing anything

- Run `npm test` (from the repo root) before telling the owner something works, and add checks to `tests/` for anything new. The tests serve `public/` over a small local server (`tests/server.cjs`, which also switches Firebase off) at phone size (390×844). Modules don't load from `file://`.
- This sandbox can't reach most of the internet. Fake what it can't reach instead of skipping the test:
  - Firebase (`www.gstatic.com`): abort it, so the app runs in "This device" (localStorage) mode.
  - `/api/import-workout` and `/api/coach`: mock them with `page.route` (normal answers and errors).
  - The function itself: bundle it with esbuild and call its handler in Node, with `fetch` stubbed for Google's Gemini API and for YouTube, Reddit, TikTok and Instagram pages.
  - The live site, YouTube, Instagram, TikTok, Reddit and the real Gemini API can't be reached from here (only Wikimedia is allowed).
- Look at the screenshots yourself before reporting.
- Tests live in `tests/` and are committed (Netlify skips deploys for test-only changes). Screenshots go to `$SHOTS` or the system temp folder, never the repo. One-off debugging scripts go in the scratchpad.
- When reporting, say honestly **what was tested for real and what was tested against fakes**, and what the owner should try on the real site to cover the rest.

## Pull requests and previews

- When a batch of changes is ready, open a pull request from your branch into `main`, or update the existing open one. Group related work into one PR; don't open one per small change.
- Give the owner the Netlify deploy preview link `https://deploy-preview-<PR number>--workoutbaobao.netlify.app`, plus a short list of what to try on it.
- Previews are free. A production deploy (anything merged to `main`) costs **15 of the owner's 300 monthly Netlify credits**. Video reading uses the owner's Gemini key (billed by Google), not Netlify credits. Keep it that way: don't route AI through Netlify AI Gateway.

## Publishing

- Merge a PR into `main` only when the owner says **"publish"**.
- Batch changes so there are as few merges (production deploys) as possible. If more fixes are coming, say so and suggest waiting before publishing.
- After publishing, confirm the production deploy finished (Netlify tools) and tell the owner what to check on the live site. Remind them to fully close and reopen the installed app if they still see the old version.

## Saving deploys

- `netlify.toml` has an `ignore` rule under `[build]`, so commits that only change Markdown files (like this one or `README.md`) don't trigger a deploy. Don't remove it.
- When a change touches anything in `public/`, bump `VERSION` in `public/sw.js`. The service worker serves the phone's saved copy until the version changes, so a missed bump means phones never see the update.

## Project notes

- No framework and no build step for the app. Keep it that way. Script order in `index.html`: `config.js`, `exercises.js`, `exercises-more.js`, `plans.js`, `photos.js`, then `js/main.js` (a module).
- Follow `ARCHITECTURE.md`: one feature per file in `public/js/features/`. A feature registers itself with `view`, `action`, `slot`, `collection` and `hook` from `js/core/ui.js`, and is imported once in `js/main.js`. Core files never import features. Read logs through the lookups in `js/core/state.js` (`index()`, `logsFor`, `myLogs`); don't scan `S.logs` in screen code.
- Firestore rules (`firestore.rules`) allow everything under `/gyms/{hid}/`. New collections need no rule change, but keep the `households` rule for the recipe app.
- The site is public to anyone with the link. Nothing sensitive goes in it. Never put keys or secrets in code or in `netlify.toml`.
- AI calls use Google's `@google/genai` SDK with the owner's key from the Netlify env var `GOOGLE_API_KEY` (or `GEMINI_API_KEY`), always sent straight to `generativelanguage.googleapis.com` so Netlify AI Gateway credits are never used. The SDK is listed in `external_node_modules` in `netlify.toml` (it can't be bundled). Each function is rate-limited to 20 calls a minute per visitor; keep a limit like that.
- To test the function, bundle it with esbuild using `--external:@google/genai` and run it from the repo folder, with `fetch` stubbed for `generativelanguage.googleapis.com` and the video sites.
