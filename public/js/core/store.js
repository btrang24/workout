// Data layer: Firebase (shared) or localStorage (this device only).
import { toast } from "./util.js";

/* ============================================================
   Data layer: Firebase (shared) or localStorage (this device only)
   Everything lives under /gyms/{householdId}/...
   ============================================================ */
export const CFG = window.APP_CONFIG || {};
export const HID = (CFG.householdId || "household").trim();
export const ROOT = "gyms";
document.title = CFG.appName || "Our Workouts";

export const store = { mode: "local" };
export let fb = null;

export async function initStore() {
  if (CFG.firebase && CFG.firebase.projectId) {
    try {
      const base = "https://www.gstatic.com/firebasejs/10.12.2/";
      const [{ initializeApp }, fs] = await Promise.all([
        import(base + "firebase-app.js"),
        import(base + "firebase-firestore.js"),
      ]);
      const app = initializeApp(CFG.firebase);
      const db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
      fb = { db, fs };
      store.mode = "cloud";
    } catch (e) {
      console.warn("Firebase failed, using local mode", e);
      store.mode = "local";
    }
  }
}
export const lsKey = (coll) => "wk:" + HID + ":" + coll;
export function localLoad(coll) { try { return JSON.parse(localStorage.getItem(lsKey(coll)) || "[]"); } catch { return []; } }
export function localSave(coll, arr) {
  try { localStorage.setItem(lsKey(coll), JSON.stringify(arr)); }
  catch { toast("This device is out of storage space."); }
}
export function subscribe(coll, cb) {
  if (store.mode === "cloud") {
    const { db, fs } = fb;
    return fs.onSnapshot(fs.collection(db, ROOT, HID, coll),
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      (err) => { console.error(err); toast("Can't reach the shared database"); cb([]); });
  }
  const fire = () => cb(localLoad(coll));
  window.addEventListener("wk-local-" + coll, fire);
  fire();
}
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export function saveDoc(coll, obj) {
  const id = obj.id || newId();
  const data = { ...obj, id, updatedAt: Date.now() };
  for (const k in data) if (data[k] === undefined) delete data[k];
  if (store.mode === "cloud") {
    const { db, fs } = fb;
    fs.setDoc(fs.doc(db, ROOT, HID, coll, id), data).catch((e) => { console.error(e); toast("Couldn't save. Check your connection."); });
  } else {
    const arr = localLoad(coll);
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr[i] = data; else arr.push(data);
    localSave(coll, arr);
    window.dispatchEvent(new Event("wk-local-" + coll));
  }
  return id;
}
/** Save many documents at once (imports): one write locally, batches of 400 in Firebase. */
export async function saveMany(coll, objs) {
  const docs = objs.map((o) => { const d = { ...o, id: o.id || newId(), updatedAt: Date.now() }; for (const k in d) if (d[k] === undefined) delete d[k]; return d; });
  if (store.mode === "cloud") {
    const { db, fs } = fb;
    for (let i = 0; i < docs.length; i += 400) {
      const b = fs.writeBatch(db);
      for (const d of docs.slice(i, i + 400)) b.set(fs.doc(db, ROOT, HID, coll, d.id), d);
      await b.commit();
    }
  } else {
    const byId = new Map(localLoad(coll).map((d) => [d.id, d]));
    for (const d of docs) byId.set(d.id, d);
    localSave(coll, [...byId.values()]);
    window.dispatchEvent(new Event("wk-local-" + coll));
  }
  return docs.map((d) => d.id);
}
export function deleteDoc(coll, id) {
  if (store.mode === "cloud") {
    const { db, fs } = fb;
    fs.deleteDoc(fs.doc(db, ROOT, HID, coll, id)).catch(console.error);
  } else {
    localSave(coll, localLoad(coll).filter((x) => x.id !== id));
    window.dispatchEvent(new Event("wk-local-" + coll));
  }
}
