const DB_NAME = "mimi";
const DB_VERSION = 1;
const STORES = ["profile", "questDefinitions", "events", "completionClaims", "rewardGrants", "achievementUnlocks", "titleUnlocks", "projections", "settings", "audit"];

function request(r) { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error || new Error("IndexedDB request failed")); }); }
function done(tx) { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed")); tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted")); }); }
function ensureStore(db, name, options) { if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options); }

export async function openDatabase() {
  const open = indexedDB.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    ensureStore(db, "profile", { keyPath: "id" });
    ensureStore(db, "questDefinitions", { keyPath: "id" });
    ensureStore(db, "events", { keyPath: "id" });
    ensureStore(db, "completionClaims", { keyPath: "key" });
    ensureStore(db, "rewardGrants", { keyPath: "id" });
    ensureStore(db, "achievementUnlocks", { keyPath: "achievementId" });
    ensureStore(db, "titleUnlocks", { keyPath: "titleId" });
    ensureStore(db, "projections", { keyPath: "id" });
    ensureStore(db, "settings", { keyPath: "id" });
    ensureStore(db, "audit", { keyPath: "id" });
    open.transaction.objectStore("events").createIndex("by-date", "gameDate", { unique: false });
    open.transaction.objectStore("events").createIndex("by-quest", "questId", { unique: false });
  };
  return request(open);
}
export async function tx(db, storeNames, mode, work) { const transaction = db.transaction(storeNames, mode); const stores = Object.fromEntries(storeNames.map(n => [n, transaction.objectStore(n)])); const result = await work(stores, transaction); await done(transaction); return result; }
export async function getAll(db, store) { return tx(db, [store], "readonly", s => request(s[store].getAll())); }
export async function get(db, store, key) { return tx(db, [store], "readonly", s => request(s[store].get(key))); }
export async function put(db, store, value) { return tx(db, [store], "readwrite", s => request(s[store].put(value))); }
export async function clearAndRestore(db, payload) {
  return tx(db, STORES, "readwrite", async stores => {
    for (const name of STORES) await request(stores[name].clear());
    for (const name of STORES) for (const record of (payload[name] || [])) await request(stores[name].put(record));
  });
}
export async function snapshot(db) { const output = {}; for (const store of STORES) output[store] = await getAll(db, store); return output; }
export async function requestPersistentStorage() { try { return !!(navigator.storage?.persist && await navigator.storage.persist()); } catch { return false; } }
export async function diagnostics(db) {
  const data = await snapshot(db); const ids = new Set(data.events.map(e => e.id));
  const orphanGrants = data.rewardGrants.filter(g => !ids.has(g.eventId)).map(g => g.id);
  const duplicateClaims = data.completionClaims.filter(c => !ids.has(c.eventId)).map(c => c.key);
  return { ok: !orphanGrants.length && !duplicateClaims.length, counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])), orphanGrants, duplicateClaims };
}
export { DB_NAME, DB_VERSION, STORES, request };
