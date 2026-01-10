// ====== IndexedDB 数据库操作 ======
const DB_NAME='ledger_v1';
let db=null;

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,5);
    req.onupgradeneeded=e=>{
      const d=e.target.result; let s;
      if(!d.objectStoreNames.contains('accounts')){
        s=d.createObjectStore('accounts',{keyPath:'id'});
      } else { s=e.target.transaction.objectStore('accounts'); }
      try{s.createIndex('by_profile','profileId',{unique:false});}catch{}
      try{s.createIndex('by_sort','sort',{unique:false});}catch{}
      if(!d.objectStoreNames.contains('transactions')){
        s=d.createObjectStore('transactions',{keyPath:'id'});
      } else { s=e.target.transaction.objectStore('transactions'); }
      try{s.createIndex('by_date','date',{unique:false});}catch{}
      try{s.createIndex('by_account','accountId',{unique:false});}catch{}
      try{s.createIndex('by_profile','profileId',{unique:false});}catch{}
      if(d.objectStoreNames.contains('budgets')) d.deleteObjectStore('budgets');
      s=d.createObjectStore('budgets',{keyPath:'key'});
      try{s.createIndex('by_profile','profileId',{unique:false});}catch{}
      if(!d.objectStoreNames.contains('prefs')){
        d.createObjectStore('prefs',{keyPath:'key'});
      }
      if(d.objectStoreNames.contains('fxrates')) d.deleteObjectStore('fxrates');
      s=d.createObjectStore('fxrates',{keyPath:'key'});
      try{s.createIndex('by_profile','profileId',{unique:false});}catch{}
    };
    req.onsuccess=e=>{db=e.target.result;resolve(db)};
    req.onerror=e=>reject(e.target.error);
  });
}

function tx(storeNames,mode='readonly'){
  const t=db.transaction(storeNames,mode); return storeNames.map(n=>t.objectStore(n));
}

const idb={
  async getAll(store){return new Promise((res,rej)=>{const [s]=tx([store]);const r=s.getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});},
  async put(store,val){return new Promise((res,rej)=>{const [s]=tx([store],'readwrite');const r=s.put(val);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});},
  async del(store,key){return new Promise((res,rej)=>{const [s]=tx([store],'readwrite');const r=s.delete(key);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});},
  async clear(store){return new Promise((res,rej)=>{const [s]=tx([store],'readwrite');const r=s.clear();r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});},
  async setPrefRaw(key,value){return idb.put('prefs',{key,value});},
  async getPrefRaw(key){return new Promise((res,rej)=>{const [s]=tx(['prefs']);const r=s.get(key);r.onsuccess=()=>res(r.result? r.result.value:undefined);r.onerror=()=>rej(r.error);});}
};

// 暴露到全局
window.openDB = openDB;
window.idb = idb;
