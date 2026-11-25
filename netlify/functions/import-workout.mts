// Reads a workout video/post link (YouTube, Instagram, TikTok, Reddit, or any page),
// gathers its title, caption/description and (for YouTube) spoken transcript,
// and asks Google Gemini to turn it into a workout routine the app can save.
// For YouTube links Gemini also watches the video itself.
//
// Uses the owner's own Gemini API key (Netlify environment variable GOOGLE_API_KEY,
// or GEMINI_API_KEY), so it's billed to their Google account and never uses Netlify
// AI Gateway credits. Served at /api/import-workout.
import { MediaResolution } from "@google/genai";
import { errorReply, generate, geminiKey, json, NO_KEY } from "./_lib/gemini.mts";
import type { Config } from "@netlify/functions";

const MAX_SOURCE = 30000; // characters of video text sent to the AI
const UA = "Mozilla/5.0 (compatible; household-workout-app/1.0)";
const GROUPS = ["Legs", "Chest", "Back", "Shoulders", "Arms", "Core", "Cardio", "Full body"];

type LibEx = { id: string; name: string; group?: string; kind?: string };
type Source = { kind: string; title: string; author: string; parts: string[]; gotTranscript: boolean };


export default async (req: Request) => {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request", message: "Send JSON." }, 400); }
  const url = String(body.url || "").trim();
  const pasted = String(body.text || "").trim().slice(0, 20000);
  const library: LibEx[] = Array.isArray(body.library) ? body.library.slice(0, 400) : [];
  if (!url && !pasted) return json({ error: "bad_request", message: "Paste a link or some text." }, 400);
  if (url && !/^https?:\/\//i.test(url)) return json({ error: "bad_request", message: "That doesn't look like a link." }, 400);

  if (!geminiKey()) return NO_KEY("Video reading");

  // 1. Read what we can from the link.
  let src: Source = { kind: "link", title: "", author: "", parts: [], gotTranscript: false };
  if (url) {
    try { src = await readSource(url); } catch (e) { console.warn("read failed", url, e); }
  }
  const yt = url ? ytId(url) : null;
  const sourceText = [src.title && `Title: ${src.title}`, src.author && `Posted by: ${src.author}`, ...src.parts]
    .filter(Boolean).join("\n\n").slice(0, MAX_SOURCE);
  // Couldn't read the page ourselves (Reddit often blocks servers): let Gemini read it.
  const readByGemini = !yt && !!url && sourceText.replace(/\s+/g, "").length < 40 && !pasted;

  // 2. Ask Gemini to turn it into a routine.
  const libList = library.map((e) => `${e.id} | ${e.name} | ${e.group || ""} | ${e.kind || ""}`).join("\n");
  const prompt = (withVideo: boolean) => `Someone saved a workout video or post and wants to do this workout. Turn it into a routine for their workout-tracking app.
${withVideo ? "\nThe video itself is attached: watch it, including exercises that are only shown on screen and never said.\n" : ""}
Here is the text we could read from it (title, caption/description, transcript, comments). Transcripts are auto-generated and can contain mistakes.
<source url="${escapeAttr(url)}">
${sourceText || "(no text could be read from the link)"}
</source>
${pasted ? `\nThe person also pasted this text about it:\n<pasted>\n${pasted}\n</pasted>\n` : ""}
Their app has this exercise library (id | name | muscle group | how it's tracked):
<library>
${libList}
</library>

Instructions:
- List the exercises in the order they're done, with sets and reps (or time) as the video gives them. If the video doesn't say, suggest sensible numbers and say so in that exercise's note.
- For each exercise, set libraryId to the matching library id when it's the same movement (a small variation is fine, e.g. "DB bench" = Dumbbell Bench Press). Use "" if nothing in the library matches; then give a clear exercise name.
- kind: "weight" for weight × reps, "reps" for bodyweight reps, "time" for timed holds or cardio.
- reps is short text: "10", "8-12", "30 sec", "1 min", "max", "10 each side".
- notes: one or two short sentences on how to run the workout (rounds, rest times, circuits, warm-up), or "".
- name: a short title for the routine (not the creator's clickbait title). focus: muscles/goal in a few words.
- Timed workouts (Tabata, EMOM, intervals, circuits like "30 sec on / 30 sec off"): set timer.timed to true and fill timer.work (seconds of work per exercise), timer.rest (seconds of rest after each exercise, 0 if none), timer.rounds (how many times through the list) and timer.roundRest (extra rest between rounds, 0 if none). For each exercise set seconds to its own work time if it differs from timer.work, else 0. Tabata means 20 sec work / 10 sec rest, 8 rounds, unless the post says otherwise. For timed workouts set sets to the number of rounds and reps to the work time, e.g. "30 sec".
- Not a timed workout: set timer.timed to false and the other timer numbers to 0, and seconds to 0.
- If the source isn't actually a workout or you can't tell what the exercises are, set found to false and leave exercises empty. Don't invent a workout that isn't there.`;

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["found", "name", "focus", "notes", "timer", "exercises"],
    properties: {
      found: { type: "boolean" },
      timer: {
        type: "object",
        additionalProperties: false,
        required: ["timed", "work", "rest", "rounds", "roundRest"],
        properties: { timed: { type: "boolean" }, work: { type: "integer" }, rest: { type: "integer" }, rounds: { type: "integer" }, roundRest: { type: "integer" } },
      },
      name: { type: "string" },
      focus: { type: "string" },
      notes: { type: "string" },
      exercises: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "libraryId", "group", "kind", "sets", "reps", "seconds", "note"],
          properties: {
            name: { type: "string" },
            libraryId: { type: "string" },
            group: { type: "string", enum: GROUPS },
            kind: { type: "string", enum: ["weight", "reps", "time"] },
            sets: { type: "integer" },
            reps: { type: "string" },
            seconds: { type: "integer" },
            note: { type: "string" },
          },
        },
      },
    },
  };

  const ask = (withVideo: boolean, timeout: number) => {
    const parts: any[] = [];
    if (withVideo) parts.push({ fileData: { fileUri: `https://www.youtube.com/watch?v=${yt}` } });
    parts.push({ text: prompt(withVideo) });
    return generate([{ role: "user", parts }], {
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      ...(withVideo ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW } : {}),
      httpOptions: { timeout },
    });
  };

  // Gemini reads the page itself (URL context tool). Tools can't be combined with a JSON
  // schema, so the shape is described in the prompt and the JSON is pulled out of the reply.
  const askWeb = () => generate([{ role: "user", parts: [{ text: prompt(false).replace("(no text could be read from the link)", `(we couldn't open the page: read it yourself at ${url}, including the post text and any workout the poster wrote in the comments)`)
    + `\n\nReply with only a JSON object (no other text) that matches this JSON schema:\n${JSON.stringify(schema)}` }] }],
    { tools: [{ urlContext: {} }], httpOptions: { timeout: 40000 } });

  let res: { r: any; model: string } | null = null;
  let usedVideo = false, lastErr: unknown = null;
  if (readByGemini) {
    try { res = await askWeb(); } catch (e) { lastErr = e; }
    const status = res?.r.candidates?.[0]?.urlContextMetadata?.urlMetadata?.[0]?.urlRetrievalStatus;
    if (res && status && !/SUCCESS/.test(status)) {
      return json({ error: "couldnt_read", message: "Couldn't read anything from that link (the site blocked it). Paste the post's text or the list of exercises and try again.", source: { kind: src.kind, title: src.title } }, 422);
    }
  }
  if (yt) {
    try { res = await ask(true, 38000); usedVideo = true; } catch (e) { lastErr = e; console.warn("video read failed, using text only", e); }
  }
  if (!res && !readByGemini && (sourceText.length > 40 || pasted)) {
    try { res = await ask(false, 15000); } catch (e) { lastErr = e; }
  }
  if (!res) return errorReply(lastErr, "The AI couldn't read this one. Try again, or paste the caption.");
  const reason = res.r.candidates?.[0]?.finishReason;
  if (reason === "SAFETY" || res.r.promptFeedback?.blockReason) return json({ error: "refused", message: "The AI wouldn't process this link. Try pasting the exercise list instead." }, 422);
  if (reason === "MAX_TOKENS") return json({ error: "ai_failed", message: "That workout was too long to read in one go. Paste just the exercise list." }, 422);

  let routine: any;
  try { routine = parseJson(res.r.text || ""); } catch { return json({ error: "ai_failed", message: "The AI's answer came back garbled. Try again." }, 502); }
  if (readByGemini && !routine.found) {
    return json({ error: "couldnt_read", message: "Couldn't find a workout on that page. Paste the post's text or the list of exercises and try again.", source: { kind: src.kind, title: src.title } }, 422);
  }
  routine.timer = routine.timer && routine.timer.timed ? routine.timer : { timed: false, work: 0, rest: 0, rounds: 0, roundRest: 0 };

  const ids = new Set(library.map((e) => e.id));
  routine.exercises = (routine.exercises || []).map((x: any) => ({ ...x, libraryId: ids.has(x.libraryId) ? x.libraryId : "" }));
  return json({
    routine,
    source: { kind: src.kind, title: src.title, author: src.author, gotTranscript: src.gotTranscript, watchedVideo: usedVideo, readByGemini, readSomething: sourceText.length > 40 || readByGemini },
    model: res.model,
  });
};

export const config: Config = {
  path: "/api/import-workout",
  method: "POST",
  // The site is public-by-link, so cap how often the AI can be called.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};

/* ---------------- reading the link ---------------- */

function escapeAttr(s: string) { return s.replace(/[<>"]/g, ""); }
/** JSON from a model reply that may wrap it in ```json fences or add a sentence around it. */
function parseJson(t: string) {
  try { return JSON.parse(t); } catch {}
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON");
  return JSON.parse(m[0]);
}

async function get(url: string, accept = "text/html,application/json;q=0.9,*/*;q=0.8", timeout = 12000) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept, "accept-language": "en-US,en;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r;
}

function ytId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function readSource(url: string): Promise<Source> {
  const host = new URL(url).hostname.replace(/^www\.|^m\.|^old\./, "");
  const yt = ytId(url);
  if (yt) return readYouTube(yt);
  if (/(^|\.)reddit\.com$|^redd\.it$/.test(host)) return readReddit(url);
  if (/(^|\.)tiktok\.com$/.test(host)) return readTikTok(url);
  const s = await readPage(url);
  s.kind = /instagram\.com$/.test(host) ? "instagram" : "link";
  return s;
}

function between(html: string, start: string, endRe: RegExp) {
  const i = html.indexOf(start);
  if (i < 0) return null;
  const rest = html.slice(i + start.length);
  const m = rest.match(endRe);
  return m && m.index != null ? rest.slice(0, m.index) : null;
}
const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

async function readYouTube(id: string): Promise<Source> {
  const src: Source = { kind: "youtube", title: "", author: "", parts: [], gotTranscript: false };
  try {
    const html = await (await get(`https://www.youtube.com/watch?v=${id}&hl=en`)).text();
    const raw = between(html, "ytInitialPlayerResponse = ", /;\s*(?:var meta|<\/script>)/);
    if (raw) {
      const pr = JSON.parse(raw);
      const vd = pr.videoDetails || {};
      src.title = vd.title || "";
      src.author = vd.author || "";
      if (vd.shortDescription) src.parts.push("Description:\n" + vd.shortDescription);
      const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const track = tracks.find((t: any) => /^en/.test(t.languageCode) && t.kind !== "asr") || tracks.find((t: any) => /^en/.test(t.languageCode)) || tracks[0];
      if (track?.baseUrl) {
        try {
          const tj = await (await get(track.baseUrl + "&fmt=json3", "application/json")).json();
          const words = (tj.events || []).map((ev: any) => (ev.segs || []).map((s: any) => s.utf8).join("")).join(" ").replace(/\s+/g, " ").trim();
          if (words) { src.parts.push("Transcript (what's said in the video):\n" + words); src.gotTranscript = true; }
        } catch (e) { console.warn("transcript failed", e); }
      }
    }
  } catch (e) { console.warn("youtube page failed", e); }
  if (!src.title) {
    try {
      const o = await (await get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent("https://www.youtube.com/watch?v=" + id)}`, "application/json")).json();
      src.title = o.title || ""; src.author = o.author_name || "";
    } catch { /* nothing more to try */ }
  }
  return src;
}

async function readReddit(url: string): Promise<Source> {
  const src: Source = { kind: "reddit", title: "", author: "", parts: [], gotTranscript: false };
  const u = new URL(url);
  // Short share links (/r/x/s/abc or redd.it) redirect to the real post first.
  let path = u.pathname;
  if (/\/s\/|^redd\.it$/.test(u.hostname + path)) {
    const r = await get(url, undefined, 6000);
    path = new URL(r.url).pathname;
  }
  const data = await (await get(`https://www.reddit.com${path.replace(/\/$/, "")}.json?limit=40&sort=top`, "application/json", 6000)).json();
  const post = data?.[0]?.data?.children?.[0]?.data || {};
  src.title = post.title || "";
  src.author = post.author ? "u/" + post.author : "";
  if (post.selftext) src.parts.push("Post:\n" + post.selftext);
  if (post.url_overridden_by_dest) src.parts.push("Linked: " + post.url_overridden_by_dest);
  const comments = (data?.[1]?.data?.children || []).map((c: any) => c.data).filter((c: any) => c && c.body);
  const op = comments.filter((c: any) => c.author === post.author);
  const top = comments.filter((c: any) => c.author !== post.author).sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 6);
  if (op.length) src.parts.push("Comments by the poster:\n" + op.map((c: any) => c.body).join("\n---\n"));
  if (top.length) src.parts.push("Top comments:\n" + top.map((c: any) => c.body).join("\n---\n"));
  return src;
}

async function readTikTok(url: string): Promise<Source> {
  const src: Source = { kind: "tiktok", title: "", author: "", parts: [], gotTranscript: false };
  try {
    const o = await (await get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, "application/json")).json();
    src.author = o.author_name || "";
    if (o.title) src.parts.push("Caption:\n" + o.title);
  } catch (e) { console.warn("tiktok oembed failed", e); }
  if (!src.parts.length) {
    const page = await readPage(url);
    return { ...page, kind: "tiktok" };
  }
  return src;
}

async function readPage(url: string): Promise<Source> {
  const src: Source = { kind: "link", title: "", author: "", parts: [], gotTranscript: false };
  const html = (await (await get(url)).text()).slice(0, 2_000_000);
  const meta = (name: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
    const tag = html.match(re)?.[0];
    const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    return c ? decode(c).trim() : "";
  };
  src.title = meta("og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || "").trim();
  const desc = meta("og:description") || meta("description") || meta("twitter:description");
  if (desc) src.parts.push("Caption / description:\n" + desc);
  // Article-style pages: include the visible text too.
  const visible = decode(html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(?:br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  if (visible.length > 200) src.parts.push("Page text:\n" + visible.slice(0, 15000));
  return src;
}
