// Offline copy of the app, built for instant start with a bad gym signal.
// - Everything (app files, photos, the Firebase library) is answered from the phone's copy
//   when there is one ("cache-first"), so the app opens instantly even offline.
// - /api/... (video reader) always goes to the network.
// - Updates: sw.js itself is never cached (see netlify.toml). When it changes, the new worker
//   installs, deletes the old copy and takes over; the page then reloads once (js/main.js),
//   so a phone never mixes old and new files. So: bump VERSION whenever the app changes.
const VERSION = "v8";
const CACHE = "workouts-" + VERSION;
const SHELL = ["./", "index.html", "css/app.css", "js/main.js", "manifest.webmanifest", "icon-192.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" }))))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("workouts-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const save = (req, res) => {
  if (res && res.ok && res.type !== "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  if (same && url.pathname.startsWith("/api/")) return; // network only
  if (!same && url.hostname !== "www.gstatic.com") return;
  // Page loads (including links shared into the app with ?share_url=...) use the saved page.
  const key = req.mode === "navigate" ? "./" : req;
  e.respondWith(
    caches.match(key, { ignoreSearch: req.mode === "navigate" })
      .then((hit) => hit || fetch(req).then((res) => save(key, res)))
      .catch(() => caches.match("./"))
  );
});
