// ====== 导入/导出功能 ======
async function exportCurrentIdData(){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  const profile = state.profileId;
  const accounts = (await window.idb.getAll('accounts')).filter(x => (x.profileId||'default') === profile);
  const transactions = (await window.idb.getAll('transactions')).filter(x => (x.profileId||'default') === profile);
  const budgets = (await window.idb.getAll('budgets')).filter(x => x.profileId === profile);
  const fxrates = (await window.idb.getAll('fxrates')).filter(x => x.profileId === profile);
  const categories = await window.idb.getPrefRaw(pkey('categories'));
  const prefs = {
    baseCurrency: await window.idb.getPrefRaw(pkey('baseCurrency')),
    maskAmounts: await window.idb.getPrefRaw(pkey('maskAmounts')),
    theme: await window.idb.getPrefRaw(pkey('theme'))
  };
  const dump = {meta:{app:'ledger-adv', version:'v6.1', profileId:profile, exportedAt:new Date().toISOString()}, accounts, transactions, budgets, fxrates, categories, prefs};
  const blob = new Blob([JSON.stringify(dump,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ledger-export-${profile}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();}, 0);
}

async function importCurrentIdDataFromFile(file){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  try{
    const text = await file.text();
    let data;
    try{
      data = JSON.parse(text);
    }catch(parseErr){
      alert('导入失败：文件不是有效的 JSON。');
      return;
    }

    const prof = state.profileId;
    const metaOk = !data.meta || data.meta.app === 'ledger-adv';
    const ac = Array.isArray(data.accounts) ? data.accounts.length : 0;
    const tx = Array.isArray(data.transactions) ? data.transactions.length : 0;
    const bd = Array.isArray(data.budgets) ? data.budgets.length : 0;
    const fx = Array.isArray(data.fxrates) ? data.fxrates.length : 0;
    const msg = [
      '将导入数据到当前 ID：' + prof,
      `账户：${ac} 条`,
      `交易：${tx} 条`,
      `预算：${bd} 条`,
      `汇率：${fx} 条`,
      metaOk ? '' : '⚠️ 警告：文件来源不是本应用导出（meta.app≠ledger-adv），可能不兼容。'
    ].filter(Boolean).join('\n');

    if(!confirm(msg + '\n\n继续导入吗？（存在相同主键的记录将被覆盖；如需完全替换，请先导出备份后再"清空当前 ID 数据"再导入）')) return;

    const existingAccIds = new Set((state.accounts||[]).map(a=>a.id));
    const existingTxIds  = new Set((state.txs||[]).map(t=>t.id));

    const accountIdMap = {};
    if(Array.isArray(data.accounts)){
      for(const a of data.accounts){
        if(!a || !a.id) continue;
        a.profileId = prof;
        if(existingAccIds.has(a.id)){
          const oldId = a.id;
          a.id = uid();
          accountIdMap[oldId] = a.id;
        }
        await window.idb.put('accounts', a);
      }
    }

    if(Array.isArray(data.transactions)){
      const txIdMap = {};
      const staged = [];
      for(const t0 of data.transactions){
        if(!t0 || !t0.id) continue;
        const t = {...t0};
        t.profileId = prof;
        if(accountIdMap[t.accountId]) t.accountId = accountIdMap[t.accountId];
        if(existingTxIds.has(t.id)){
          const oldId = t.id;
          t.id = uid();
          txIdMap[oldId] = t.id;
        }
        staged.push(t);
      }
      for(const t of staged){
        if(t.transferPeerId && txIdMap[t.transferPeerId]) t.transferPeerId = txIdMap[t.transferPeerId];
        await window.idb.put('transactions', t);
      }
    }

    if(Array.isArray(data.budgets)){
      for(const b of data.budgets){
        if(!b || !b.category) continue;
        const rec = {key:pkey('bdg:'+b.category), profileId:prof, category:b.category, amount:Number(b.amount)||0};
        await window.idb.put('budgets', rec);
      }
    }

    if(Array.isArray(data.fxrates)){
      for(const r of data.fxrates){
        if(!r || !r.quote) continue;
        const rec = {key:pkey('fx:'+r.quote), profileId:prof, quote:r.quote, rate:Number(r.rate)||0, updatedAt:new Date().toISOString()};
        await window.idb.put('fxrates', rec);
      }
    }

    if(data.prefs && typeof data.prefs==='object'){
      if(data.prefs.baseCurrency) await window.idb.setPrefRaw(pkey('baseCurrency'), data.prefs.baseCurrency);
      if(typeof data.prefs.maskAmounts!=='undefined') await window.idb.setPrefRaw(pkey('maskAmounts'), !!data.prefs.maskAmounts);
      if(data.prefs.theme) await window.idb.setPrefRaw(pkey('theme'), data.prefs.theme);
      if(typeof applyTheme === 'function') try{ applyTheme(); }catch(_){}
    }

    // 导入分类
    if(data.categories && Array.isArray(data.categories) && data.categories.length > 0){
      await window.idb.setPrefRaw(pkey('categories'), data.categories);
      if(window.state) window.state.categories = data.categories;
      if(window.updateCategorySelects) window.updateCategorySelects();
    }

    if(window.loadProfile) await window.loadProfile(prof);
    if(window.renderAll) window.renderAll();
    if(window.renderCategoriesTable) window.renderCategoriesTable();
    alert('导入完成！');
  }catch(err){
    alert('导入失败：'+(err && err.message ? err.message : err));
  }
}

async function clearCurrentIdData(){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  if(!confirm(`确定要清空当前 ID（${state.profileId}）的账户/交易/预算/汇率数据吗？此操作不可撤销。建议先导出备份。`)) return;
  const prof = state.profileId;
  const delFromStore = async (store, keyField='id')=>{
    const all = await window.idb.getAll(store);
    const mine = all.filter(x => (x.profileId||'default') === prof);
    for(const rec of mine){ await window.idb.del(store, rec[keyField]); }
  };
  await delFromStore('accounts','id');
  await delFromStore('transactions','id');
  const allB = await window.idb.getAll('budgets'); for(const b of allB.filter(x=>x.profileId===prof)){ await window.idb.del('budgets', b.key); }
  const allF = await window.idb.getAll('fxrates'); for(const r of allF.filter(x=>x.profileId===prof)){ await window.idb.del('fxrates', r.key); }

  if(window.loadProfile) await window.loadProfile(prof);
  if(window.renderAll) window.renderAll();
  alert('已清空当前 ID 数据。');
}

// 暴露到全局
window.exportCurrentIdData = exportCurrentIdData;
window.importCurrentIdDataFromFile = importCurrentIdDataFromFile;
window.clearCurrentIdData = clearCurrentIdData;
