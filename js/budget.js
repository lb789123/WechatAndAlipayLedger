// ====== 预算管理 ======
async function onSaveBudget(e){ 
  e.preventDefault();
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  const cat=$('#bdg_category').value; 
  const amt=parseFloat($('#bdg_amount').value)||0;
  const key=pkey('bdg:'+cat);
  const rec={key, profileId:state.profileId, category:cat, amount:amt};
  await window.idb.put('budgets',rec);
  state.budgets[cat]=amt;
  endEditBudget();
  if(window.renderBudget) window.renderBudget();
  alert('预算已保存');
}

function startEditBudget(cat){
    // 展开预算设置卡片
  const budgetFormCard = $('#budgetFormCard');
  if (budgetFormCard && budgetFormCard.classList.contains('collapsed')) {
    budgetFormCard.classList.remove('collapsed');
  }
  if(!window.pkey) return;
  const pkey = window.pkey;
  $('#bdg_edit_key').value=pkey('bdg:'+cat);
  $('#bdg_category').value=cat;
  if(window.state) $('#bdg_amount').value=window.state.budgets[cat]||0;
  $('#bdgEditingPill').parentElement.classList.add('editing');
  $('#bdgEditingPill').style.display='inline-flex';
  $('#btnCancelEditBudget').style.display='inline-block';
  $('#sec-budget').classList.add('active');
  $$('#tabs button').forEach(btn=>btn.classList.toggle('active', btn.dataset.target==='#sec-budget'));
  $('#bdg_amount').focus();
}

function endEditBudget(){
  $('#bdg_edit_key').value='';
  document.getElementById('budgetForm').reset();
  $('#bdgEditingPill').parentElement.classList.remove('editing');
  $('#bdgEditingPill').style.display='none';
  $('#btnCancelEditBudget').style.display='none';

    // 结束编辑后收起预算设置卡片
    const budgetFormCard = $('#budgetFormCard');
    if (budgetFormCard) {
      budgetFormCard.classList.add('collapsed');    
    }
}

async function deleteBudget(cat){
  if(!window.pkey) return;
  const pkey = window.pkey;
  const key=pkey('bdg:'+cat);
  if(!confirm('删除该类别预算？')) return;
  await window.idb.del('budgets',key);
  if(window.state) delete window.state.budgets[cat];
  if(window.renderBudget) window.renderBudget();
}

// 暴露到全局
window.onSaveBudget = onSaveBudget;
window.startEditBudget = startEditBudget;
window.endEditBudget = endEditBudget;
window.deleteBudget = deleteBudget;
