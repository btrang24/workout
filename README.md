# Our Workouts

A household workout tracker. It's a plain web page (no build step) that saves to the same Firebase project as the recipe app, under its own `/gyms/...` section.

The app's files are in `public/` (that's the folder Netlify publishes):
- `public/index.html`: the app
- `public/exercises.js`: the 15 built-in exercises (steps, tips, mistakes, alternatives) and the animated form diagrams
- `public/exercises-more.js`: the extra exercises the plans use, plus cardio
- `public/plans.js`: the 3/4/5/6-day Push Pull Legs plans and the Cardio goal
- `public/photos.js` and `public/photos/`: exercise photos from Wikimedia Commons, with credits
- `public/config.js`: Firebase settings and this app's household phrase
- `public/sw.js`, `public/manifest.webmanifest`, `public/icon-*.png`: what makes it installable on a phone (and lets Android share links into it)

Outside `public/`:
- `netlify/functions/import-workout.mts`: the "workout from a video" reader. It reads a YouTube / Instagram / TikTok / Reddit link (title, caption, YouTube transcript, Reddit post and comments) and asks Claude, through Netlify's built-in AI Gateway, to turn it into a list of exercises. Served at `/api/import-workout`.
- `package.json`: the one library the reader needs (Anthropic's SDK). Netlify installs it automatically.
- `firestore.rules`: the full Firebase rules (recipe app + workout app)
- `netlify.toml`: tells Netlify to publish `public/` and where the function is

To try it on a computer without the shared database, set `firebase: null` in `public/config.js` and open `public/index.html`. Everything then saves in that browser only. (Reading videos needs the website version, because it runs on Netlify.)

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
- Uses Netlify AI Gateway: no API key needed. It's paid for with the team's Netlify credits (about 15-25 credits per video read, roughly 10 cents). On the Free plan, keep an eye on **Usage** in the Netlify dashboard; if credits run out, the site is paused until the next month.
- If the app says "the AI service isn't switched on", check the team's **AI features** setting in Netlify is on, then redeploy.
- Each visitor can read at most 20 videos a minute (set in the function), so a stranger with the link can't run up a big bill quickly.
