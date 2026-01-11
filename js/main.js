
async function ensureExtensionIdbIfNeeded(){
  try{
    const isExt = (location && (location.protocol === 'chrome-extension:' || location.protocol === 'moz-extension:'));
    if(!isExt) return;
    if(window.extensionIdb && typeof window.extensionIdb.openDB === 'function'){
      // Wait for the extension adapter DB to be ready, then swap idb
      await window.extensionIdb.openDB();
      window.idb = window.extensionIdb;
      // also map openDB helper for backward compatibility
      window.openDB = window.extensionIdb.openDB;
      console.info('Using extension-scoped IndexedDB (ledger_ext_v1)');
    } else {
      console.warn('extensionIdb not found. Ensure js/extension-idb.js is included in index.html for extension builds.');
    }
  }catch(err){
    console.warn('ensureExtensionIdbIfNeeded error', err);
  }
}

(function detectExtensionContext() {
  const isExtension = location.protocol === 'chrome-extension:' || 
                     location.protocol === 'moz-extension:';
  
  if (isExtension) {
    console.log('Running in extension context, using extension IndexedDB adapter');
    // Swap window.idb to use extension adapter
    if (window.extensionIdb) {
      window.idb = window.extensionIdb;
      // Replace openDB to use extension adapter's openDB
      window.openDB = window.openExtensionDB;
    } else {
      console.error('Extension adapter not loaded! Please ensure extension-idb.js is loaded before main.js');
    }
  } else {
    console.log('Running in regular web context, using standard IndexedDB');
  }
})();

const TABS = [
  { id: 'dashboard', label: '仪表盘' },
  { id: 'accounts', label: '账户' },
  { id: 'trans', label: '交易' },
  { id: 'budget', label: '预算' },
  { id: 'reports', label: '报表' },
  { id: 'settings', label: '设置' }
];

function renderTabs() {
  const nav = $('#tabs'); nav.innerHTML = '';
  TABS.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = '' + (i === 0 ? 'active' : '');
    btn.textContent = t.label; btn.dataset.target = '#sec-' + t.id;
    btn.onclick = () => {
      $$('.section').forEach(s => s.classList.remove('active'));
      $(btn.dataset.target).classList.add('active');
      $$('#tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (t.id === 'reports' && window.renderReports) { window.renderReports(); }
      if (t.id === 'dashboard' && window.renderAcctDonut) { window.renderAcctDonut(); }
      if (t.id === 'budget' && window.renderBudget) {
        if (window.closeBudgetDetail) window.closeBudgetDetail();
        const modeSel = document.getElementById('budgetViewMode');
        const monthSel = document.getElementById('budgetMonthSelector');
        const mode = modeSel ? modeSel.value : 'month';
        const monthVal = monthSel ? monthSel.value : null;
        window.renderBudget(monthVal || null, mode);
      }
    };
    nav.appendChild(btn);
  });
}

async function loadProfile(profileId, initSample = false) {
  if (!window.state) return;
  const state = window.state;
  state.profileId = profileId || 'default';
  setCurrentProfile(state.profileId);
  $('#profileIdShow').textContent = state.profileId;

  const pkey = window.pkey || ((k) => `${state.profileId}::${k}`);
  const prefsBase = await window.idb.getPrefRaw(pkey('baseCurrency'));
  const prefsMask = await window.idb.getPrefRaw(pkey('maskAmounts'));
  const prefsTheme = await window.idb.getPrefRaw(pkey('theme'));
  state.prefs.baseCurrency = prefsBase || 'CNY';
  state.prefs.maskAmounts = !!prefsMask;
  state.prefs.theme = prefsTheme || 'dark';
  window.mask = state.prefs.maskAmounts;
  if (window.applyTheme) window.applyTheme(state.prefs.theme);
  $('#baseCurrency').value = state.prefs.baseCurrency;
  $('#maskAmounts').value = String(state.prefs.maskAmounts);
  $('#themeSelect').value = state.prefs.theme;

  const allAcc = await window.idb.getAll('accounts');
  const allTx = await window.idb.getAll('transactions');
  const allBdg = await window.idb.getAll('budgets');
  const allFx = await window.idb.getAll('fxrates');

  state.accounts = allAcc.filter(a => (a.profileId || 'default') === state.profileId);
  state.txs = allTx.filter(t => (t.profileId || 'default') === state.profileId);
  state.budgets = {}; allBdg.filter(b => b.profileId === state.profileId).forEach(b => state.budgets[b.category] = Number(b.amount) || 0);
  state.fxrates = {}; allFx.filter(r => r.profileId === state.profileId).forEach(r => state.fxrates[r.quote] = Number(r.rate) || 0);

  // 加载分类（在加载数据之后）
  if (window.loadCategories) {
    await window.loadCategories();
  }
}

// 暴露到全局
async function boot() {
  await ensureExtensionIdbIfNeeded(); 
  await window.openDB();
  renderTabs();
  if (window.bindEvents) window.bindEvents();
  await loadProfile(window.state.profileId, true);
  if (window.renderAll) window.renderAll();
  if (window.renderCategoriesTable) window.renderCategoriesTable();

  // 这里直接绑定导入导出按钮，不再等 window.load
  const pid = document.querySelector('#dataProfileId');
  if (pid && window.state) {
    pid.textContent = window.state.profileId;
  }

  const bx = document.querySelector('#btnExportData');
  if (bx) {
    bx.onclick = window.exportCurrentIdData;
  }

  const bi = document.querySelector('#btnImportData');
  if (bi) {
    bi.onclick = () => document.querySelector('#importFile')?.click();
  }

  const fi = document.querySelector('#importFile');
  if (fi) {
    fi.onchange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (f && window.importCurrentIdDataFromFile) {
        window.importCurrentIdDataFromFile(f);
      }
      e.target.value = '';
    };
  }

  const bc = document.querySelector('#btnClearCurrentData');
  if (bc) {
    bc.onclick = window.clearCurrentIdData;
  }
}

// 暴露到全局
window.pkey = (k) => `${window.state.profileId}::${k}`;
window.loadProfile = loadProfile;


  // 启动应用
boot();

