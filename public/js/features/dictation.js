import { allEx } from "../core/state.js";
import { $, SR, toast } from "../core/util.js";

/* ============================================================
   Dictation: turn "bench press 3 sets of 8 at 135 pounds" into fields
   ============================================================ */
export const ONES = { zero: 0, oh: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
export const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export function wordsToNums(text) {
  const toks = text.split(/\s+/), out = [];
  let cur = null, total = 0;
  const flush = () => { if (cur != null) { out.push(String(total + cur)); cur = null; total = 0; } };
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i], nx = toks[i + 1] || "";
    const isA = w === "a" || w === "an";
    if (isA && !/^(hundred|minute)$/.test(nx)) { flush(); out.push(w); continue; }
    if (w in ONES) { if (cur != null && cur % 10 === 0 && cur >= 20 && ONES[w] < 10) cur += ONES[w]; else { flush(); cur = ONES[w]; } }
    else if (w in TENS) { if (cur != null && cur >= 100) cur += TENS[w]; else { flush(); cur = TENS[w]; } }
    else if (w === "hundred" && cur != null) cur *= 100;
    else if (w === "and" && cur != null && cur >= 100 && (nx in ONES || nx in TENS)) continue;
    else if (/^\d+$/.test(w) && cur != null && cur >= 100 && cur % 100 === 0 && +w < 100) cur += +w;
    else { flush(); out.push(w); }
  }
  flush();
  return out.join(" ");
}
export function parseSpoken(raw, exList) {
  let t = " " + String(raw || "").toLowerCase().replace(/[-–,.!?;]/g, " ").replace(/\s+/g, " ") + " ";
  t = " " + wordsToNums(t.trim()) + " ";
  t = t.replace(/(\d)\s*(x|×)\s*(\d)/g, "$1 x $3").replace(/(\d)(lbs?|kgs?|s|m)\b/g, "$1 $2");
  const out = {};
  // exercise: longest matching name or alias
  let best = null;
  for (const e of exList) {
    for (const n of [e.name, ...(e.aliases || [])]) {
      const key = " " + n.toLowerCase().replace(/[-–]/g, " ").replace(/\s+/g, " ").trim() + " ";
      if (key.trim() && t.includes(key) && (!best || key.length > best.key.length)) best = { e, key };
    }
  }
  if (best) {
    out.ex = best.e;
    const before = t.split(best.key)[0].trim().split(" ").pop();
    if (/^\d+$/.test(before)) out.leadNum = +before;
    t = t.replace(best.key, " | ");
  }
  if (/\b(kilos?|kilograms?|kgs?|kg)\b/.test(t)) out.unit = "kg";
  else if (/\b(pounds?|lbs?|lb)\b/.test(t)) out.unit = "lb";
  if (/\bbody ?weight\b/.test(t)) out.w = 0;
  // time
  let secs = null, m;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b(\s*and a half)?/))) secs = Math.round(+m[1] * 60) + (m[2] ? 30 : 0);
  if (/\bhalf a minute\b/.test(t)) secs = 30;
  if ((m = t.match(/(\d+)\s*(?:seconds?|secs?|s)\b/))) secs = (secs || 0) + +m[1];
  if ((m = t.match(/\b(\d+):(\d\d)\b/))) secs = +m[1] * 60 + +m[2];
  if (secs != null) out.secs = secs;
  // sets × reps
  if ((m = t.match(/(\d+)\s*sets?\s*(?:of|x|by)?\s*(\d+)\b(?!\s*(?:seconds?|secs?|minutes?|mins?|s|m|pounds?|lbs?|kilos?|kgs?)\b)/))) { out.sets = +m[1]; out.reps = +m[2]; }
  else if ((m = t.match(/\b(\d+)\s*(?:x|by)\s*(\d+)\b/))) { out.sets = +m[1]; out.reps = +m[2]; }
  if (out.sets == null && (m = t.match(/(\d+)\s*sets?\b/))) out.sets = +m[1];
  // weight
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|lb|kilos?|kilograms?|kgs?|kg)\b/))) out.w = +m[1];
  else if ((m = t.match(/(?:\bat|\bwith|@|\busing)\s*(\d+(?:\.\d+)?)/))) out.w = +m[1];
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*(?:pounds?|lbs?|lb|kilos?|kilograms?|kgs?|kg)?\s*for\s*(\d+)\b(?!\s*(?:seconds?|secs?|minutes?|mins?))/))) {
    if (out.w == null) out.w = +m[1];
    if (out.reps == null) out.reps = +m[2];
  }
  if (out.reps == null && (m = t.match(/(\d+)\s*(?:reps?|repetitions?|times)\b/))) out.reps = +m[1];
  if (out.reps == null && out.leadNum != null && out.leadNum !== out.w) out.reps = out.leadNum;
  if (out.reps == null && out.ex && out.ex.kind === "reps" && out.w == null && out.secs == null) {
    const nums = (t.match(/\b\d+\b/g) || []).map(Number).filter((n) => n !== out.sets);
    if (nums.length === 1) out.reps = nums[0];
  }
  delete out.leadNum;
  return out;
}
window.__parseSpoken = (s) => { const o = parseSpoken(s, allEx()); if (o.ex) o.ex = o.ex.id; return o; };

export let recog = null;
export function listen(btn, onText) {
  if (!SR) return;
  if (recog) { try { recog.stop(); } catch {} return; }
  try {
    recog = new SR();
    recog.lang = navigator.language || "en-US";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    btn.classList.add("live");
    recog.onresult = (e) => { const txt = e.results[0][0].transcript; onText(txt); };
    recog.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast("Microphone blocked. Allow it in your browser settings, or use the keyboard's mic.");
      else if (e.error !== "aborted" && e.error !== "no-speech") toast("Couldn't hear that. Try again.");
    };
    recog.onend = () => { btn.classList.remove("live"); recog = null; };
    recog.start();
  } catch (e) { btn.classList.remove("live"); recog = null; toast("Voice input isn't available here. Use the keyboard's mic instead."); }
}
export const micBtn = (act, extra = "") => (SR ? `<button type="button" class="mic" data-act="${act}" ${extra} aria-label="Speak">🎤</button>` : "");
