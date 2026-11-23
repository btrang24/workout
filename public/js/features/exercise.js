import { PHOTOS, animate, drawSvg } from "../core/data.js";
import { media, ytId } from "../core/media.js";
import { GROUP_EMOJI, exById, isNoEquip, myName } from "../core/state.js";
import { lastLog, personalBest, summary } from "../core/stats.js";
import { action, openSheet, topSheet } from "../core/ui.js";
import { $, dayLabel, esc } from "../core/util.js";

/* ---------- Exercise detail ---------- */
export function openExercise(id) {
  const ex = exById(id);
  if (!ex) return;
  const md = media(ex);
  const pb = personalBest(ex), last = lastLog(ex.id);
  const alts = (ex.alts || []).slice().sort((a, b) => isNoEquip(b) - isNoEquip(a));
  const hasDiagram = !!ex.poses;
  const bp = PHOTOS[ex.id];
  const vid = ytId(md.video);
  const yt = "https://www.youtube.com/results?search_query=" + encodeURIComponent("how to " + ex.name + " proper form");
  const list = (arr, cls) => (arr && arr.length ? `<ul class="bul ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");
  const html = `
    <div class="sbar"><button class="btn sm" data-act="close">‹ Back</button><div class="sp">${esc(ex.name)}</div>${ex.custom ? `<button class="btn sm" data-act="ex-edit" data-id="${esc(ex.id)}">Edit</button>` : `<span style="width:60px"></span>`}</div>
    <div class="hero">
      ${bp ? `<div id="hphoto" class="flip">${(bp.frames || [bp.src]).map((f, i) => `<img src="${esc(f)}" alt="${esc(ex.name)}${bp.frames && bp.frames.length > 1 ? (i ? ": finish position" : ": start position") : ""}" class="${i ? "b" : ""}">`).join("")}${bp.frames && bp.frames.length > 1 ? `<div class="phase" id="fphase">Start</div>` : ""}</div>` : ""}
      ${hasDiagram ? `<div id="hdiag" class="${bp ? "hide" : ""}">${drawSvg(ex, 0, "dg")}<div class="phase" id="phase">Start</div></div>` : ""}
      ${!bp && !hasDiagram ? (md.photo ? `<img src="${esc(md.photo)}" alt="${esc(ex.name)}">` : `<div style="font-size:70px;text-align:center;padding:30px">${ex.emoji || GROUP_EMOJI[ex.group] || "🏋️"}</div>`) : ""}
      ${bp && hasDiagram ? `<div class="seg heroseg"><button data-act="hero" data-v="photo" class="on">Photo</button><button data-act="hero" data-v="diag">Moving diagram</button></div>` : ""}
    </div>
    ${bp ? `<div class="credit">Photo: <a href="${esc(bp.page)}" target="_blank" rel="noopener">${esc(bp.credit)}</a>${bp.license ? ", " + esc(bp.license) : ""}, ${esc(bp.source || "Wikimedia Commons")}</div>` : ""}
    <div class="det">
      <h2>${esc(ex.name)}</h2>
      <div class="tags"><span class="tag">${esc(ex.group)}</span>${isNoEquip(ex) ? `<span class="tag ok">No equipment</span>` : `<span class="tag">${esc(ex.equip || "")}</span>`}<span class="tag">${ex.kind === "time" ? "Timed" : ex.kind === "reps" ? "Reps" : "Weight × reps"}</span></div>
      ${ex.muscles ? `<div class="small">Works: ${esc(ex.muscles)}</div>` : ""}
      ${pb || last ? `<div class="sec statrow" style="grid-template-columns:1fr 1fr">
        <div class="stat"><div class="k">🏆 ${esc(myName() || "Your")} best</div><div class="v">${pb ? esc(pb.label) : "–"}</div></div>
        <div class="stat"><div class="k">Last time</div><div class="v" style="font-size:15px">${last ? esc(summary(last)) : "–"}</div><div class="s">${last ? esc(dayLabel(last.date)) : ""}</div></div></div>` : ""}
      <div class="sec"><button class="btn pri block" data-act="log-ex" data-id="${esc(ex.id)}">+ Log ${esc(ex.name)}</button></div>
      ${ex.steps && ex.steps.length ? `<div class="sec"><h3>How to do it</h3><ol class="steps">${ex.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>` : ""}
      ${ex.tips && ex.tips.length ? `<div class="sec"><h3>Form tips</h3>${list(ex.tips, "good")}</div>` : ""}
      ${ex.mistakes && ex.mistakes.length ? `<div class="sec"><h3>Common mistakes</h3>${list(ex.mistakes, "bad")}</div>` : ""}
      ${alts.length ? `<div class="sec"><h3>Alternatives</h3>${alts.map((a, i) => {
        const linked = a.id && exById(a.id);
        return `<div class="alt ${linked ? "link" : ""}" ${linked ? `data-act="ex" data-id="${esc(a.id)}"` : ""}>
          <div class="an">${esc(a.name)} ${isNoEquip(a) ? `<span class="tag ok">No equipment</span>` : `<span class="tag">${esc(a.equip || "")}</span>`}${linked ? `<span class="small" style="margin-left:auto">Open ›</span>` : ""}</div>
          ${a.note ? `<div class="ad">${esc(a.note)}</div>` : ""}
          ${linked ? "" : `<div class="aa"><button class="btn sm" data-act="alt-add" data-ex="${esc(ex.id)}" data-i="${i}">+ Add to my exercises</button></div>`}</div>`;
      }).join("")}</div>` : ""}
      <div class="sec"><h3>Video & photo</h3>
        ${vid ? `<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${vid}" allowfullscreen title="Video"></iframe></div>` : md.video ? `<p><a href="${esc(md.video)}" target="_blank" rel="noopener">▶ Open saved video</a></p>` : ""}
        ${md.photo && (hasDiagram || bp) ? `<img class="myphoto" src="${esc(md.photo)}" alt="Form photo">` : ""}
        <div class="chips wrap">
          <a class="chip" href="${yt}" target="_blank" rel="noopener">▶ Find a how-to video</a>
          <button class="chip" data-act="media-video" data-id="${esc(ex.id)}">${md.video ? "Change" : "Save"} video link</button>
          <label class="chip">${md.photo ? "Change" : "Add"} photo<input type="file" accept="image/*" class="hide" data-act="media-photo" data-id="${esc(ex.id)}"></label>
          ${md.photo || md.video ? `<button class="chip" data-act="media-clear" data-id="${esc(ex.id)}">Remove photo & video</button>` : ""}
        </div>
        <div class="small">Saved videos and photos are shared with your household.</div>
      </div>
    </div>`;
  let stop = () => {}, flipTimer = null;
  const el = openSheet(html, () => { stop(); clearInterval(flipTimer); });
  if (hasDiagram) {
    const ph = $("#phase", el);
    stop = animate($(".hero svg", el), ex, (p) => { if (ph && p !== "move") ph.textContent = p === "start" ? "Start" : "Finish"; });
  }
  if (bp && bp.frames && bp.frames.length > 1) {
    // Alternate the start and finish photos so the movement is easy to follow.
    const box = $("#hphoto", el), lab = $("#fphase", el);
    flipTimer = setInterval(() => {
      const on = box.classList.toggle("on");
      lab.textContent = on ? "Finish" : "Start";
    }, 1400);
  }
}

/* ---------- buttons ---------- */
action("ex", (a, e, id) => { e.preventDefault(); openExercise(id); });
action("hero", (a, e, id) => {
  const ph = $("#hphoto", topSheet().el), dg = $("#hdiag", topSheet().el);
  ph.classList.toggle("hide", a.dataset.v !== "photo"); dg.classList.toggle("hide", a.dataset.v === "photo");
  a.parentElement.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === a));
});
