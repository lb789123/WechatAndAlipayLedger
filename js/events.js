// ====== 事件绑定 ======
function bindEvents(){
  $$('[data-nav]').forEach(b=>b.onclick=()=>{ 
    $$('.section').forEach(s=>s.classList.remove('active')); 
    $(b.dataset.nav).classList.add('active'); 
    $$('#tabs button').forEach(btn=>btn.classList.toggle('active', btn.dataset.target===b.dataset.nav)); 
    if(b.dataset.nav==='#sec-reports' && window.renderReports){ window.renderReports(); } 
    if(b.dataset.nav==='#sec-dashboard' && window.renderAcctDonut){ window.renderAcctDonut(); }
    if(b.dataset.nav==='#sec-settings' && window.renderCategoriesTable){ window.renderCategoriesTable(); }
  });

  $('#switchIdBtn').onclick=async ()=>{
    if(!window.state) return;
    const id=prompt('输入要切换/新建的 ID：', window.state.profileId);
    if(id==null) return;
    const rid=(id.trim()||'default').slice(0,40);
    if(window.loadProfile) await window.loadProfile(rid);
    if(window.renderAll) window.renderAll();
  };

  $('#toggleMaskBtn').onclick=()=>{
    if(typeof window !== 'undefined' && window.mask !== undefined){
      window.mask=!window.mask; 
      if(window.renderAll) window.renderAll(); 
      $('#maskAmounts').value=String(window.mask); 
      if(window.savePrefs) window.savePrefs();
    }
  };
  
  $('#toggleThemeBtn').onclick=()=>{ 
    if(!window.state) return;
    const next= window.state.prefs.theme==='dark' ? 'light':'dark'; 
    if(window.applyTheme) window.applyTheme(next); 
    $('#themeSelect').value=next; 
    if(window.savePrefs) window.savePrefs(); 
  };

  $('#btnAddAccount').onclick=()=>{$('#accountForm').scrollIntoView({behavior:'smooth'});$('#acc_name').focus();};
  $('#btnResetAccountForm').onclick=()=>{if(window.resetAccountForm) window.resetAccountForm();};
  $('#accountForm').onsubmit=onSaveAccount;

  $('#tx_type').onchange=()=>{if(window.toggleTransferFields) window.toggleTransferFields();};
  $('#txnForm').onsubmit=saveTransaction;
  $('#btnResetTx').onclick=()=>{if(window.endEditTx) window.endEditTx();};
  $('#btnCancelEditTx').onclick=()=>{if(window.endEditTx) window.endEditTx();};
  
  document.addEventListener('keydown',e=>{
    if(e.key.toLowerCase()==='n'){ 
      $('#tx_amount').focus(); 
      $('#sec-trans').classList.add('active'); 
      $$('#tabs button').forEach(btn=>btn.classList.toggle('active', btn.dataset.target==='#sec-trans')); 
    }
  });

  $('#btnClearFilter').onclick=()=>{ $('#filter_account').value=''; $('#filter_kw').value=''; if(window.renderTxTable) window.renderTxTable(); };
  $('#filter_account').onchange=()=>{if(window.renderTxTable) window.renderTxTable();}; 
  $('#filter_kw').oninput=()=>{if(window.renderTxTable) window.renderTxTable();};

  $('#budgetForm').onsubmit=onSaveBudget;
  $('#btnResetBudget').onclick=()=>{if(window.endEditBudget) window.endEditBudget();};
  $('#btnCancelEditBudget').onclick=()=>{if(window.endEditBudget) window.endEditBudget();};
  
  // 预算月份选择器
  const budgetMonthSelector = $('#budgetMonthSelector');
  if(budgetMonthSelector){
    // 设置默认值为当前月
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    budgetMonthSelector.value = `${year}-${month}`;
    
    budgetMonthSelector.onchange = (e)=>{
      const monthValue = e.target.value;
      if(monthValue){
        if(window.renderBudget) window.renderBudget(monthValue);
        // 关闭已打开的明细
        if(window.closeBudgetDetail) window.closeBudgetDetail();
      }
    };
  }
  
  // 重置到当前月按钮
  $('#btnResetBudgetMonth').onclick = ()=>{
    if(budgetMonthSelector){
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      budgetMonthSelector.value = `${year}-${month}`;
      if(window.renderBudget) window.renderBudget(null);
      if(window.closeBudgetDetail) window.closeBudgetDetail();
    }
  };
  
  // 关闭预算明细按钮
  $('#btnCloseBudgetDetail').onclick = ()=>{
    if(window.closeBudgetDetail) window.closeBudgetDetail();
  };

  $('#prefsForm').onsubmit=onSavePrefs;

  $('#fxForm').onsubmit=saveFxRate; 
  $('#fxReset').onclick=()=>{$('#fx_quote').value=''; $('#fx_rate').value='';};
  $('#fxFetchAccounts').onclick=async ()=>{
    if(!window.state) return;
    const base=window.state.prefs.baseCurrency;
    const quotes=[...new Set(window.state.accounts.map(a=>a.currency).filter(c=>c!==base))];
    if(quotes.length===0){ alert('没有需要更新的外币账户'); return; }
    if(window.updateFxFromNetwork) await window.updateFxFromNetwork(quotes);
  };
  $('#fxFetchAll').onclick=async ()=>{
    if(!window.state) return;
    const base=window.state.prefs.baseCurrency;
    const COMMON=['USD','EUR','HKD','JPY','GBP','AUD','CAD','SGD','TWD','KRW'];
    const quotes=COMMON.filter(c=>c!==base);
    if(window.updateFxFromNetwork) await window.updateFxFromNetwork(quotes);
  };

  const btnImp = document.getElementById('btnImportTx');
  const inputImp = document.getElementById('importTxFile');
  if(btnImp && inputImp){
    btnImp.onclick = ()=> inputImp.click();
    inputImp.onchange = async (e)=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      if(window.importTxFromXLSX) await window.importTxFromXLSX(f);
      e.target.value = '';
    };
  }

  // XLSX 映射弹窗事件
  $('#btnCloseMappingModal').onclick = ()=>{
    if(window.closeXlsxMappingModal) window.closeXlsxMappingModal();
  };
  
  $('#btnCancelMapping').onclick = ()=>{
    if(window.closeXlsxMappingModal) window.closeXlsxMappingModal();
  };
  
  // 点击弹窗外部关闭（阻止事件冒泡到内容区）
  const modal = $('#xlsxMappingModal');
  if(modal){
    modal.onclick = (e)=>{
      if(e.target.id === 'xlsxMappingModal' || e.target.classList.contains('modal')){
        if(window.closeXlsxMappingModal) window.closeXlsxMappingModal();
      }
    };
    // 阻止内容区的点击事件冒泡
    const modalContent = modal.querySelector('.modal-content');
    if(modalContent){
      modalContent.onclick = (e)=>{
        e.stopPropagation();
      };
    }
  }
  
  // 确认导入按钮
  $('#btnConfirmMapping').onclick = async ()=>{
    if(!window.parsedXlsxData || !Array.isArray(window.parsedXlsxData)){
      alert('数据已丢失，请重新选择文件。');
      return;
    }
    
    // 收集映射关系
    const mapping = {
      date: $('#map_date').value || '',
      type: $('#map_type').value || '',
      target: $('#map_target').value || '',
      amount: $('#map_amount').value || '',
      category: $('#map_category').value || '',
      payee: $('#map_payee').value || '',
      memo: $('#map_memo').value || ''
    };
    
    // 获取来源账户（从输入框）
    const accountName = $('#map_account').value?.trim() || '';
    
    // 验证必填字段
    if(!mapping.date || !accountName || !mapping.amount){
      alert('请至少完成以下必填项：日期、来源账户、金额（标有*的为必填项）');
      return;
    }
    
    // 执行导入
    if(window.executeXlsxImportWithMapping){
      await window.executeXlsxImportWithMapping(window.parsedXlsxData, mapping, accountName);
    }
  };

  window.addEventListener('resize',()=>{ 
    if($('#sec-reports').classList.contains('active') && window.renderReports){ window.renderReports(); } 
    if($('#sec-dashboard').classList.contains('active') && window.renderAcctDonut){ window.renderAcctDonut(); } 
  });
  
  // 分类管理事件
  $('#btnAddCategory').onclick=()=>{
    $('#categoryForm').scrollIntoView({behavior:'smooth'});
    $('#cat_name').focus();
    $('#cat_edit_name').value='';
    $('#cat_name').value='';
  };
  
  $('#btnCancelCategory').onclick=()=>{
    $('#categoryForm').reset();
    $('#cat_edit_name').value='';
  };
  
  $('#categoryForm').onsubmit=async (e)=>{
    e.preventDefault();
    const name=$('#cat_name').value.trim();
    const editName=$('#cat_edit_name').value;
    
    if(!name){
      alert('请输入分类名称');
      return;
    }
    
    if(editName){
      // 编辑模式
      if(window.renameCategory){
        const success = await window.renameCategory(editName, name);
        if(success){
          $('#categoryForm').reset();
          $('#cat_edit_name').value='';
          if(window.renderCategoriesTable) window.renderCategoriesTable();
          alert('分类已更新');
        }
      }
    } else {
      // 新增模式
      if(window.addCategory){
        const success = await window.addCategory(name);
        if(success){
          $('#categoryForm').reset();
          if(window.renderCategoriesTable) window.renderCategoriesTable();
          alert('分类已添加');
        }
      }
    }
  };
  
  $('#btnResetCategories').onclick=async ()=>{
    if(window.resetCategories){
      await window.resetCategories();
      if(window.renderCategoriesTable) window.renderCategoriesTable();
    }
  };
}

async function onSavePrefs(e){ 
  e.preventDefault(); 
  if(!window.state) return;
  const state = window.state;
  const oldBase=state.prefs.baseCurrency;
  state.prefs.baseCurrency=$('#baseCurrency').value;
  state.prefs.maskAmounts=$('#maskAmounts').value==='true';
  state.prefs.theme=$('#themeSelect').value;
  if(typeof window !== 'undefined') window.mask=state.prefs.maskAmounts; 
  if(window.applyTheme) window.applyTheme(state.prefs.theme);
  if(window.savePrefs) await window.savePrefs(); 
  if(window.renderAll) window.renderAll();
  if(oldBase!==state.prefs.baseCurrency){ alert('已更改基准货币：请在"汇率管理"联网更新或手动填入外币→基准汇率。'); }
}

async function saveFxRate(e){
  e.preventDefault();
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  let q=($('#fx_quote').value||'').trim().toUpperCase(); const r=parseFloat($('#fx_rate').value);
  if(!q||!(r>0)){ alert('请填写外币代码与正确汇率'); return; }
  if(q===state.prefs.baseCurrency){ alert('无需为基准货币设置汇率'); return; }
  const rec={key:pkey('fx:'+q), profileId:state.profileId, quote:q, rate:r, updatedAt:new Date().toISOString()};
  await window.idb.put('fxrates',rec); state.fxrates[q]=r; 
  if(window.renderAll) window.renderAll(); 
  alert('汇率已保存');
}

// 暴露到全局
window.bindEvents = bindEvents;
window.onSavePrefs = onSavePrefs;
window.saveFxRate = saveFxRate;
