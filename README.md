# Our Workouts

A household workout tracker. It's a plain web page (no build step) that saves to the same Firebase project as the recipe app, under its own `/gyms/...` section.

The app's files are in `public/` (that's the folder Netlify publishes):
- `public/index.html`: the page shell. It loads the data scripts below, `css/app.css`, and `js/main.js`
- `public/js/core/`: shared parts (data storage, state and quick lookups, stats, screen plumbing, helpers)
- `public/js/features/`: one file per feature (library, today, log, plans, video workouts, progress, history...). Each registers its own tab, buttons and cards. See `ARCHITECTURE.md`
- `public/css/app.css`: all styles
- `public/exercises.js`: the 15 built-in exercises (steps, tips, mistakes, alternatives) and the animated form diagrams
- `public/exercises-more.js`: the extra exercises the plans use, plus cardio
- `public/plans.js`: the 3/4/5/6-day Push Pull Legs plans and the Cardio goal
- `public/photos.js` and `public/photos/`: start/finish photos for each exercise (free-exercise-db collection)
- `public/config.js`: Firebase settings and this app's household phrase
- `public/sw.js`, `public/manifest.webmanifest`, `public/icon-*.png`: what makes it installable, opens it instantly and offline, and lets Android share links into it

Outside `public/`:
- `netlify/functions/import-workout.mts`: the "workout from a video" reader. It reads a YouTube / Instagram / TikTok / Reddit link (title, caption, YouTube transcript, Reddit post and comments) and asks Google Gemini (with the owner's own API key) to turn it into a list of exercises. For YouTube links Gemini also watches the video. Served at `/api/import-workout`.
- `package.json`: the one library the reader needs (Google's Gemini SDK, `@google/genai`). Netlify installs it automatically.
- `tests/`: automatic checks (`npm test`): the app in a phone-sized browser, offline start, and the video reader against a fake Gemini
- `firestore.rules`: the full Firebase rules (recipe app + workout app)
- `netlify.toml`: tells Netlify to publish `public/` and where the function is

To try it on a computer, serve the `public/` folder with any small web server (for example `npx serve public`) and open it in a browser. Opening `index.html` as a file doesn't work, because browsers block modules from files. With `firebase: null` in `public/config.js`, everything saves in that browser only. Reading videos needs the website version, because it runs on Netlify.

## Netlify settings (how-to, for next time)

Site: https://workoutbaobao.netlify.app · Dashboard: https://app.netlify.com/projects/workoutbaobao

**Make the live site publish from `main`**
1. Open the dashboard and tap **Manage**, then **Build and deploy**.
2. In the **Find a setting** box (under "Manage / Build and deploy", not the app search at the very top), type **branch**.
3. Tap **Versions and previews**.
4. Find **Production branch**, clear the box, type `main`, and tap **Save**.
5. Optional: on the **Deploys** tab, use **Trigger deploy → Deploy site** to publish right away.

**Let anyone with the link open the app (no Netlify login)**
- In **Versions and previews**, set **Who can see it** to **Public · anyone can visit**.
- Also check **Project configuration → Access & security → Visitor access** that team login / password protection is off.

**Don't touch**
- On the **Repository** tab, don't tap **Change** or **Unlink**. That disconnects the app from GitHub.
- Leave Build command (not set) and Base directory (not set) as they are. The publish folder (`public`) is set in `netlify.toml`, which overrides the dashboard's Publish directory.

**GitHub default branch**
- On GitHub, open the repo and go to **Settings → General → Default branch**. Tap the two-arrows button, choose `main`, then **Update**.

**Workouts from videos (AI)**
- Uses **your own Gemini API key**, so it's billed to your Google account (Gemini's free tier usually covers personal use) and never uses Netlify credits. The function talks to Google directly, so Netlify's AI Gateway is never used.
- Setup: in Netlify, open the project, then **Manage**, and find **Environment variables**. Add `GOOGLE_API_KEY` with your key from aistudio.google.com, scope **Functions**, marked **Secret**. Then redeploy. `GEMINI_API_KEY` also works.
- Optional: `GEMINI_MODEL` picks the Gemini model (default `gemini-flash-latest`; if that name isn't available, it falls back to `gemini-2.5-flash`).
- If the app says "video reading isn't set up", the key is missing; "Google didn't accept the key" means it's wrong or disabled.
- Each visitor can read at most 20 videos a minute (set in the function), so a stranger with the link can't run up a big bill quickly.
