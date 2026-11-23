# Working on Our Workouts

A household workout tracker. Static web app in `public/` (no build step), shared data in Firebase (`/gyms/{householdId}/...`), one Netlify function (`netlify/functions/import-workout.mts`) that reads workout videos using Claude through Netlify AI Gateway. See `README.md` for the file map and the Netlify how-to.

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

- Run the app in Playwright before telling the owner something works. Serve `public/` over a small local HTTP server, not `file://`, so `/api/import-workout` can be intercepted. Use phone size (390×844).
- This sandbox can't reach most of the internet. Fake what it can't reach instead of skipping the test:
  - Firebase (`www.gstatic.com`): abort it, so the app runs in "This device" (localStorage) mode.
  - `/api/import-workout`: mock it with `page.route` (a normal answer, a "couldn't read" 422, and an error).
  - The function itself: bundle it with esbuild and call its handler in Node. Point `ANTHROPIC_BASE_URL` at a local fake server, and stub `fetch` for YouTube, Reddit, TikTok and Instagram pages.
  - The live site, YouTube, Instagram, TikTok, Reddit and the real AI can't be reached from here (only Wikimedia is allowed).
- Look at the screenshots yourself before reporting.
- Write screenshots and test scripts to the scratchpad, never inside the repo. Run tests from outside `public/`, because a stray `undefined/` folder once got committed that way.
- When reporting, say honestly **what was tested for real and what was tested against fakes**, and what the owner should try on the real site to cover the rest.

## Pull requests and previews

- When a batch of changes is ready, open a pull request from your branch into `main`, or update the existing open one. Group related work into one PR; don't open one per small change.
- Give the owner the Netlify deploy preview link `https://deploy-preview-<PR number>--workoutbaobao.netlify.app`, plus a short list of what to try on it.
- Previews are free. A production deploy (anything merged to `main`) costs **15 of the owner's 300 monthly Netlify credits**. Reading a video with AI also uses credits, roughly 15–25 per video. Keep both in mind.

## Publishing

- Merge a PR into `main` only when the owner says **"publish"**.
- Batch changes so there are as few merges (production deploys) as possible. If more fixes are coming, say so and suggest waiting before publishing.
- After publishing, confirm the production deploy finished (Netlify tools) and tell the owner what to check on the live site. Remind them to fully close and reopen the installed app if they still see the old version.

## Saving deploys

- `netlify.toml` has an `ignore` rule under `[build]`, so commits that only change Markdown files (like this one or `README.md`) don't trigger a deploy. Don't remove it.
- When a change touches the app, bump the cache name in `public/sw.js` (`workouts-vN`) so phones pick up the new version.

## Project notes

- No framework and no build step for the app. Keep it that way. Script order in `index.html`: `config.js`, `exercises.js`, `exercises-more.js`, `plans.js`, `photos.js`, then the module.
- Firestore rules (`firestore.rules`) allow everything under `/gyms/{hid}/`. New collections need no rule change, but keep the `households` rule for the recipe app.
- The site is public to anyone with the link. Nothing sensitive goes in it. Never put keys or secrets in code or in `netlify.toml`.
- AI calls use the Anthropic SDK with no API key (Netlify AI Gateway injects it). The function is rate-limited to 20 calls a minute per visitor; keep a limit like that.
