// ====== Extension IndexedDB Adapter ======
// This adapter provides the same Promise-based API as the existing window.idb
// but uses an extension-specific database name (ledger_ext_v1) to ensure
// data persists independently of site data clearing.
//
// Usage in extension context:
// The app will automatically detect extension context and swap window.idb
// with window.extensionIdb in main.js
//
// Testing:
// 1. Load unpacked extension in Chrome: chrome://extensions -> Load unpacked
// 2. Click toolbar icon to open app
// 3. Create accounts/transactions
// 4. Close tab and reopen - data should persist
// 5. Clear site data for hosted site - extension data remains intact
// 6. Check DevTools -> Application -> IndexedDB for "ledger_ext_v1" database

const EXT_DB_NAME = 'ledger_ext_v1';
const EXT_DB_VERSION = 5;
let extDb = null;

// Store names matching the main app's stores
const STORE_NAMES = ['accounts', 'transactions', 'budgets', 'prefs', 'fxrates'];

/**
 * Opens the extension-specific IndexedDB database
 * Creates object stores and indexes matching the main app's schema
 */
function openExtensionDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(EXT_DB_NAME, EXT_DB_VERSION);
    
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      let store;
      
      // Create accounts store
      if (!db.objectStoreNames.contains('accounts')) {
        store = db.createObjectStore('accounts', { keyPath: 'id' });
      } else {
        store = e.target.transaction.objectStore('accounts');
      }
      try { store.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
      try { store.createIndex('by_sort', 'sort', { unique: false }); } catch {}
      
      // Create transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        store = db.createObjectStore('transactions', { keyPath: 'id' });
      } else {
        store = e.target.transaction.objectStore('transactions');
      }
      try { store.createIndex('by_date', 'date', { unique: false }); } catch {}
      try { store.createIndex('by_account', 'accountId', { unique: false }); } catch {}
      try { store.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
      
      // Create/recreate budgets store
      if (db.objectStoreNames.contains('budgets')) {
        db.deleteObjectStore('budgets');
      }
      store = db.createObjectStore('budgets', { keyPath: 'key' });
      try { store.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
      
      // Create prefs store
      if (!db.objectStoreNames.contains('prefs')) {
        db.createObjectStore('prefs', { keyPath: 'key' });
      }
      
      // Create/recreate fxrates store
      if (db.objectStoreNames.contains('fxrates')) {
        db.deleteObjectStore('fxrates');
      }
      store = db.createObjectStore('fxrates', { keyPath: 'key' });
      try { store.createIndex('by_profile', 'profileId', { unique: false }); } catch {}
    };
    
    req.onsuccess = (e) => {
      extDb = e.target.result;
      resolve(extDb);
    };
    
    req.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

/**
 * Helper to get transaction and object store
 */
function extTx(storeNames, mode = 'readonly') {
  if (!extDb) {
    throw new Error('Extension database not opened. Call openExtensionDB first.');
  }
  const transaction = extDb.transaction(storeNames, mode);
  return storeNames.map(name => transaction.objectStore(name));
}

/**
 * Extension IDB API - mirrors the existing window.idb interface
 */
const extensionIdb = {
  /**
   * Get all records from a store
   */
  async getAll(store) {
    if (!extDb) await openExtensionDB();
    return new Promise((resolve, reject) => {
      const [s] = extTx([store]);
      const request = s.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  /**
   * Put a record into a store
   */
  async put(store, val) {
    if (!extDb) await openExtensionDB();
    return new Promise((resolve, reject) => {
      const [s] = extTx([store], 'readwrite');
      const request = s.put(val);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },
  
  /**
   * Delete a record from a store by key
   */
  async del(store, key) {
    if (!extDb) await openExtensionDB();
    return new Promise((resolve, reject) => {
      const [s] = extTx([store], 'readwrite');
      const request = s.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },
  
  /**
   * Clear all records from a store
   */
  async clear(store) {
    if (!extDb) await openExtensionDB();
    return new Promise((resolve, reject) => {
      const [s] = extTx([store], 'readwrite');
      const request = s.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },
  
  /**
   * Set a preference value by key
   */
  async setPrefRaw(key, value) {
    return extensionIdb.put('prefs', { key, value });
  },
  
  /**
   * Get a preference value by key
   */
  async getPrefRaw(key) {
    if (!extDb) await openExtensionDB();
    return new Promise((resolve, reject) => {
      const [s] = extTx(['prefs']);
      const request = s.get(key);
      request.onsuccess = () => {
        resolve(request.result ? request.result.value : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }
};

// Expose the extension IDB adapter and openDB function to global scope
window.extensionIdb = extensionIdb;
window.openExtensionDB = openExtensionDB;
