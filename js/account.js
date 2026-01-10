// ====== 账户管理 ======
function resetAccountForm(){ 
  $('#accountForm').reset(); 
  $('#acc_id').value=''; 
  if(window.state) $('#acc_currency').value=window.state.prefs.baseCurrency; 
}

async function onSaveAccount(e){
  e.preventDefault();
  if(!window.state) return;
  const state = window.state;
  const id=$('#acc_id').value||uid();
  const acc={
    id, profileId:state.profileId,
    name:$('#acc_name').value.trim()||'未命名',
    type:$('#acc_type').value,
    currency:$('#acc_currency').value,
    includeInNetWorth:$('#acc_in_net').value==='true',
    openingBalance:parseFloat($('#acc_opening').value)||0,
    sort:parseInt($('#acc_sort').value||0),
    createdAt:new Date().toISOString()
  };
  await window.idb.put('accounts',acc);
  const idx=state.accounts.findIndex(a=>a.id===id);
  if(idx>=0) state.accounts[idx]=acc; else state.accounts.push(acc);
  resetAccountForm(); 
  if(window.renderAll) window.renderAll(); 
  alert('账户已保存（ID：'+state.profileId+'）');
}

function accountBalance(acc){
  if(!window.state || !acc) return 0;
  let bal=Number(acc.openingBalance)||0;
  window.state.txs.filter(t=>t.accountId===acc.id).forEach(t=>{
    if(t.side==='in') bal+=Number(t.amount)||0; else if(t.side==='out') bal-=Number(t.amount)||0;
  });
  return bal;
}

// 暴露到全局
window.resetAccountForm = resetAccountForm;
window.onSaveAccount = onSaveAccount;
window.accountBalance = accountBalance;
