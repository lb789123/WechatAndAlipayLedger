// ====== 交易分类管理 ======
const DEFAULT_CATEGORIES = ['餐饮','交通','居住','数码','服饰','娱乐','教育','亲友代付','医疗','日用','旅行','其他'];

// 初始化分类（从数据库加载或使用默认值）
async function loadCategories(){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  
  // 尝试从数据库加载
  const stored = await window.idb.getPrefRaw(pkey('categories'));
  if(stored && Array.isArray(stored) && stored.length > 0){
    state.categories = stored;
  } else {
    // 使用默认分类
    state.categories = [...DEFAULT_CATEGORIES];
    // 保存默认分类到数据库
    await window.idb.setPrefRaw(pkey('categories'), state.categories);
  }
  
  // 更新分类选择器
  updateCategorySelects();
}

// 更新分类选择器
function updateCategorySelects(){
  if(!window.state) return;
  const state = window.state;
  const cats = state.categories.filter(c=>!c.startsWith('转账'));
  const opts = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  $('#tx_category').innerHTML = opts;
  $('#bdg_category').innerHTML = opts;
}

// 保存分类到数据库
async function saveCategories(){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  await window.idb.setPrefRaw(pkey('categories'), state.categories);
  updateCategorySelects();
}

// 添加分类
async function addCategory(name){
  if(!window.state) return false;
  const state = window.state;
  const trimmed = String(name||'').trim();
  if(!trimmed){
    alert('分类名称不能为空');
    return false;
  }
  if(state.categories.includes(trimmed)){
    alert('该分类已存在');
    return false;
  }
  state.categories.push(trimmed);
  await saveCategories();
  return true;
}

// 删除分类
async function deleteCategory(name){
  if(!window.state) return false;
  const state = window.state;
  if(!confirm(`确定要删除分类"${name}"吗？删除后，使用该分类的交易记录将显示为空分类。`)){
    return false;
  }
  const index = state.categories.indexOf(name);
  if(index >= 0){
    state.categories.splice(index, 1);
    await saveCategories();
    return true;
  }
  return false;
}

// 编辑分类（重命名）
async function renameCategory(oldName, newName){
  if(!window.state) return false;
  const state = window.state;
  const trimmed = String(newName||'').trim();
  if(!trimmed){
    alert('分类名称不能为空');
    return false;
  }
  if(state.categories.includes(trimmed) && trimmed !== oldName){
    alert('该分类名称已存在');
    return false;
  }
  
  const index = state.categories.indexOf(oldName);
  if(index >= 0){
    state.categories[index] = trimmed;
    await saveCategories();
    
    // 更新所有使用该分类的交易记录和预算
    for(const tx of state.txs){
      if(tx.category === oldName){
        tx.category = trimmed;
        await window.idb.put('transactions', tx);
      }
    }
    
    // 更新预算
    if(state.budgets[oldName] !== undefined){
      const amount = state.budgets[oldName];
      delete state.budgets[oldName];
      state.budgets[trimmed] = amount;
      const pkey = window.pkey;
      await window.idb.del('budgets', pkey('bdg:'+oldName));
      await window.idb.put('budgets', {
        key: pkey('bdg:'+trimmed),
        profileId: state.profileId,
        category: trimmed,
        amount: amount
      });
    }
    
    if(window.renderAll) window.renderAll();
    return true;
  }
  return false;
}

// 重置为默认分类
async function resetCategories(){
  if(!window.state) return;
  if(!confirm('确定要重置为默认分类吗？这将删除所有自定义分类，但不会修改已有交易记录的分类名称。')){
    return;
  }
  const state = window.state;
  state.categories = [...DEFAULT_CATEGORIES];
  await saveCategories();
  if(window.renderCategoriesTable) window.renderCategoriesTable();
  alert('已重置为默认分类');
}

// 暴露到全局
window.loadCategories = loadCategories;
window.updateCategorySelects = updateCategorySelects;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.renameCategory = renameCategory;
window.resetCategories = resetCategories;
