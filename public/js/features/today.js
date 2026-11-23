import { exById, myLogs, myName } from "../core/state.js";
import { action, render, slots, view } from "../core/ui.js";
import { $, SR, esc, isoDay } from "../core/util.js";
import { listen, micBtn } from "./dictation.js";
import { logCard } from "./history.js";
import { openLog } from "./log.js";

export function viewToday() {
  const today = isoDay();
  const mine = myLogs().filter((l) => l.date === today).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const recent = [];
  for (const l of myLogs().sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    if (!recent.includes(l.exId) && exById(l.exId)) recent.push(l.exId);
    if (recent.length >= 8) break;
  }
  return `${slots("today")}
    <div class="dayh">Quick log</div>
    <div class="quick" style="margin-top:0">
      <div class="q1"><input id="quick" placeholder="e.g. bench press 3 sets of 8 at 135" enterkeyhint="go" autocomplete="off">${micBtn("quick-mic")}<button class="btn pri" data-act="quick-go">Go</button></div>
      <div class="hint">${SR ? "Tap 🎤 and say what you did, or type it." : "Type what you did, or tap the keyboard's 🎤 to dictate."} You'll check it before saving.</div>
    </div>
    ${recent.length ? `<div class="dayh">Log again</div><div class="chips" style="padding-top:0">${recent.map((id) => `<button class="chip" data-act="log-ex" data-id="${esc(id)}">${esc(exById(id).name)}</button>`).join("")}</div>` : ""}
    <div class="dayh">${esc(myName() ? myName() + "'s workout today" : "Today's workout")}</div>
    ${mine.length ? mine.map((l) => logCard(l)).join("") : `<div class="empty"><div class="big">💪</div>Nothing logged yet today.<br>Tap <b>+ Log</b> or say it above.</div>`}`;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "quick") { e.preventDefault(); $("[data-act='quick-go']").click(); }
});

/* ---------- buttons ---------- */
action("quick-mic", (a, e, id) => { listen(a, (txt) => { $("#quick").value = txt; openLog({ spoken: txt }); }); });
action("quick-go", (a, e, id) => { const v = $("#quick").value.trim(); if (v) openLog({ spoken: v }); else openLog({}); });

view("today", { order: 2, title: "Today", icon: "📝", label: "Today", render: viewToday });
