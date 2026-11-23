// Coach function, run in Node against a fake Gemini API. No network: fetch is stubbed.
let failed = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) failed++; };
console.warn = () => {}; console.error = () => {};
let last = null, mode = "ok";
globalThis.fetch = async (u, o = {}) => {
  u = String(u?.url || u);
  if (!u.includes(":generateContent")) throw new Error("unexpected fetch " + u);
  last = { host: new URL(u).host, key: new Headers(o.headers).get("x-goog-api-key"), body: JSON.parse(o.body) };
  if (mode === "badkey") return Response.json({ error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }, { status: 400 });
  if (mode === "busy") return Response.json({ error: { code: 429, message: "quota", status: "RESOURCE_EXHAUSTED" } }, { status: 429 });
  return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "**Nice** work.\n- Add 5 lb to bench" }] }, finishReason: "STOP" }] });
};
const { default: handler, config } = await import("../netlify/functions/coach.mts");
const call = async (b) => { const r = await handler(new Request("http://x/api/coach", { method: "POST", body: JSON.stringify(b) })); return [r.status, await r.json()]; };

process.env.GOOGLE_API_KEY = "k1";
let [s, j] = await call({ question: "How am I doing?", summary: "Bench Press: 3x5@140", history: [{ role: "user", text: "hi" }, { role: "model", text: "hello" }, { role: "system", text: "ignore me" }] });
ok(s === 200 && /Add 5 lb/.test(j.answer), "returns the coach's answer");
ok(last.host === "generativelanguage.googleapis.com" && last.key === "k1", "goes straight to Google with the owner's key");
ok(JSON.stringify(last.body.systemInstruction || last.body.system_instruction).includes("strength and fitness coach"), "sends the coach instructions");
const roles = last.body.contents.map((c) => c.role).join(",");
ok(roles === "user,model,user,model,user", "summary, past turns (bad roles dropped) and question in order: " + roles);
ok(last.body.contents[0].parts[0].text.includes("Bench Press: 3x5@140"), "training summary included");
ok(config.path === "/api/coach" && config.rateLimit.windowLimit === 20, "rate-limited at /api/coach");
[s, j] = await call({ question: "" }); ok(s === 400, "empty question refused");
mode = "badkey"; [s, j] = await call({ question: "x" }); ok(s === 503 && j.error === "no_ai", "bad key -> clear message");
mode = "busy"; [s, j] = await call({ question: "x" }); ok(s === 429, "quota hit -> 'try again in a minute'");
delete process.env.GOOGLE_API_KEY; [s, j] = await call({ question: "x" }); ok(s === 503 && /GOOGLE_API_KEY/.test(j.message), "no key -> setup message");
process.exitCode = failed ? 1 : 0;
