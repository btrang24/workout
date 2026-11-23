// Shared Gemini access for the Netlify functions (video reader, coach).
// Uses the owner's own key (GOOGLE_API_KEY or GEMINI_API_KEY) and always talks to Google
// directly, so Netlify AI Gateway credits are never used. GEMINI_MODEL picks the model.
// (Not a function itself: Netlify only treats files directly in netlify/functions as functions.)
import { GoogleGenAI, ApiError } from "@google/genai";

const GOOGLE_URL = "https://generativelanguage.googleapis.com/";
const FALLBACK_MODEL = "gemini-2.5-flash"; // used only if the main model name isn't available
const env = (k: string) => (process.env[k] || "").trim();

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const geminiKey = () => env("GOOGLE_API_KEY") || env("GEMINI_API_KEY");
export const NO_KEY = (what: string) => json({ error: "no_ai", message: `${what} isn't set up yet: add your Gemini API key in Netlify (environment variable GOOGLE_API_KEY), then redeploy.` }, 503);

/** generateContent with the main model, falling back to FALLBACK_MODEL if that name doesn't exist. */
export async function generate(contents: any, config: any): Promise<{ r: any; model: string }> {
  const ai = new GoogleGenAI({ apiKey: geminiKey(), httpOptions: { baseUrl: GOOGLE_URL } });
  const models = [...new Set([env("GEMINI_MODEL") || "gemini-flash-latest", FALLBACK_MODEL])];
  let lastErr: unknown = null;
  for (const model of models) {
    try {
      return { r: await ai.models.generateContent({ model, contents, config }), model };
    } catch (e) {
      lastErr = e;
      if (e instanceof ApiError && e.status === 404) continue;
      throw e;
    }
  }
  throw lastErr;
}

/** A plain-English error reply for a failed Gemini call. */
export function errorReply(e: unknown, fallback: string) {
  console.error("Gemini call failed", e);
  const st = e instanceof ApiError ? e.status : 0;
  if (st === 429) return json({ error: "busy", message: "Your Gemini key has hit its limit for now. Try again in a minute." }, 429);
  if (st === 400 || st === 401 || st === 403) return json({ error: "no_ai", message: "Google didn't accept the Gemini API key. Check GOOGLE_API_KEY in Netlify." }, 503);
  return json({ error: "ai_failed", message: fallback }, 502);
}
