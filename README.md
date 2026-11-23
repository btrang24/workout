# Our Workouts

A household workout tracker. It's a plain web page (no build step) that saves to the same Firebase project as the recipe app, under its own `/gyms/...` section.

- `index.html`: the app
- `exercises.js`: the 15 built-in exercises (steps, tips, mistakes, alternatives) and the animated form diagrams
- `exercises-more.js`: the extra exercises the plans use, plus cardio
- `plans.js`: the 3/4/5/6-day Push Pull Legs plans and the Cardio goal
- `photos.js` and `photos/`: exercise photos from Wikimedia Commons, with credits
- `config.js`: Firebase settings and this app's household phrase
- `firestore.rules`: the full Firebase rules (recipe app + workout app)
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: what makes it installable on a phone

To try it on a computer without the shared database, set `firebase: null` in `config.js` and open `index.html`. Everything then saves in that browser only.

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
- Leave Build command (not set), Publish directory (`.`) and Base directory (not set) as they are.

**GitHub default branch**
- On GitHub, open the repo and go to **Settings → General → Default branch**. Tap the two-arrows button, choose `main`, then **Update**.
