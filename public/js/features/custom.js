import { media } from "../core/media.js";
import { EQUIP, GROUPS, S, allEx, exById, isNoEquip } from "../core/state.js";
import { deleteDoc, newId, saveDoc } from "../core/store.js";
import { action, closeSheet, collection, openSheet, topSheet } from "../core/ui.js";
import { $, esc, toast } from "../core/util.js";
import { openExercise } from "./exercise.js";

/* ---------- Custom exercise editor ---------- */
export function openExEditor(id, preset) {
  const ex = id ? S.custom.find((c) => c.id === id) : null;
  const d = ex || preset || { name: "", group: "Legs", equip: "None", kind: "weight", steps: [], tips: [], mistakes: [], alts: [] };
  const lines = (a) => esc((a || []).join("\n"));
  const altLines = (d.alts || []).map((a) => a.name + (a.equip ? " (" + a.equip + ")" : "") + (a.note ? ": " + a.note : ""));
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">Cancel</button><div class="sp">${ex ? "Edit exercise" : "New exercise"}</div><button class="btn sm pri" data-act="ex-save">Save</button></div>
    <form class="ed" id="exform" onsubmit="return false">
      <div class="f"><label for="xn">Name</label><input id="xn" value="${esc(d.name)}" placeholder="e.g. Kettlebell swing" autocomplete="off"></div>
      <div class="row2">
        <div class="f"><label for="xg">Muscle group</label><select id="xg">${GROUPS.map((g) => `<option ${d.group === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
        <div class="f"><label for="xe">Equipment</label><select id="xe">${EQUIP.map((g) => `<option ${d.equip === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
      </div>
      <div class="f"><span class="lbl">How do you track it?</span><div class="seg" id="xk">${[["weight", "Weight × reps"], ["reps", "Reps"], ["time", "Time"]].map(([k, n]) => `<button type="button" data-act="xk" data-v="${k}" class="${d.kind === k ? "on" : ""}">${n}</button>`).join("")}</div></div>
      <div class="f"><label>Photo showing good form</label><img id="xphoto" class="photo-prev ${d.photo ? "" : "hide"}" src="${esc(d.photo || "")}" alt=""><input type="file" accept="image/*" id="xpf"><div class="hint">Optional. Shrunk automatically before saving.</div></div>
      <div class="f"><label for="xv">Video link</label><input id="xv" value="${esc(d.video || "")}" placeholder="YouTube or any link" inputmode="url"></div>
      <div class="f"><label for="xs">How to do it (one step per line)</label><textarea id="xs">${lines(d.steps)}</textarea></div>
      <div class="f"><label for="xt">Form tips (one per line)</label><textarea id="xt" style="min-height:70px">${lines(d.tips)}</textarea></div>
      <div class="f"><label for="xm">Common mistakes (one per line)</label><textarea id="xm" style="min-height:70px">${lines(d.mistakes)}</textarea></div>
      <div class="f"><label for="xbw">No-equipment alternative</label><input id="xbw" value="${esc((d.alts || []).find(isNoEquip)?.name || "")}" placeholder="e.g. Bodyweight squat"><div class="hint">What to do when you don't have the equipment.</div></div>
      <div class="f"><label for="xa">Other alternatives (one per line)</label><textarea id="xa" style="min-height:70px" placeholder="Name (equipment): short note">${esc(altLines.filter((l, i) => !isNoEquip(d.alts[i])).join("\n"))}</textarea></div>
      ${ex ? `<button type="button" class="btn dan block" data-act="ex-del" data-id="${esc(ex.id)}">Delete exercise</button>` : ""}
    </form>`;
  const el = openSheet(html);
  el._ex = { id: ex ? ex.id : null, kind: d.kind, photo: d.photo || "", bwNote: (d.alts || []).find(isNoEquip)?.note || "" };
  $("#xpf", el).addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const url = await shrinkImage(f); el._ex.photo = url; const im = $("#xphoto", el); im.src = url; im.classList.remove("hide"); }
    catch { toast("Couldn't read that photo."); }
  });
}
export function saveExercise() {
  const el = topSheet().el, st = el._ex;
  const name = $("#xn", el).value.trim();
  if (!name) { toast("Give it a name."); return; }
  const split = (v) => v.split("\n").map((s) => s.trim()).filter(Boolean);
  const alts = split($("#xa", el).value).map((line) => {
    const m = line.match(/^(.*?)(?:\s*\(([^)]*)\))?\s*(?::\s*(.*))?$/);
    return { name: (m && m[1]) || line, equip: (m && m[2]) || "", note: (m && m[3]) || "" };
  });
  const bw = $("#xbw", el).value.trim();
  if (bw) alts.unshift({ name: bw, equip: "None", note: st.bwNote || "" });
  for (const a of alts) { const hit = allEx().find((e) => e.name.toLowerCase() === a.name.toLowerCase()); if (hit && hit.id !== st.id) { a.id = hit.id; a.equip = a.equip || hit.equip; } }
  const id = saveDoc("exercises", {
    id: st.id || "c_" + newId(), name, group: $("#xg", el).value, equip: $("#xe", el).value, kind: st.kind,
    photo: st.photo || "", video: $("#xv", el).value.trim(), muscles: "",
    steps: split($("#xs", el).value), tips: split($("#xt", el).value), mistakes: split($("#xm", el).value), alts,
    aliases: [name.toLowerCase()],
  });
  closeSheet();
  if (topSheet()) closeSheet();
  toast("Saved " + name);
  setTimeout(() => openExercise(id), 120);
}
export async function shrinkImage(file, max = 900) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } finally { URL.revokeObjectURL(url); }
}
export function saveMedia(ex, patch) {
  if (ex.custom) {
    const c = S.custom.find((x) => x.id === ex.id);
    saveDoc("exercises", { ...c, ...patch });
  } else {
    saveDoc("media", { ...(S.media[ex.id] || {}), ...patch, id: ex.id });
  }
}

document.addEventListener("change", async (e) => {
  const a = e.target.closest("input[data-act='media-photo']");
  if (!a || !a.files[0]) return;
  const ex = exById(a.dataset.id);
  try {
    const url = await shrinkImage(a.files[0]);
    saveMedia(ex, { photo: url });
    toast("Photo saved");
    setTimeout(() => { closeSheet(); openExercise(ex.id); }, 100);
  } catch { toast("Couldn't read that photo."); }
});

/* ---------- buttons ---------- */
action("ex-new", (a, e, id) => { openExEditor(null); });
action("ex-edit", (a, e, id) => { openExEditor(id); });
action("ex-save", (a, e, id) => { saveExercise(); });
action("ex-del", (a, e, id) => {
  if (confirm("Delete this exercise? Logged workouts for it stay in your history.")) { deleteDoc("exercises", id); closeSheet(); closeSheet(); }
});
action("xk", (a, e, id) => {
  topSheet().el._ex.kind = a.dataset.v; a.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === a));
});
action("alt-add", (a, e, id) => {
  const ex = exById(a.dataset.ex), alt = ex.alts[+a.dataset.i];
  const dup = S.custom.find((c) => c.name.toLowerCase() === alt.name.toLowerCase());
  if (dup) { openExercise(dup.id); return; }
  const kind = /plank|hold|hang|isometric|wall sit|jump rope/i.test(alt.name + " " + alt.note) ? "time" : isNoEquip(alt) ? "reps" : ex.kind;
  openExEditor(null, {
    name: alt.name, group: ex.group, equip: EQUIP.includes(alt.equip) ? alt.equip : isNoEquip(alt) ? "None" : "Other", kind,
    steps: alt.note ? [alt.note] : [], tips: [], mistakes: [],
    alts: [{ id: ex.id, name: ex.name, equip: ex.equip, note: "The original exercise." }],
  });
});
action("media-video", (a, e, id) => {
  const ex = exById(id), cur = media(ex).video || "";
  const v = prompt("Paste a video link (YouTube works best):", cur);
  if (v != null) { saveMedia(ex, { video: v.trim() }); setTimeout(() => { closeSheet(); openExercise(id); }, 100); }
});
action("media-clear", (a, e, id) => {
  const ex = exById(id);
  if (confirm("Remove the saved photo and video for this exercise?")) { saveMedia(ex, { photo: "", video: "" }); setTimeout(() => { closeSheet(); openExercise(id); }, 100); }
});

collection("exercises", (arr) => { S.custom = arr.sort((a, b) => a.name.localeCompare(b.name)); });
collection("media", (arr) => { S.media = Object.fromEntries(arr.map((m) => [m.id, m])); });
