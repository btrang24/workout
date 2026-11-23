// AI coach: answers questions about your training, using Google Gemini with the owner's key.
// The phone sends a compact summary of the person's training (not raw logs) plus the question
// and the last few turns of the conversation. Served at /api/coach.
import type { Config } from "@netlify/functions";
import { errorReply, generate, geminiKey, json, NO_KEY } from "./_lib/gemini.mts";

const SYSTEM = `You are a friendly, practical strength and fitness coach inside a household workout-tracking app.
Answer the person's question using their training summary. Be specific: name exercises, weights, sets and dates from the summary.
Write in plain English for a non-expert, short (under 180 words), with a few bullet points when that helps.
Base advice on the data; if the data doesn't show something, say so instead of guessing.
You're not a doctor: for pain, injury or medical questions, suggest seeing a professional.`;

export default async (req: Request) => {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request", message: "Send JSON." }, 400); }
  const question = String(body.question || "").trim().slice(0, 1500);
  const summary = String(body.summary || "").slice(0, 20000);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter((t: any) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
    .map((t: any) => ({ role: t.role, parts: [{ text: t.text.slice(0, 3000) }] }));
  if (!question) return json({ error: "bad_request", message: "Ask a question first." }, 400);
  if (!geminiKey()) return NO_KEY("The coach");

  const contents = [
    { role: "user", parts: [{ text: `My training summary:\n<summary>\n${summary || "(no workouts logged yet)"}\n</summary>` }] },
    { role: "model", parts: [{ text: "Thanks, I've read your training summary. What would you like to know?" }] },
    ...history,
    { role: "user", parts: [{ text: question }] },
  ];
  let res;
  try { res = await generate(contents, { systemInstruction: SYSTEM, httpOptions: { timeout: 40000 } }); }
  catch (e) { return errorReply(e, "The coach couldn't answer right now. Try again in a moment."); }
  const reason = res.r.candidates?.[0]?.finishReason;
  const answer = (res.r.text || "").trim();
  if (!answer || reason === "SAFETY" || res.r.promptFeedback?.blockReason) return json({ error: "refused", message: "The coach couldn't answer that one. Try asking it a different way." }, 422);
  return json({ answer, model: res.model });
};

export const config: Config = {
  path: "/api/coach",
  method: "POST",
  // Public-by-link site: cap how often the coach can be asked.
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
