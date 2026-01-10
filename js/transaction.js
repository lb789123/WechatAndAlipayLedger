// ====== 交易管理 ======
function toggleTransferFields(){
  const isT=$('#tx_type').value==='transfer' || $('#tx_edit_transfer').value==='1';
  $$('.transfer-only').forEach(x=>x.style.display=isT?'block':'none');
  $$('.non-transfer').forEach(x=>x.style.display=isT?'none':'block');
  if($('#tx_edit_transfer').value==='1'){
    $('#tx_type').disabled=true;
  }else{
    $('#tx_type').disabled=false;
  }
}

function startEditTx(t){
  if(!window.state) return;
  $('#sec-trans').classList.add('active');
  $$('#tabs button').forEach(btn=>btn.classList.toggle('active', btn.dataset.target==='#sec-trans'));
  document.getElementById('txnForm').classList.add('editing');
  $('#txEditingPill').parentElement.classList.add('editing');
  $('#txEditingPill').style.display='inline-flex';
  $('#btnCancelEditTx').style.display='inline-block';

  $('#tx_edit_id').value=t.id;
  $('#tx_edit_peer_id').value=t.transferPeerId||'';
  $('#tx_edit_transfer').value=t.isTransfer?'1':'';

  $('#tx_date').value=t.date;
  $('#tx_amount').value=String(t.amount);
  $('#tx_payee').value=t.payee||'';
  $('#tx_memo').value=t.memo||'';

  if(t.isTransfer){
    $('#tx_type').value='transfer';
    $('#tx_account').value=t.side==='out'? t.accountId : (t.transferPeerId? window.state.txs.find(x=>x.id===t.transferPeerId)?.accountId : '');
    const peer = t.side==='out'? (t.transferPeerId? window.state.txs.find(x=>x.id===t.transferPeerId) : null) : t;
    $('#tx_target').value=peer? peer.accountId : '';
  }else{
    $('#tx_type').value=t.side==='in' ? 'in' : 'out';
    $('#tx_account').value=t.accountId;
    $('#tx_category').value=t.category||$('#tx_category').value;
  }
  toggleTransferFields();
}

function endEditTx(){
  $('#tx_edit_id').value=''; $('#tx_edit_peer_id').value=''; $('#tx_edit_transfer').value='';
  $('#txnForm').reset(); $('#tx_date').value=todayStr();
  $('#tx_type').disabled=false;
  document.getElementById('txnForm').classList.remove('editing');
  $('#txEditingPill').parentElement.classList.remove('editing');
  $('#txEditingPill').style.display='none';
  $('#btnCancelEditTx').style.display='none';
  toggleTransferFields();
}

async function saveTransaction(e){
  e.preventDefault();
  if(!window.state) return;
  const state = window.state;
  const isEditing = !!$('#tx_edit_id').value;
  const editingIsTransfer = $('#tx_edit_transfer').value==='1';
  const type=$('#tx_type').value;
  const accId=$('#tx_account').value; if(!accId){alert('请选择账户'); return;}
  const date=$('#tx_date').value||todayStr();
  const amt=parseFloat($('#tx_amount').value); if(!(amt>0)){alert('请输入金额'); return;}
  const payee=$('#tx_payee').value.trim(); const memo=$('#tx_memo').value.trim();

  if(isEditing){
    if(editingIsTransfer){
      const id1=$('#tx_edit_id').value;
      const id2=$('#tx_edit_peer_id').value;
      const t1=state.txs.find(x=>x.id===id1);
      const t2=state.txs.find(x=>x.id===id2);
      if(!t1 || !t2){ alert('找不到需要编辑的转账记录'); return; }
      const out = t1.side==='out'? t1 : t2;
      const inn = t1.side==='in' ? t1 : t2;
      out.date=date; out.accountId=accId; out.amount=amt; out.payee=payee; out.memo=memo;
      inn.date=date; inn.accountId=$('#tx_target').value; inn.amount=amt; inn.payee=payee; inn.memo=memo;
      await window.idb.put('transactions',out); await window.idb.put('transactions',inn);
      const i1=state.txs.findIndex(x=>x.id===out.id); if(i1>=0) state.txs[i1]=out;
      const i2=state.txs.findIndex(x=>x.id===inn.id); if(i2>=0) state.txs[i2]=inn;
      endEditTx(); if(window.renderAll) window.renderAll(); alert('转账已更新');
      return;
    }else{
      const id=$('#tx_edit_id').value;
      const t=state.txs.find(x=>x.id===id);
      if(!t){ alert('找不到需要编辑的记录'); return; }
      if(type==='transfer'){ alert('正在编辑的记录不能改为"转账"。如需转账，请新建一条。'); return; }
      t.date=date; t.accountId=accId; t.amount=amt; t.payee=payee; t.memo=memo; t.side=type; t.category=$('#tx_category').value;
      await window.idb.put('transactions',t);
      const idx=state.txs.findIndex(x=>x.id===id); if(idx>=0) state.txs[idx]=t;
      endEditTx(); if(window.renderAll) window.renderAll(); alert('流水已更新');
      return;
    }
  }

  // 新增
  if(type==='transfer'){
    const target=$('#tx_target').value; if(!target||target===accId){alert('请选择不同的目标账户'); return;}
    const id1=uid(), id2=uid();
    const tOut={id:id1,profileId:state.profileId,date,accountId:accId,side:'out',amount:amt,category:'转账-出',payee,memo,isTransfer:true,transferPeerId:id2,createdAt:new Date().toISOString()};
    const tIn ={id:id2,profileId:state.profileId,date,accountId:target,side:'in', amount:amt,category:'转账-入',payee,memo,isTransfer:true,transferPeerId:id1,createdAt:new Date().toISOString()};
    await window.idb.put('transactions',tOut); await window.idb.put('transactions',tIn);
    state.txs.push(tOut,tIn);
  } else {
    const t={id:uid(),profileId:state.profileId,date,accountId:accId,side:type,amount:amt,category:$('#tx_category').value,payee,memo,isTransfer:false,createdAt:new Date().toISOString()};
    await window.idb.put('transactions',t); state.txs.push(t);
  }
  $('#txnForm').reset(); $('#tx_date').value=todayStr(); 
  if(window.renderAll) window.renderAll(); 
  alert('已保存');
}

// Excel 日期转换
function excelDateToJS(serial){
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

// 全局变量：存储解析后的Excel数据
window.parsedXlsxData = null;

// 显示表头映射弹窗
function showXlsxMappingModal(rows, headerKeys){
  if(!rows || rows.length === 0 || !headerKeys || headerKeys.length === 0) return;
  
  const modal = $('#xlsxMappingModal');
  const previewTable = $('#xlsxPreviewTable');
  
  // 显示预览数据（前3行）
  previewTable.innerHTML = '';
  const previewRows = rows.slice(0, 3);
  
  headerKeys.forEach(headerKey => {
    const tr = document.createElement('tr');
    const previewValues = previewRows.map((row, idx) => {
      const val = row[headerKey];
      let displayVal = '';
      if(val === null || val === undefined || val === ''){
        displayVal = '<span class="muted">-</span>';
      } else if(val instanceof Date){
        displayVal = val.toISOString().slice(0, 10);
      } else {
        const str = String(val);
        displayVal = str.length > 20 ? str.slice(0, 20) + '...' : str;
      }
      return `${idx + 1}. ${displayVal}`;
    }).join('<br/>');
    
    tr.innerHTML = `
      <td><strong>${headerKey}</strong></td>
      <td style="text-align:right;color:var(--muted);font-size:12px;line-height:1.6">${previewValues}</td>
    `;
    previewTable.appendChild(tr);
  });
  
  // 如果没有数据行，显示提示
  if(previewRows.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="2" style="text-align:center;color:var(--muted)">表格没有数据行</td>`;
    previewTable.appendChild(tr);
  }
  
  // 填充账户列表（用于输入框的自动完成）
  const accountList = $('#accountList');
  if(accountList && window.state){
    accountList.innerHTML = '';
    window.state.accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.name;
      accountList.appendChild(opt);
    });
    
    // 如果有账户，默认选择第一个
    const accountInput = $('#map_account');
    if(accountInput && window.state.accounts.length > 0){
      accountInput.value = window.state.accounts[0].name;
    }
  }
  
  // 填充映射选择器（不包括account，因为改为输入框了）
  const mappingFields = ['date', 'type', 'target', 'amount', 'category', 'payee', 'memo'];
  const smartMatches = {}; // 存储智能匹配结果
  
  mappingFields.forEach(field => {
    const select = $(`#map_${field}`);
    if(!select) return;
    
    select.innerHTML = field === 'type' || field === 'target' || field === 'category' || field === 'payee' || field === 'memo' 
      ? '<option value="">不映射</option>' 
      : '';
    
    headerKeys.forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      
      // 尝试智能匹配
      const keyLower = key.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]/g,'');
      let matched = false;
      
      if(field === 'date' && /日期|date|时间|time|发生/.test(keyLower) && !smartMatches.date){
        opt.selected = true;
        smartMatches.date = key;
        matched = true;
      } else if(field === 'type' && /类型|type|收支|交易类型/.test(keyLower) && !smartMatches.type){
        opt.selected = true;
        smartMatches.type = key;
        matched = true;
      } else if(field === 'target' && /目标|target|to|转入/.test(keyLower) && !smartMatches.target){
        opt.selected = true;
        smartMatches.target = key;
        matched = true;
      } else if(field === 'amount' && /金额|amount|数额|money|value/.test(keyLower) && !smartMatches.amount){
        opt.selected = true;
        smartMatches.amount = key;
        matched = true;
      } else if(field === 'category' && /分类|类别|category/.test(keyLower) && !smartMatches.category){
        opt.selected = true;
        smartMatches.category = key;
        matched = true;
      } else if(field === 'payee' && /对方|payee|收款人|付款方/.test(keyLower) && !smartMatches.payee){
        opt.selected = true;
        smartMatches.payee = key;
        matched = true;
      } else if(field === 'memo' && /备注|说明|memo|摘要|描述/.test(keyLower) && !smartMatches.memo){
        opt.selected = true;
        smartMatches.memo = key;
        matched = true;
      }
      
      select.appendChild(opt);
    });
    
    // 如果没有匹配到，默认选择第一列（仅必需字段）
    if((field === 'date' || field === 'amount') && !smartMatches[field] && headerKeys.length > 0){
      // 选择一个还未被使用的列
      let defaultKey = null;
      const usedKeys = Object.values(smartMatches);
      for(const key of headerKeys){
        if(!usedKeys.includes(key)){
          defaultKey = key;
          break;
        }
      }
      if(defaultKey && select.querySelector(`option[value="${defaultKey}"]`)){
        select.value = defaultKey;
        smartMatches[field] = defaultKey;
      }
    }
  });
  
  // 显示弹窗
  modal.style.display = 'flex';
  
  // 存储解析后的数据
  window.parsedXlsxData = rows;
}

// 关闭映射弹窗
function closeXlsxMappingModal(){
  const modal = $('#xlsxMappingModal');
  modal.style.display = 'none';
  window.parsedXlsxData = null;
  
  // 清空表单
  const mappingFields = ['date', 'type', 'target', 'amount', 'category', 'payee', 'memo'];
  mappingFields.forEach(field => {
    const select = $(`#map_${field}`);
    if(select) select.value = '';
  });
  const accountInput = $('#map_account');
  if(accountInput) accountInput.value = '';
  
  const previewTable = $('#xlsxPreviewTable');
  if(previewTable) previewTable.innerHTML = '';
}

// 根据映射执行导入
async function executeXlsxImportWithMapping(rows, mapping, accountName){
  if(!window.state) return;
  const state = window.state;
  
  if(!mapping.date || !accountName || !mapping.amount){
    alert('日期、来源账户和金额为必填字段，请先完成映射。');
    return;
  }
  
  // 验证分类是否存在，如果不存在则设置为"其他"
  // function validateCategory(catName){
  //   if(!catName || !catName.trim()) return '其他'; // 空分类默认设为"其他"
  //   const trimmed = catName.trim();
  //   // 检查分类是否在分类列表中
  //   if(state.categories && state.categories.length > 0){
  //     if(state.categories.includes(trimmed)){
  //       return trimmed;
  //     }
  //   }
  //   // 如果不在分类列表中，返回"其他"
  //   // 确保"其他"分类存在于分类列表中（如果不存在则添加）
  //   if(!state.categories.includes('其他')){
  //     state.categories.push('其他');
  //     const pkey = window.pkey || ((k)=> `${state.profileId}::${k}`);
  //     window.idb.setPrefRaw(pkey('categories'), state.categories).catch(()=>{});
  //     // 更新分类选择器
  //     if(window.updateCategorySelects) window.updateCategorySelects();
  //   }
  //   return '其他';
  // }
  // 验证分类是否存在，如果不存在则设置为"其他"
function validateCategory(catName){
  if(!catName || !catName.trim()) return '其他'; // 空分类默认设为"其他"
  const trimmed = catName.trim();

  // 1) 直接名称匹配（精确）
  if(state.categories && state.categories.includes(trimmed)){
    return trimmed;
  }

  // 2) 如果可用，先使用全局智能匹配函数（优先）
  if(typeof window.findCategoryByLabel === 'function'){
    try{
      const matched = window.findCategoryByLabel(trimmed);
      if(matched) return matched;
    }catch(_){}
  }

  // 3) 基于别名映射的归一化匹配（兜底）
  const norm = x => String(x||'').toLowerCase().replace(/\s+/g,'').replace(/[^\w\u4e00-\u9fa5]/g,'');
  const inorm = norm(trimmed);

  if(state.categoryAliases && typeof state.categoryAliases === 'object'){
    for(const [cat, aliases] of Object.entries(state.categoryAliases)){
      if(!Array.isArray(aliases) || aliases.length === 0) continue;
      for(const a of aliases){
        if(!a) continue;
        const anorm = norm(a);
        if(!anorm) continue;
        // 精确归一化匹配
        if(anorm === inorm) return cat;
        // 别名是输入的子串（如输入包含别名），提高命中率
        if(inorm.includes(anorm)) return cat;
        // 反向：别名中包含输入（短输入可能匹配别名）
        if(anorm.includes(inorm) && inorm.length >= 2) return cat;
      }
    }
  }

  // 4) 都没匹配到，确保 '其他' 存在并返回它（并保存到 prefs）
  if(!state.categories.includes('其他')){
    state.categories.push('其他');
    if(!state.categoryAliases) state.categoryAliases = {};
    if(!Array.isArray(state.categoryAliases['其他'])) state.categoryAliases['其他'] = [];
    const pkey = window.pkey || ((k)=> `${state.profileId}::${k}`);
    // 尝试保存 categories 与 cat_aliases（异步失败不影响流程）
    window.idb.setPrefRaw(pkey('categories'), state.categories).catch(()=>{});
    window.idb.setPrefRaw(pkey('cat_aliases'), state.categoryAliases).catch(()=>{});
    if(window.updateCategorySelects) window.updateCategorySelects();
  }
  return '其他';
}
  // 查找或创建来源账户
  const accName = String(accountName).trim();
  if(!accName){
    alert('请输入来源账户名称');
    return;
  }
  
  let acc = state.accounts.find(a=>a.name === accName);
  if(!acc){
    // 询问是否创建新账户
    if(!confirm(`账户"${accName}"不存在，是否创建新账户？`)){
      return;
    }
    const newAcc = {id:uid(), profileId:state.profileId, name: accName, type:'other', currency: state.prefs.baseCurrency, includeInNetWorth:true, openingBalance:0, createdAt:new Date().toISOString(), sort: (state.accounts.length+1)*10};
    await window.idb.put('accounts', newAcc);
    state.accounts.push(newAcc);
    acc = newAcc;
  }
  
  const toWrite = [];
  const createdAccounts = [];
  
  for(const row of rows){
    // 日期处理
    const rawDate = row[mapping.date];
    let dateStr = todayStr();
    if(rawDate instanceof Date){
      dateStr = rawDate.toISOString().slice(0,10);
    } else if(typeof rawDate === 'number'){
      try{ dateStr = excelDateToJS(rawDate).toISOString().slice(0,10); }catch(e){ dateStr = String(rawDate).slice(0,10); }
    } else {
      const s = String(rawDate||'').trim();
      if(s) {
        const p = s.replace(/\./g,'-').replace(/\//g,'-').match(/(\d{4}-\d{1,2}-\d{1,2})/);
        if(p) dateStr = p[1];
        else{
          const d = new Date(s);
          if(!isNaN(d)) dateStr = d.toISOString().slice(0,10);
          else dateStr = todayStr();
        }
      } else dateStr = todayStr();
    }

    // 类型处理
    let side = 'out';
    if(mapping.type){
      const rawType = String(row[mapping.type]||'').trim();
      if(/收入|in|receive|rcv/i.test(rawType)) side = 'in';
      else if(/转账|transfer|转/i.test(rawType)) side = 'transfer';
      else if(/支出|out|pay|expense/i.test(rawType)) side = 'out';
    }
    
    // 目标账户（转账时使用）
    const targetName = mapping.target ? String(row[mapping.target]||'').trim() : '';

    // 金额处理
    let amtRaw = row[mapping.amount];
    let amount = 0;
    if(typeof amtRaw === 'number') amount = amtRaw;
    else{
      const s = String(amtRaw||'').replace(/[^\d\.\-]/g,'').replace(/,+/g,'');
      amount = Number(s) || 0;
    }
    
    if(amount <= 0){
      continue; // 跳过无效金额
    }

    // 其他字段
    const rawCategory = mapping.category ? String(row[mapping.category]||'').trim() : '';
    const category = validateCategory(rawCategory); // 验证分类，不存在则设为"其他"
    const payee = mapping.payee ? String(row[mapping.payee]||'').trim() : '';
    const memo = mapping.memo ? String(row[mapping.memo]||'').trim() : '';

    // 处理转账
    if(side === 'transfer'){
      const finalTarget = targetName || payee;
      if(!finalTarget || finalTarget === accName){
        continue; // 跳过无效转账
      }
      
      let tgt = state.accounts.find(a=>a.name === finalTarget);
      if(!tgt){
        const newT = {id:uid(), profileId:state.profileId, name: finalTarget, type:'other', currency: state.prefs.baseCurrency, includeInNetWorth:true, openingBalance:0, createdAt:new Date().toISOString(), sort: (state.accounts.length+1)*10};
        toWrite.push({__createAccount:newT});
        state.accounts.push(newT); 
        tgt = newT; 
        createdAccounts.push(newT.name);
      }
      
      const id1 = uid(), id2 = uid();
      // 转账的分类：如果有映射的分类就用映射的（但会验证），否则用系统默认
      const transferCatOut = rawCategory ? validateCategory(rawCategory) : '转账-出';
      const transferCatIn = rawCategory ? validateCategory(rawCategory) : '转账-入';
      const tOut = {id:id1, profileId:state.profileId, date:dateStr, accountId:acc.id, side:'out', amount:amount, category: transferCatOut, payee: payee, memo: memo, isTransfer:true, transferPeerId:id2, createdAt:new Date().toISOString()};
      const tIn  = {id:id2, profileId:state.profileId, date:dateStr, accountId:tgt.id, side:'in',  amount:amount, category: transferCatIn,  payee: payee, memo: memo, isTransfer:true, transferPeerId:id1, createdAt:new Date().toISOString()};
      toWrite.push(tOut, tIn);
    } else {
      const t = {id:uid(), profileId:state.profileId, date:dateStr, accountId:acc.id, side: side, amount: amount, category: category, payee: payee, memo: memo, isTransfer:false, createdAt:new Date().toISOString()};
      toWrite.push(t);
    }
  }

  const txCount = toWrite.filter(x=>!x.__createAccount).length;
  const newAccCount = toWrite.filter(x=>x.__createAccount).length;
  
  if(txCount === 0){
    alert('没有有效的交易记录可以导入。');
    return;
  }
  
  if(!confirm(`将导入 ${txCount} 条流水，并创建 ${newAccCount} 个新账户（如果有）。继续？`)) return;

  // 执行导入
  for(const rec of toWrite){
    if(rec.__createAccount){
      await window.idb.put('accounts', rec.__createAccount);
    } else {
      await window.idb.put('transactions', rec);
      state.txs.push(rec);
    }
  }

  closeXlsxMappingModal();
  if(window.renderAll) window.renderAll();
  alert(`导入完成：${txCount} 条流水，创建账户 ${newAccCount} 个（可能已有同名账户则不重复）。`);
}

// 导入 XLSX 流水（第一步：解析文件并显示映射弹窗）
async function importTxFromXLSX(file){
  if(typeof XLSX === 'undefined'){ alert('无法导入：缺少 XLSX 库'); return; }
  if(!window.state) return;
  
  try{
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array', cellDates:true});
    const sheetName = wb.SheetNames[0];
    if(!sheetName){ alert('工作簿没有工作表'); return; }
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {defval:'', raw:false});
    if(!rows || rows.length===0){ alert('表格无数据'); return; }

    const headerKeys = Object.keys(rows[0]);
    if(headerKeys.length === 0){ alert('表格没有列'); return; }

    // 显示映射弹窗
    showXlsxMappingModal(rows, headerKeys);
    
  }catch(err){
    console.error(err);
    alert('解析文件失败：' + (err && err.message ? err.message : err));
  }
}

// 暴露到全局
window.toggleTransferFields = toggleTransferFields;
window.startEditTx = startEditTx;
window.endEditTx = endEditTx;
window.saveTransaction = saveTransaction;
window.importTxFromXLSX = importTxFromXLSX;
window.closeXlsxMappingModal = closeXlsxMappingModal;
window.executeXlsxImportWithMapping = executeXlsxImportWithMapping;
