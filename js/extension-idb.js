// Extension-scoped IndexedDB adapter for Ledger app.
// Safe-guarded: if window.extensionIdb already exists, do nothing (prevents "already declared" issues).
// All top-level names are contained in the IIFE to avoid leaking globals.
//
// DB name: ledger_ext_v1
// Object stores: accounts (keyPath 'id'), transactions ('id'), budgets ('key'), prefs ('key'), fxrates ('key')

(function(){
  if (window.extensionIdb) {
    // Already loaded/defined - avoid duplicate declaration
    console.warn('extensionIdb already present, skipping re-definition.');
    return;
  }

  const EXT_DB_NAME = 'ledger_ext_v1';
  const EXT_DB_VERSION = 1;
  let db = null;

  function openDB(){
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(EXT_DB_NAME, EXT_DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        try {
          if (!d.objectStoreNames.contains('accounts')) {
            const s = d.createObjectStore('accounts', { keyPath: 'id' });
            try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
            try { s.createIndex('by_sort', 'sort', { unique: false }); } catch {}
          }
          if (!d.objectStoreNames.contains('transactions')) {
            const s = d.createObjectStore('transactions', { keyPath: 'id' });
            try { s.createIndex('by_date', 'date', { unique: false }); } catch {}
            try { s.createIndex('by_account', 'accountId', { unique: false }); } catch {}
            try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
          }
          if (!d.objectStoreNames.contains('budgets')) {
            const s = d.createObjectStore('budgets', { keyPath: 'key' });
            try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
          }
          if (!d.objectStoreNames.contains('prefs')) {
            d.createObjectStore('prefs', { keyPath: 'key' });
          }
          if (!d.objectStoreNames.contains('fxrates')) {
            const s = d.createObjectStore('fxrates', { keyPath: 'key' });
            try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
          }
        } catch (ex) {
          console.warn('onupgradeneeded warnings', ex);
        }
      };
      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = (e) => {
        reject(e.target.error);
      };
    });
  }

  function tx(storeNames, mode='readonly'){
    if(!db) throw new Error('DB not opened');
    const t = db.transaction(storeNames, mode);
    return storeNames.map(n => t.objectStore(n));
  }

  const adapter = {
    openDB,
    async getAll(store){
      await openDB();
      return new Promise((res, rej) => {
        const [s] = tx([store]);
        const r = s.getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => rej(r.error);
      });
    },
    async put(store, val){
      await openDB();
      return new Promise((res, rej) => {
        const [s] = tx([store], 'readwrite');
        const r = s.put(val);
        r.onsuccess = () => res(true);
        r.onerror = () => rej(r.error);
      });
    },
    async del(store, key){
      await openDB();
      return new Promise((res, rej) => {
        const [s] = tx([store], 'readwrite');
        const r = s.delete(key);
        r.onsuccess = () => res(true);
        r.onerror = () => rej(r.error);
      });
    },
    async clear(store){
      await openDB();
      return new Promise((res, rej) => {
        const [s] = tx([store], 'readwrite');
        const r = s.clear();
        r.onsuccess = () => res(true);
        r.onerror = () => rej(r.error);
      });
    },
    async setPrefRaw(key, value){
      await openDB();
      return new Promise((res, rej) => {
        const [s] = tx(['prefs'], 'readwrite');
        const r = s.put({ key, value });
        r.onsuccess = () => res(true);
        r.onerror = () => rej(r.error);
      });
    },
    async getPrefRaw(key){
      await openDB();
      return new Promise((res, rej) => {
        const [s] = tx(['prefs']);
        const r = s.get(key);
        r.onsuccess = () => res(r.result ? r.result.value : undefined);
        r.onerror = () => rej(r.error);
      });
    }
  };

  // Expose to page
  window.extensionIdb = adapter;

  // If loaded inside extension page, open proactively (non-blocking)
  try {
    if (location && (location.protocol === 'chrome-extension:' || location.protocol === 'moz-extension:')) {
      adapter.openDB().catch(()=>{ /* ignore open errors here; callers may await */ });
    }
  } catch (e) { /* ignore in non-browser contexts */ }
})();