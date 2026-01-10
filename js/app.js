import { $, $$, uid, todayStr, ym, sameMonth, fmtAmount } from './utils.js';
import { idb } from './store.js';

// ====== 全局状态 ======
const state = {
    profileId: localStorage.getItem('ledger_profile') || 'default',
    accounts: [],
    txs: [],
    budgets: {},
    fxrates: {},
    prefs: {
        baseCurrency: 'CNY',
        maskAmounts: false,
        theme: 'dark'
    }
};

let mask = false;
let donutCache = null;

// ====== 初始化引导 ======
async function boot() {
    await idb.open();
    renderTabs();
    bindEvents();
    await loadProfile(state.profileId, true);
    renderAll();
}

// ====== 核心业务逻辑 ======

async function loadProfile(profileId, initSample = false) {
    state.profileId = profileId || 'default';
    localStorage.setItem('ledger_profile', state.profileId);
    $('#profileIdShow').textContent = state.profileId;

    // 加载偏好设置
    const pkey = (k) => `${state.profileId}::${k}`;
    const prefsBase = await idb.getPrefRaw(pkey('baseCurrency'));
    const prefsMask = await idb.getPrefRaw(pkey('maskAmounts'));
    const prefsTheme = await idb.getPrefRaw(pkey('theme'));

    state.prefs.baseCurrency = prefsBase || 'CNY';
    state.prefs.maskAmounts = !!prefsMask;
    state.prefs.theme = prefsTheme || 'dark';
    
    mask = state.prefs.maskAmounts;
    applyTheme(state.prefs.theme);

    // 同步 UI 状态
    $('#baseCurrency').value = state.prefs.baseCurrency;
    $('#maskAmounts').value = String(state.prefs.maskAmounts);
    $('#themeSelect').value = state.prefs.theme;

    // 从 IndexedDB 获取当前 ID 的数据
    const allAcc = await idb.getAll('accounts');
    const allTx = await idb.getAll('transactions');
    const allBdg = await idb.getAll('budgets');
    const allFx = await idb.getAll('fxrates');

    state.accounts = allAcc.filter(a => (a.profileId || 'default') === state.profileId);
    state.txs = allTx.filter(t => (t.profileId || 'default') === state.profileId);
    
    state.budgets = {};
    allBdg.filter(b => b.profileId === state.profileId)
          .forEach(b => state.budgets[b.category] = Number(b.amount) || 0);
    
    state.fxrates = {};
    allFx.filter(r => r.profileId === state.profileId)
         .forEach(r => state.fxrates[r.quote] = Number(r.rate) || 0);

    // 初始化分类下拉框
    const CATS = ['餐饮', '交通', '居住', '数码', '服饰', '娱乐', '教育', '亲友代付', '医疗', '日用', '旅行', '其他'];
    $('#tx_category').innerHTML = CATS.map(c => `<option value="${c}">${c}</option>`).join('');
    $('#bdg_category').innerHTML = CATS.map(c => `<option value="${c}">${c}</option>`).join('');
}

// ====== UI 渲染函数 ======

function renderAll() {
    fillAccountSelects();
    renderDashboard();
    renderAccountsTable();
    renderTxTable();
    renderBudget();
    renderFxTable();
    updateDataProfileId();
}

function fillAccountSelects() {
    const opts = state.accounts.sort((a, b) => (a.sort || 0) - (b.sort || 0))
                               .map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    $('#tx_account').innerHTML = opts;
    $('#filter_account').innerHTML = '<option value="">全部账户</option>' + opts;
    $('#tx_date').value = todayStr();
}

function accountBalance(acc) {
    let bal = Number(acc.openingBalance) || 0;
    state.txs.filter(t => t.accountId === acc.id).forEach(t => {
        if (t.side === 'in') bal += Number(t.amount) || 0;
        else if (t.side === 'out') bal -= Number(t.amount) || 0;
    });
    return bal;
}

function amountToBase(amount, currency) {
    if (currency === state.prefs.baseCurrency) return Number(amount) || 0;
    const pkey = (k) => `${state.profileId}::${k}`;
    const rate = state.fxrates[currency];
    return (rate && rate > 0) ? (Number(amount) || 0) * rate : null;
}

function renderDashboard() {
    const base = state.prefs.baseCurrency;
    let income = 0, expense = 0, net = 0;
    const missing = new Set();

    state.accounts.filter(a => a.includeInNetWorth !== false).forEach(a => {
        const bal = accountBalance(a);
        const baseVal = amountToBase(bal, a.currency);
        if (baseVal === null) missing.add(a.currency);
        else net += baseVal;
    });

    state.txs.filter(t => sameMonth(t.date, new Date()) && t.side).forEach(t => {
        const acc = state.accounts.find(a => a.id === t.accountId);
        if (!acc) return;
        const v = amountToBase(t.amount, acc.currency);
        if (v === null) return;
        if (t.side === 'in') income += v;
        if (t.side === 'out') expense += v;
    });

    $('#netWorth').textContent = fmtAmount(net, base, mask, base);
    $('#monthIn').textContent = fmtAmount(income, base, mask, base);
    $('#monthOut').textContent = fmtAmount(expense, base, mask, base);
    $('#netWorthNote').textContent = missing.size ? `缺少 ${Array.from(missing).join(', ')} 汇率，未计入净资产。` : '';

    renderAccountCards();
    renderRecentTransactions();
    renderAcctDonut();
}

// ====== 事件绑定 ======

function bindEvents() {
    // 切换 Tab 逻辑（通过 data-nav 属性）
    $$('[data-nav]').forEach(b => b.onclick = () => {
        const targetId = b.dataset.nav;
        $$('.section').forEach(s => s.classList.remove('active'));
        const target = $(targetId);
        if (target) {
            target.classList.add('active');
            // 如果切换到报表页面，渲染图表
            if (target.id === 'sec-reports') {
                setTimeout(() => {
                    renderLineChart();
                    renderPieChart();
                }, 100);
            }
        }
        $$('#tabs button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === targetId);
        });
    });

    // 切换 ID
    $('#switchIdBtn').onclick = async () => {
        const id = prompt('输入要切换/新建的 ID：', state.profileId);
        if (id == null) return;
        const rid = (id.trim() || 'default').slice(0, 40);
        await loadProfile(rid);
        renderAll();
    };

    // 主题切换
    $('#toggleThemeBtn').onclick = () => {
        const next = state.prefs.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        state.prefs.theme = next;
        savePrefs();
    };

    // 遮罩切换
    $('#toggleMaskBtn').onclick = () => {
        mask = !mask;
        state.prefs.maskAmounts = mask;
        savePrefs();
        renderAll();
    };

    // 记账提交
    $('#txnForm').onsubmit = async (e) => {
        e.preventDefault();
        await saveTransaction();
    };

    // 账户提交
    $('#accountForm').onsubmit = async (e) => {
        e.preventDefault();
        await saveAccount();
    };

    // 新增账户按钮
    $('#btnAddAccount').onclick = () => {
        $('#accountForm').reset();
        $('#acc_id').value = '';
        $('#acc_sort').value = state.accounts.length;
    };

    // 预算表单提交
    $('#budgetForm').onsubmit = async (e) => {
        e.preventDefault();
        const category = $('#bdg_category').value;
        const amount = Number($('#bdg_amount').value) || 0;
        if (!category) return;
        const key = `${state.profileId}::${category}`;
        await idb.put('budgets', { key, profileId: state.profileId, category, amount });
        state.budgets[category] = amount;
        $('#budgetForm').reset();
        renderBudget();
    };

    // 偏好设置表单提交
    $('#prefsForm').onsubmit = async (e) => {
        e.preventDefault();
        state.prefs.baseCurrency = $('#baseCurrency').value;
        state.prefs.maskAmounts = $('#maskAmounts').value === 'true';
        state.prefs.theme = $('#themeSelect').value;
        mask = state.prefs.maskAmounts;
        applyTheme(state.prefs.theme);
        await savePrefs();
        renderAll();
    };

    // 导出数据
    $('#btnExportData').onclick = async () => {
        try {
            const data = {
                profileId: state.profileId,
                accounts: state.accounts,
                transactions: state.txs,
                budgets: Object.entries(state.budgets).map(([category, amount]) => ({
                    profileId: state.profileId,
                    category,
                    amount
                })),
                preferences: state.prefs,
                exportDate: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ledger_${state.profileId}_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('导出失败: ' + err.message);
        }
    };

    // 数据清理
    $('#btnClearCurrentData').onclick = clearCurrentIdData;

    // 账户筛选
    $('#filter_account').onchange = () => {
        renderTxTable();
    };
}

// ====== 辅助渲染逻辑 (此处补齐表格渲染等) ======

function renderAccountCards() {
    const wrap = $('#accountCards');
    wrap.innerHTML = '';
    state.accounts.sort((a, b) => a.sort - b.sort).forEach(a => {
        const bal = accountBalance(a);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="content">
                <div class="row"><strong>${a.name}</strong><span class="space"></span><span class="tag">${a.type}</span></div>
                <div class="kpi"><span class="value">${fmtAmount(bal, a.currency, mask, state.prefs.baseCurrency)}</span></div>
            </div>`;
        wrap.appendChild(card);
    });
}

function applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    $('#themeSelect').value = theme;
}

async function savePrefs() {
    const pkey = (k) => `${state.profileId}::${k}`;
    await idb.setPrefRaw(pkey('baseCurrency'), state.prefs.baseCurrency);
    await idb.setPrefRaw(pkey('maskAmounts'), state.prefs.maskAmounts);
    await idb.setPrefRaw(pkey('theme'), state.prefs.theme);
}

// 模拟原有的渲染 Tabs 逻辑
function renderTabs() {
    const nav = $('#tabs');
    const tabs = [
        { id: 'dashboard', label: '仪表盘' },
        { id: 'accounts', label: '账户' },
        { id: 'trans', label: '交易' },
        { id: 'budget', label: '预算' },
        { id: 'reports', label: '报表' },
        { id: 'settings', label: '设置' }
    ];
    nav.innerHTML = tabs.map((t, i) => `
        <button class="${i === 0 ? 'active' : ''}" data-target="#sec-${t.id}">${t.label}</button>
    `).join('');
    
    $$('#tabs button').forEach(btn => {
        btn.onclick = () => {
            $$('.section').forEach(s => s.classList.remove('active'));
            const target = $(btn.dataset.target);
            if (target) {
                target.classList.add('active');
                // 如果切换到报表页面，渲染图表
                if (target.id === 'sec-reports') {
                    setTimeout(() => {
                        renderLineChart();
                        renderPieChart();
                    }, 100);
                }
            }
            $$('#tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
}

function updateDataProfileId() {
    const el = $('#dataProfileId');
    if (el) el.value = state.profileId;
}

// ====== 渲染表格和列表 ======

function renderAccountsTable() {
    const tbody = $('#accountsTable tbody');
    tbody.innerHTML = '';
    state.accounts.sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(acc => {
        const bal = accountBalance(acc);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="drag-handle">⋮⋮</span></td>
            <td><strong>${acc.name}</strong></td>
            <td><span class="tag">${acc.type === 'cash' ? '现金' : acc.type === 'bank' ? '银行卡' : '理财'}</span></td>
            <td>${acc.currency}</td>
            <td class="amount ${bal >= 0 ? 'positive' : 'negative'}">${fmtAmount(bal, acc.currency, mask, state.prefs.baseCurrency)}</td>
            <td style="text-align:right">
                <button class="btn" onclick="editAccount('${acc.id}')">编辑</button>
                <button class="btn negative" onclick="deleteAccount('${acc.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.editAccount = async function(id) {
    const acc = state.accounts.find(a => a.id === id);
    if (!acc) return;
    $('#acc_id').value = acc.id;
    $('#acc_name').value = acc.name || '';
    $('#acc_type').value = acc.type || 'cash';
    $('#acc_currency').value = acc.currency || 'CNY';
    $('#acc_opening').value = acc.openingBalance || 0;
    $('#acc_in_net').value = String(acc.includeInNetWorth !== false);
    $('#acc_sort').value = acc.sort || 0;
};

window.deleteAccount = async function(id) {
    if (!confirm('确定要删除这个账户吗？')) return;
    await idb.del('accounts', id);
    state.accounts = state.accounts.filter(a => a.id !== id);
    renderAll();
};

async function saveAccount() {
    const id = $('#acc_id').value || uid();
    const acc = {
        id,
        profileId: state.profileId,
        name: $('#acc_name').value.trim(),
        type: $('#acc_type').value,
        currency: $('#acc_currency').value,
        openingBalance: Number($('#acc_opening').value) || 0,
        includeInNetWorth: $('#acc_in_net').value === 'true',
        sort: Number($('#acc_sort').value) || 0
    };
    await idb.put('accounts', acc);
    const idx = state.accounts.findIndex(a => a.id === id);
    if (idx >= 0) state.accounts[idx] = acc;
    else state.accounts.push(acc);
    $('#accountForm').reset();
    $('#acc_id').value = '';
    renderAll();
}

function renderTxTable() {
    const tbody = $('#txTable tbody');
    const filterAcc = $('#filter_account').value;
    let txs = state.txs;
    if (filterAcc) txs = txs.filter(t => t.accountId === filterAcc);
    txs = txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = '';
    txs.forEach(tx => {
        const acc = state.accounts.find(a => a.id === tx.accountId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tx.date}</td>
            <td>${acc ? acc.name : '未知账户'}</td>
            <td>${tx.category || ''} ${tx.memo ? '· ' + tx.memo : ''}</td>
            <td class="amount ${tx.side === 'in' ? 'positive' : 'negative'}" style="text-align:right">
                ${tx.side === 'in' ? '+' : '-'}${fmtAmount(tx.amount, acc ? acc.currency : state.prefs.baseCurrency, mask, state.prefs.baseCurrency)}
            </td>
            <td>
                <button class="btn" onclick="editTransaction('${tx.id}')">编辑</button>
                <button class="btn negative" onclick="deleteTransaction('${tx.id}')">删除</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderRecentTransactions() {
    const tbody = $('#recentTxTable tbody');
    const recent = state.txs.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    tbody.innerHTML = '';
    recent.forEach(tx => {
        const acc = state.accounts.find(a => a.id === tx.accountId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${tx.date}</td>
            <td>${acc ? acc.name : '未知账户'}</td>
            <td>${tx.category || ''} ${tx.memo ? '· ' + tx.memo : ''}</td>
            <td class="amount ${tx.side === 'in' ? 'positive' : 'negative'}" style="text-align:right">
                ${tx.side === 'in' ? '+' : '-'}${fmtAmount(tx.amount, acc ? acc.currency : state.prefs.baseCurrency, mask, state.prefs.baseCurrency)}
            </td>
            <td></td>
        `;
        tbody.appendChild(row);
    });
}

async function saveTransaction() {
    const txId = window.editingTxId || uid();
    const tx = {
        id: txId,
        profileId: state.profileId,
        date: $('#tx_date').value,
        side: $('#tx_type').value, // 'in' or 'out'
        accountId: $('#tx_account').value,
        amount: Number($('#tx_amount').value) || 0,
        category: $('#tx_category').value || '',
        memo: $('#tx_memo').value.trim() || ''
    };
    if (!tx.accountId || !tx.amount) {
        alert('请填写完整的交易信息');
        return;
    }
    await idb.put('transactions', tx);
    const idx = state.txs.findIndex(t => t.id === txId);
    if (idx >= 0) state.txs[idx] = tx;
    else state.txs.push(tx);
    $('#txnForm').reset();
    $('#tx_date').value = todayStr();
    window.editingTxId = null; // 清除编辑标记
    fillAccountSelects();
    renderAll();
}

window.editTransaction = async function(id) {
    const tx = state.txs.find(t => t.id === id);
    if (!tx) return;
    $('#tx_date').value = tx.date;
    $('#tx_type').value = tx.side;
    $('#tx_account').value = tx.accountId;
    $('#tx_amount').value = tx.amount;
    $('#tx_category').value = tx.category || '';
    $('#tx_memo').value = tx.memo || '';
    // 可以添加一个编辑模式标志，保存时更新而不是创建新记录
    window.editingTxId = id; // 标记正在编辑的交易ID
};

window.deleteTransaction = async function(id) {
    if (!confirm('确定要删除这条交易吗？')) return;
    await idb.del('transactions', id);
    state.txs = state.txs.filter(t => t.id !== id);
    renderAll();
};

function renderBudget() {
    const grid = $('#budgetGrid');
    if (!grid) return;
    const CATS = ['餐饮', '交通', '居住', '数码', '服饰', '娱乐', '教育', '亲友代付', '医疗', '日用', '旅行', '其他'];
    grid.innerHTML = '';
    CATS.forEach(cat => {
        const budget = state.budgets[cat] || 0;
        const spent = state.txs
            .filter(t => t.category === cat && t.side === 'out' && sameMonth(t.date, new Date()))
            .reduce((sum, t) => {
                const acc = state.accounts.find(a => a.id === t.accountId);
                if (!acc) return sum;
                const v = amountToBase(t.amount, acc.currency);
                return sum + (v || 0);
            }, 0);
        const card = document.createElement('div');
        card.className = 'card';
        const percent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
        card.innerHTML = `
            <div class="content">
                <div class="row"><strong>${cat}</strong><div class="space"></div></div>
                <div class="kpi">
                    <span class="value">${fmtAmount(spent, state.prefs.baseCurrency, mask, state.prefs.baseCurrency)} / ${fmtAmount(budget, state.prefs.baseCurrency, mask, state.prefs.baseCurrency)}</span>
                </div>
                ${budget > 0 ? `<div class="progress"><i style="width:${percent}%"></i></div>` : '<div class="progress"><i style="width:0%"></i></div>'}
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderFxTable() {
    // 汇率表暂时不实现，可以在设置页面添加
}

function renderLineChart() {
    const canvas = $('#lineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 获取实际尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = 260 * (window.devicePixelRatio || 1);
    const scale = window.devicePixelRatio || 1;
    ctx.scale(scale, scale);
    
    const width = canvas.width / scale;
    const height = canvas.height / scale;
    
    // 获取最近6个月的数据
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(ym(d));
    }
    
    const incomeData = months.map(m => {
        return state.txs.filter(t => {
            const txMonth = ym(t.date);
            return txMonth === m && t.side === 'in';
        }).reduce((sum, t) => {
            const acc = state.accounts.find(a => a.id === t.accountId);
            if (!acc) return sum;
            const v = amountToBase(t.amount, acc.currency);
            return sum + (v || 0);
        }, 0);
    });
    
    const expenseData = months.map(m => {
        return state.txs.filter(t => {
            const txMonth = ym(t.date);
            return txMonth === m && t.side === 'out';
        }).reduce((sum, t) => {
            const acc = state.accounts.find(a => a.id === t.accountId);
            if (!acc) return sum;
            const v = amountToBase(t.amount, acc.currency);
            return sum + (v || 0);
        }, 0);
    });
    
    const maxValue = Math.max(...incomeData, ...expenseData, 1000);
    
    ctx.clearRect(0, 0, width, height);
    
    // 绘制网格
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#243140';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
    }
    
    // 绘制折线
    const padding = 40;
    const chartWidth = width - padding - 20;
    const chartHeight = height - padding - 20;
    
    ctx.lineWidth = 2;
    const divisor = Math.max(1, incomeData.length - 1);
    // 收入线（绿色）
    ctx.strokeStyle = '#16a34a';
    ctx.beginPath();
    incomeData.forEach((val, i) => {
        const x = padding + (chartWidth / divisor) * i;
        const y = padding + chartHeight - (maxValue > 0 ? (val / maxValue) * chartHeight : 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 支出线（红色）
    ctx.strokeStyle = '#ef4444';
    ctx.beginPath();
    expenseData.forEach((val, i) => {
        const x = padding + (chartWidth / divisor) * i;
        const y = padding + chartHeight - (maxValue > 0 ? (val / maxValue) * chartHeight : 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 绘制标签
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#9fb3c8';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    const monthDivisor = Math.max(1, months.length - 1);
    months.forEach((m, i) => {
        const x = padding + (chartWidth / monthDivisor) * i;
        ctx.fillText(m, x, height - 5);
    });
}

function renderPieChart() {
    const canvas = $('#pieChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 获取实际尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = 260 * (window.devicePixelRatio || 1);
    const scale = window.devicePixelRatio || 1;
    ctx.scale(scale, scale);
    
    const width = canvas.width / scale;
    const height = canvas.height / scale;
    
    const CATS = ['餐饮', '交通', '居住', '数码', '服饰', '娱乐', '教育', '亲友代付', '医疗', '日用', '旅行', '其他'];
    const data = CATS.map(cat => {
        const spent = state.txs
            .filter(t => t.category === cat && t.side === 'out')
            .reduce((sum, t) => {
                const acc = state.accounts.find(a => a.id === t.accountId);
                if (!acc) return sum;
                const v = amountToBase(t.amount, acc.currency);
                return sum + (v || 0);
            }, 0);
        return { category: cat, value: spent };
    }).filter(d => d.value > 0);
    
    if (data.length === 0) {
        ctx.clearRect(0, 0, width, height);
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#9fb3c8';
        ctx.fillStyle = mutedColor;
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('暂无支出数据', width / 2, height / 2);
        return;
    }
    
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const colors = ['#4c8bf5', '#7aa8ff', '#16a34a', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#10b981', '#f97316', '#6366f1', '#8b5cf6'];
    
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    let currentAngle = -Math.PI / 2;
    data.forEach((d, i) => {
        const sliceAngle = (d.value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        currentAngle += sliceAngle;
    });
}

function renderAcctDonut() {
    const canvas = $('#acctDonut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const accounts = state.accounts.filter(a => a.includeInNetWorth !== false);
    
    // 获取实际尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio || 400;
    canvas.height = 260 * window.devicePixelRatio || 260;
    const scale = window.devicePixelRatio || 1;
    ctx.scale(scale, scale);
    
    if (accounts.length === 0) {
        ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale);
        const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#9fb3c8';
        ctx.fillStyle = mutedColor;
        ctx.font = '14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('暂无账户数据', (canvas.width / scale) / 2, (canvas.height / scale) / 2);
        return;
    }
    
    const data = accounts.map(a => {
        const bal = accountBalance(a);
        const baseVal = amountToBase(bal, a.currency);
        return { name: a.name, value: baseVal || 0, currency: a.currency };
    }).filter(d => d.value > 0);
    
    if (data.length === 0) {
        ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale);
        return;
    }
    
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const colors = ['#4c8bf5', '#7aa8ff', '#16a34a', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];
    
    ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale);
    const centerX = (canvas.width / scale) / 2;
    const centerY = (canvas.height / scale) / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    let currentAngle = -Math.PI / 2;
    data.forEach((d, i) => {
        const sliceAngle = (d.value / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        currentAngle += sliceAngle;
    });
    
    // 渲染图例
    const legend = $('#acctLegend');
    if (legend) {
        legend.innerHTML = data.map((d, i) => `
            <div class="item">
                <span class="swatch" style="background:${colors[i % colors.length]}"></span>
                <span>${d.name}: ${fmtAmount(d.value, state.prefs.baseCurrency, mask, state.prefs.baseCurrency)}</span>
            </div>
        `).join('');
    }
}

async function clearCurrentIdData() {
    if (!confirm(`确定要清空ID "${state.profileId}" 的所有数据吗？此操作不可恢复！`)) return;
    
    // 删除当前profileId的所有账户
    const accsToDelete = state.accounts.filter(a => (a.profileId || 'default') === state.profileId);
    for (const acc of accsToDelete) {
        await idb.del('accounts', acc.id);
    }
    
    // 删除当前profileId的所有交易
    const txsToDelete = state.txs.filter(t => (t.profileId || 'default') === state.profileId);
    for (const tx of txsToDelete) {
        await idb.del('transactions', tx.id);
    }
    
    // 重新加载
    await loadProfile(state.profileId);
    renderAll();
}

// 启动程序
boot();