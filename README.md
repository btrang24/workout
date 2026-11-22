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
