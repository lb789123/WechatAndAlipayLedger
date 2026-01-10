/**
 * store.js - 数据库与持久化层
 * 封装 IndexedDB 操作，支持多 ID (profileId) 数据隔离
 */

const DB_NAME = 'ledger_v1';
const DB_VERSION = 5;
let db = null;

export const idb = {
    /**
     * 打开并初始化数据库
     */
    async open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                let s;

                // 1. 账户表
                if (!d.objectStoreNames.contains('accounts')) {
                    s = d.createObjectStore('accounts', { keyPath: 'id' });
                } else {
                    s = e.target.transaction.objectStore('accounts');
                }
                if (!s.indexNames.contains('by_profile')) s.createIndex('by_profile', 'profileId', { unique: false });
                if (!s.indexNames.contains('by_sort')) s.createIndex('by_sort', 'sort', { unique: false });

                // 2. 交易流水表
                if (!d.objectStoreNames.contains('transactions')) {
                    s = d.createObjectStore('transactions', { keyPath: 'id' });
                } else {
                    s = e.target.transaction.objectStore('transactions');
                }
                if (!s.indexNames.contains('by_date')) s.createIndex('by_date', 'date', { unique: false });
                if (!s.indexNames.contains('by_account')) s.createIndex('by_account', 'accountId', { unique: false });
                if (!s.indexNames.contains('by_profile')) s.createIndex('by_profile', 'profileId', { unique: false });

                // 3. 预算表 (按 profileId::category 存储)
                if (d.objectStoreNames.contains('budgets')) d.deleteObjectStore('budgets');
                s = d.createObjectStore('budgets', { keyPath: 'key' });
                s.createIndex('by_profile', 'profileId', { unique: false });

                // 4. 偏好设置表
                if (!d.objectStoreNames.contains('prefs')) {
                    d.createObjectStore('prefs', { keyPath: 'key' });
                }

                // 5. 汇率表
                if (d.objectStoreNames.contains('fxrates')) d.deleteObjectStore('fxrates');
                s = d.createObjectStore('fxrates', { keyPath: 'key' });
                s.createIndex('by_profile', 'profileId', { unique: false });
            };

            req.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };

            req.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * 通用事务处理工具
     */
    _tx(storeNames, mode = 'readonly') {
        if (!db) throw new Error("数据库未初始化");
        const t = db.transaction(storeNames, mode);
        return storeNames.map(n => t.objectStore(n));
    },

    /**
     * 获取指定存储空间的所有数据
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const [s] = this._tx([storeName]);
            const r = s.getAll();
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
    },

    /**
     * 保存或更新数据
     */
    async put(storeName, val) {
        return new Promise((resolve, reject) => {
            const [s] = this._tx([storeName], 'readwrite');
            const r = s.put(val);
            r.onsuccess = () => resolve(true);
            r.onerror = () => reject(r.error);
        });
    },

    /**
     * 删除数据
     */
    async del(storeName, key) {
        return new Promise((resolve, reject) => {
            const [s] = this._tx([storeName], 'readwrite');
            const r = s.delete(key);
            r.onsuccess = () => resolve(true);
            r.onerror = () => reject(r.error);
        });
    },

    /**
     * 清空存储空间
     */
    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const [s] = this._tx([storeName], 'readwrite');
            const r = s.clear();
            r.onsuccess = () => resolve(true);
            r.onerror = () => reject(r.error);
        });
    },

    /**
     * 偏好设置专用：设置原始值
     */
    async setPrefRaw(key, value) {
        return this.put('prefs', { key, value });
    },

    /**
     * 偏好设置专用：获取原始值
     */
    async getPrefRaw(key) {
        return new Promise((resolve, reject) => {
            const [s] = this._tx(['prefs']);
            const r = s.get(key);
            r.onsuccess = () => resolve(r.result ? r.result.value : undefined);
            r.onerror = () => reject(r.error);
        });
    }
};