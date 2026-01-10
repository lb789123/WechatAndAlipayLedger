// ====== 工具函数 ======
const $ = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
const uid = ()=>crypto.randomUUID();
const todayStr = ()=>new Date().toISOString().slice(0,10);
const ym = (d)=>{const x=new Date(d);return x.getFullYear()+"-"+(String(x.getMonth()+1).padStart(2,'0'))}
const sameMonth = (a,b)=>ym(a)===ym(b);

// 货币符号
const CURRENCY_SYMBOLS={CNY:'¥',HKD:'HK$',USD:'$',EUR:'€'};
const currencySymbol = c=>CURRENCY_SYMBOLS[c]||c+" ";

// Profile 管理
const getCurrentProfile = ()=> localStorage.getItem('ledger_profile') || 'default';
const setCurrentProfile = (id)=>{ localStorage.setItem('ledger_profile', id || 'default'); };

// 金额遮罩（全局变量）
window.mask = false;

// 格式化金额
function fmtAmount(v,cur){
  if(v===undefined||v===null||Number.isNaN(v)) return '--';
  const s = (Number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}));
  return ((window.mask||false)? '****' : (currencySymbol(cur||window.state?.prefs?.baseCurrency||'CNY')+s));
}

// 暴露到全局
window.$ = $;
window.$$ = $$;
window.uid = uid;
window.todayStr = todayStr;
window.ym = ym;
window.sameMonth = sameMonth;
window.fmtAmount = fmtAmount;
window.getCurrentProfile = getCurrentProfile;
window.setCurrentProfile = setCurrentProfile;
