// AI coach on the Progress tab. Builds a compact text summary of this person's training
// (last 8 weeks per exercise, plan, muscles this week, cardio, body weight), sends it with the
// question to /api/coach (Gemini, owner's key) and shows the conversation. The conversation is
// kept on this phone only for this visit.
import { S, exById, index, myName } from "../core/state.js";
import { personalBest, summary } from "../core/stats.js";
import { action, rerender, slot } from "../core/ui.js";
import { $, conv, esc, isoDay, num } from "../core/util.js";
import { MUSCLES, weekSets } from "./muscles.js";
import { cardioWeek, myPlan, nextSeqIndex, planSeq } from "./plans.js";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); };

/** Plain-text summary of this person's training, small enough to send with every question. */
export function trainingSummary() {
  const out = [`Person: ${myName() || "unknown"}. Weights in ${S.unit}. Today: ${isoDay()}.`];
  const plan = myPlan();
  if (plan) { const day = planSeq(plan, S.people.find((p) => p.id === S.personId))[nextSeqIndex(plan)]; out.push(`Plan: ${plan.name}. Next workout: ${day.name} (${day.focus}).`); }
  const c = cardioWeek(); out.push(`Cardio this week: ${c.min} min in ${c.sessions} sessions (goal 150 min).`);
  const w = Object.entries(weekSets()).filter(([, v]) => v > 0).map(([k, v]) => `${MUSCLES[k]} ${num(v)}`);
  out.push(`Working sets per muscle since Monday: ${w.join(", ") || "none yet"}.`);
  const bw = S.bodyweight.filter((b) => b.personId === S.personId && b.date >= daysAgo(56)).sort((a, b) => a.date.localeCompare(b.date));
  if (bw.length) out.push(`Body weight (${S.unit}): ${bw.map((b) => `${b.date.slice(5)} ${num(conv(b.w, b.unit || "lb", S.unit))}`).join(", ")}.`);
  const from = daysAgo(56), lines = [];
  for (const [exId, logs] of index().byEx) {
    const recent = logs.filter((l) => l.date >= from);
    const ex = exById(exId);
    if (!recent.length || !ex) continue;
    const pb = personalBest(ex);
    lines.push({ n: recent.length, text: `- ${ex.name}: ${recent.slice(0, 10).reverse().map((l) => `${l.date.slice(5)} ${summary(l)}`).join("; ")}${pb ? ` (best ever ${pb.label})` : ""}` });
  }
  lines.sort((a, b) => b.n - a.n);
  out.push(lines.length ? "Exercises in the last 8 weeks (date month-day, sets × reps @ weight):\n" + lines.slice(0, 25).map((l) => l.text).join("\n") : "No exercises logged in the last 8 weeks.");
  return out.join("\n");
}

/** Escape the answer, then allow **bold** and "- " bullet lines. */
export function formatAnswer(text) {
  const lines = esc(text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split("\n");
  let html = "", inList = false;
  for (const raw of lines) {
    const m = raw.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (m) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${m[1]}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    if (raw.trim()) html += `<p>${raw}</p>`;
  }
  return html + (inList ? "</ul>" : "");
}

const C = { turns: [], draft: "", busy: false, error: "" };
try { C.turns = JSON.parse(sessionStorage.getItem("wk:coach") || "[]"); } catch {}
const keep = () => { try { sessionStorage.setItem("wk:coach", JSON.stringify(C.turns.slice(-12))); } catch {} };
const IDEAS = ["How am I progressing?", "What should I change to keep getting stronger?", "Am I training all my muscles evenly?"];

async function ask(question) {
  question = String(question || "").trim();
  if (!question || C.busy) return;
  if (location.protocol === "file:") { C.error = "The coach only works on the website version of the app."; rerender(); return; }
  C.busy = true; C.error = ""; C.draft = "";
  const history = C.turns.slice(-6);
  C.turns.push({ role: "user", text: question }); keep(); rerender();
  try {
    const r = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, summary: trainingSummary(), history }) });
    let j = null;
    try { j = await r.json(); } catch { j = { message: r.status === 404 ? "The coach isn't set up on this site yet." : "Something went wrong. Try again." }; }
    if (!r.ok) { C.error = j.message || "That didn't work. Try again."; C.turns.pop(); }
    else C.turns.push({ role: "model", text: j.answer });
  } catch { C.error = "Couldn't reach the app's server. Check your internet connection."; C.turns.pop(); }
  C.busy = false; keep(); rerender();
}

function card() {
  if (!S.personId) return "";
  return `<div class="dayh">Ask the coach</div>
    <div class="chartbox coach">
      ${C.turns.map((t) => (t.role === "user" ? `<div class="q">${esc(t.text)}</div>` : `<div class="a">${formatAnswer(t.text)}</div>`)).join("")}
      ${C.busy ? `<div class="a small">🤖 Thinking…</div>` : ""}
      ${C.error ? `<div class="note" style="margin:8px 0">${esc(C.error)}</div>` : ""}
      ${C.turns.length ? "" : `<div class="chips wrap" style="padding:0 0 8px">${IDEAS.map((q) => `<button class="chip sm" data-act="coach-idea" data-v="${esc(q)}">${esc(q)}</button>`).join("")}</div>`}
      <div class="withmic"><textarea id="coachq" rows="2" placeholder="Ask about your training…">${esc(C.draft)}</textarea><button class="btn pri" data-act="coach-ask" ${C.busy ? "disabled" : ""}>Ask</button></div>
      <div class="small" style="margin-top:6px">Answers come from Google Gemini (your key), based on a summary of your last 8 weeks.${C.turns.length ? ` <a href="#" data-act="coach-clear">Start over</a>` : ""}</div>
    </div>`;
}

document.addEventListener("input", (e) => { if (e.target.id === "coachq") C.draft = e.target.value; });
action("coach-ask", () => ask(($("#coachq") || {}).value));
action("coach-idea", (a) => ask(a.dataset.v));
action("coach-clear", (a, e) => { e.preventDefault(); C.turns = []; C.error = ""; keep(); rerender(); });
slot("progress", 40, card);
