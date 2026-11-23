// Video-import function, run in Node against a fake Gemini API and fake video pages.
// No network: fetch is stubbed. Run with: npm test
const reqs = []; let mode = {};
const out = { found: true, name: "Upper body dumbbell", focus: "Chest, arms", notes: "3 rounds.",
  exercises: [{ name: "DB bench", libraryId: "dbbench", group: "Chest", kind: "weight", sets: 3, reps: "10", note: "" },
              { name: "Bear crawl", libraryId: "nope", group: "Full body", kind: "time", sets: 3, reps: "30 sec", note: "" }] };
const pr = { videoDetails: { title: "10 MIN DUMBBELL UPPER BODY", author: "Coach X", shortDescription: "1. DB bench 3x10\n2. Bear crawl 30s" } };
const realFetch = globalThis.fetch;
console.warn = () => {}; console.error = () => {};
globalThis.fetch = async (u, o = {}) => {
  u = String(u?.url || u);
  if (u.startsWith("https://www.youtube.com/watch")) return new Response(`<script>var ytInitialPlayerResponse = ${JSON.stringify(pr)};var meta = 1;</script>`);
  if (u.includes("instagram.com")) return new Response("blocked", { status: 429 });
  if (u.includes(":generateContent")) {
    const body = JSON.parse(o.body); const h = new Headers(o.headers);
    const model = u.match(/models\/([^:]+):/)[1];
    const video = JSON.stringify(body).includes("fileData");
    reqs.push({ host: new URL(u).host, model, video, key: h.get("x-goog-api-key"), cfg: body.generationConfig });
    if (mode.badKey) return Response.json({ error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }, { status: 400 });
    if (mode.no404 === model) return Response.json({ error: { code: 404, message: "model not found", status: "NOT_FOUND" } }, { status: 404 });
    if (mode.videoFail && video) return Response.json({ error: { code: 500, message: "boom", status: "INTERNAL" } }, { status: 500 });
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(out) }] }, finishReason: "STOP" }] });
  }
  return realFetch(u, o);
};
const { default: handler } = await import("../netlify/functions/import-workout.mts");
const call = async (b) => { const r = await handler(new Request("http://x/api/import-workout", { method: "POST", body: JSON.stringify(b) })); return [r.status, await r.json()]; };
const lib = [{ id: "dbbench", name: "Dumbbell Bench Press", group: "Chest", kind: "weight" }];
let failed = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failed++; };

process.env.GOOGLE_API_KEY = "test-key";
process.env.GOOGLE_GEMINI_BASE_URL = "https://ai-gateway.netlify.example/gemini"; // what Netlify would inject
let [s, j] = await call({ url: "https://youtu.be/abcdefghijk", library: lib }); let q = reqs.at(-1);
ok(s === 200 && j.source.watchedVideo, "YouTube: Gemini watches the video (" + s + ")");
ok(q.host === "generativelanguage.googleapis.com", "goes straight to Google, not the Netlify gateway: " + q.host);
ok(q.key === "test-key" && q.model === "gemini-flash-latest", "uses owner key and model " + q.model);
ok(q.cfg.responseMimeType === "application/json" && q.cfg.responseJsonSchema && q.cfg.mediaResolution === "MEDIA_RESOLUTION_LOW", "asks for JSON with schema, low video resolution");
ok(JSON.stringify(j.routine.exercises.map((e) => e.libraryId)) === '["dbbench",""]', "unknown library ids cleared");

mode = { videoFail: true }; reqs.length = 0; [s, j] = await call({ url: "https://youtu.be/abcdefghijk", library: lib });
ok(s === 200 && !j.source.watchedVideo && reqs.length === 2 && !reqs[1].video, "video fails -> text-only fallback works");

mode = { no404: "gemini-flash-latest" }; [s, j] = await call({ text: "pushups 3x15", library: lib });
ok(s === 200 && j.model === "gemini-2.5-flash", "unknown model name -> fallback model " + j.model);
process.env.GEMINI_MODEL = "gemini-custom"; mode = {}; [s, j] = await call({ text: "pushups 3x15" }); ok(j.model === "gemini-custom", "GEMINI_MODEL setting respected"); delete process.env.GEMINI_MODEL;

mode = { badKey: true }; [s, j] = await call({ text: "pushups" }); ok(s === 503 && j.error === "no_ai", "bad key -> clear message: " + j.message);
mode = {}; [s, j] = await call({ url: "https://www.instagram.com/reel/x/" }); ok(s === 422 && j.error === "couldnt_read", "Instagram blocked -> paste-caption message");
[s, j] = await call({ url: "https://www.instagram.com/reel/x/", text: "squats 3x10" }); ok(s === 200, "Instagram + pasted caption works");
delete process.env.GOOGLE_API_KEY; process.env.GEMINI_API_KEY = "k2"; [s, j] = await call({ text: "x y z" }); ok(s === 200 && reqs.at(-1).key === "k2", "GEMINI_API_KEY also accepted");
delete process.env.GEMINI_API_KEY; [s, j] = await call({ text: "x" }); ok(s === 503 && /GOOGLE_API_KEY/.test(j.message), "no key -> setup message");
process.exitCode = failed ? 1 : 0;
