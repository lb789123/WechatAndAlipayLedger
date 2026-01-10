// ====== 主入口文件 ======
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
        window.renderBudget(null);
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

  if (initSample && state.accounts.length === 0 && state.profileId === 'default') {
    const a1 = { id: uid(), profileId: state.profileId, name: '现金', type: 'cash', currency: state.prefs.baseCurrency, includeInNetWorth: true, openingBalance: 200, createdAt: new Date().toISOString(), sort: 0 };
    const a2 = { id: uid(), profileId: state.profileId, name: '银行卡', type: 'bank', currency: state.prefs.baseCurrency, includeInNetWorth: true, openingBalance: 1200, createdAt: new Date().toISOString(), sort: 1 };
    const a3 = { id: uid(), profileId: state.profileId, name: 'USD 活期', type: 'bank', currency: 'USD', includeInNetWorth: true, openingBalance: 100, createdAt: new Date().toISOString(), sort: 2 };
    await window.idb.put('accounts', a1); await window.idb.put('accounts', a2); await window.idb.put('accounts', a3);
    state.accounts = [a1, a2, a3];
    const t1 = { id: uid(), profileId: state.profileId, date: todayStr(), accountId: a2.id, side: 'out', amount: 35.8, category: '餐饮', payee: '咖啡', memo: '拿铁', createdAt: new Date().toISOString() };
    await window.idb.put('transactions', t1); state.txs = [t1];
    if (state.prefs.baseCurrency === 'CNY') {
      const key = pkey('fx:USD'); const sampleFx = { key, profileId: state.profileId, quote: 'USD', rate: 7.10, updatedAt: new Date().toISOString() };
      await window.idb.put('fxrates', sampleFx); state.fxrates['USD'] = 7.10;
    }
  }
}

async function boot() {
  await window.openDB();
  renderTabs();
  if (window.bindEvents) window.bindEvents();
  await loadProfile(window.state.profileId, true);
  if (window.renderAll) window.renderAll();
  if (window.renderCategoriesTable) window.renderCategoriesTable();
  console.log('boot finished, binding import/export buttons');
  // 绑定导入导出按钮
  window.addEventListener('load', () => {
    console.log('window load event fired, binding buttons');
    const pid = document.querySelector('#dataProfileId');
    if (pid && window.state)
      pid.textContent = window.state.profileId;
    const bx = document.querySelector('#btnExportData');
    if (bx)
      bx.onclick = window.exportCurrentIdData;
    const bi = document.querySelector('#btnImportData');
    if (bi)
      bi.onclick = () => document.querySelector('#importFile')?.click();
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
    const bc = document.querySelector('#btnClearCurrentData'); if (bc) bc.onclick = window.clearCurrentIdData;
  });
}

// 暴露到全局
window.pkey = (k) => `${window.state.profileId}::${k}`;
window.loadProfile = loadProfile;

// 启动应用
boot();
