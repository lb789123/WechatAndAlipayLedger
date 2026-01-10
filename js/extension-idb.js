// ====== Extension IndexedDB Storage Adapter ======
// This adapter provides the same Promise API as the existing window.idb
// but uses a unique IndexedDB database name (ledger_ext_v1) that is
// scoped to the extension context. This prevents site data clearing
// from removing user data.
//
// API Surface (matches js/db.js):
// - getAll(store): Promise<Array>
// - put(store, val): Promise<boolean>
// - del(store, key): Promise<boolean>
// - clear(store): Promise<boolean>
// - setPrefRaw(key, value): Promise<boolean>
// - getPrefRaw(key): Promise<value|undefined>

const EXT_DB_NAME = 'ledger_ext_v1';
const EXT_DB_VERSION = 5;
let extDb = null;

// Store names matching the app's existing schema
const STORES = ['accounts', 'transactions', 'budgets', 'prefs', 'fxrates'];

/**
 * Open the extension-scoped IndexedDB database.
 * This is called automatically on first use.
 * Creates all required object stores with the same schema as js/db.js
 */
function openExtensionDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(EXT_DB_NAME, EXT_DB_VERSION);
    
    req.onupgradeneeded = e => {
      const d = e.target.result;
      let s;
      
      // Create 'accounts' store with indexes
      if (!d.objectStoreNames.contains('accounts')) {
        s = d.createObjectStore('accounts', { keyPath: 'id' });
      } else {
        s = e.target.transaction.objectStore('accounts');
      }
      try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
      try { s.createIndex('by_sort', 'sort', { unique: false }); } catch {}
      
      // Create 'transactions' store with indexes
      if (!d.objectStoreNames.contains('transactions')) {
        s = d.createObjectStore('transactions', { keyPath: 'id' });
      } else {
        s = e.target.transaction.objectStore('transactions');
      }
      try { s.createIndex('by_date', 'date', { unique: false }); } catch {}
      try { s.createIndex('by_account', 'accountId', { unique: false }); } catch {}
      try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
      
      // Recreate 'budgets' store (matching db.js behavior)
      if (d.objectStoreNames.contains('budgets')) {
        d.deleteObjectStore('budgets');
      }
      s = d.createObjectStore('budgets', { keyPath: 'key' });
      try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
      
      // Create 'prefs' store
      if (!d.objectStoreNames.contains('prefs')) {
        d.createObjectStore('prefs', { keyPath: 'key' });
      }
      
      // Recreate 'fxrates' store (matching db.js behavior)
      if (d.objectStoreNames.contains('fxrates')) {
        d.deleteObjectStore('fxrates');
      }
      s = d.createObjectStore('fxrates', { keyPath: 'key' });
      try { s.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
    };
    
    req.onsuccess = e => {
      extDb = e.target.result;
      resolve(extDb);
    };
    
    req.onerror = e => {
      reject(e.target.error);
    };
  });
}

/**
 * Get a transaction for the specified stores
 */
function extTx(storeNames, mode = 'readonly') {
  const t = extDb.transaction(storeNames, mode);
  return storeNames.map(n => t.objectStore(n));
}

/**
 * Extension IndexedDB adapter - implements the same API as window.idb
 */
const extensionIdb = {
  /**
   * Get all records from a store
   * @param {string} store - Store name
   * @returns {Promise<Array>}
   */
  async getAll(store) {
    if (!extDb) await openExtensionDB();
    return new Promise((res, rej) => {
      const [s] = extTx([store]);
      const r = s.getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  
  /**
   * Put a record into a store
   * @param {string} store - Store name
   * @param {Object} val - Value to store
   * @returns {Promise<boolean>}
   */
  async put(store, val) {
    if (!extDb) await openExtensionDB();
    return new Promise((res, rej) => {
      const [s] = extTx([store], 'readwrite');
      const r = s.put(val);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  
  /**
   * Delete a record from a store
   * @param {string} store - Store name
   * @param {*} key - Key to delete
   * @returns {Promise<boolean>}
   */
  async del(store, key) {
    if (!extDb) await openExtensionDB();
    return new Promise((res, rej) => {
      const [s] = extTx([store], 'readwrite');
      const r = s.delete(key);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  
  /**
   * Clear all records from a store
   * @param {string} store - Store name
   * @returns {Promise<boolean>}
   */
  async clear(store) {
    if (!extDb) await openExtensionDB();
    return new Promise((res, rej) => {
      const [s] = extTx([store], 'readwrite');
      const r = s.clear();
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  },
  
  /**
   * Set a preference value
   * @param {string} key - Preference key
   * @param {*} value - Value to store
   * @returns {Promise<boolean>}
   */
  async setPrefRaw(key, value) {
    return extensionIdb.put('prefs', { key, value });
  },
  
  /**
   * Get a preference value
   * @param {string} key - Preference key
   * @returns {Promise<*|undefined>}
   */
  async getPrefRaw(key) {
    if (!extDb) await openExtensionDB();
    return new Promise((res, rej) => {
      const [s] = extTx(['prefs']);
      const r = s.get(key);
      r.onsuccess = () => res(r.result ? r.result.value : undefined);
      r.onerror = () => rej(r.error);
    });
  }
};

/**
 * Extension-compatible openDB function
 * This maintains compatibility with the existing window.openDB API
 */
async function openExtensionDBCompat() {
  await openExtensionDB();
  return extDb;
}

// Expose to global scope
window.extensionIdb = extensionIdb;
window.openExtensionDB = openExtensionDBCompat;

console.log('Extension IndexedDB adapter loaded (ledger_ext_v1)');
