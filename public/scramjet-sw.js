const _realIDBOpen = indexedDB.open.bind(indexedDB);

importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const idbReady = new Promise((resolve, reject) => {
  const req = _realIDBOpen("$scramjet", 1);
  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    ["config", "cookies", "referrerPolicies", "publicSuffixList", "redirectTrackers"].forEach(store => {
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    });
  };
  req.onsuccess = () => { req.result.close(); resolve(); };
  req.onerror = () => reject(req.error);
});

self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    try {
      await idbReady;
      await scramjet.loadConfig();
      if (!scramjet.config) return fetch(event.request);
      if (!scramjet.route(event)) return fetch(event.request);
      return scramjet.fetch(event);
    } catch(e) {
      console.error("Scramjet SW error:", e);
      return fetch(event.request);
    }
  })());
});