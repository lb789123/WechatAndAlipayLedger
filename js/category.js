// ====== 交易分类管理 ======
const DEFAULT_CATEGORIES = ['餐饮','交通','居住','数码','服饰','娱乐','教育','亲友代付','医疗','日用','旅行','其他'];

// 预定义的分类别名映射（可按需扩展）
const DEFAULT_CATEGORY_ALIASES = {
  '餐饮': ['饭','吃饭','外卖','餐馆','午餐','晚餐','早餐','餐厅'],
  '交通': ['地铁','公交','打车','出租','滴滴','交通费','燃油'],
  '居住': ['房租','租金','物业','水电','燃气','房贷'],
  '数码': ['电子','手机','电脑','平板','数码产品','配件'],
  '服饰': ['衣服','鞋子','服装','配饰','帽子'],
  '娱乐': ['电影','游戏','KTV','聚会','演出','娱乐消费'],
  '教育': ['培训','学费','课程','教材','讲座'],
  '亲友代付': ['代付','朋友代付','亲友代付'],
  '医疗': ['医院','诊所','药品','药店','体检','医疗费'],
  '日用': ['日用品','超市','便利店','生活用品'],
  '旅行': ['机票','酒店','旅行','旅游','景点'],
  '其他': []
};

// 暴露默认别名，方便外部查看或扩展
window.DEFAULT_CATEGORY_ALIASES = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ALIASES));

// 初始化分类（从数据库加载或使用默认值）
async function loadCategories(){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  
  // 尝试从数据库加载分类数组
  const stored = await window.idb.getPrefRaw(pkey('categories'));
  if(stored && Array.isArray(stored) && stored.length > 0){
    state.categories = stored;
  } else {
    // 使用默认分类
    state.categories = [...DEFAULT_CATEGORIES];
    // 保存默认分类到数据库
    await window.idb.setPrefRaw(pkey('categories'), state.categories);
  }

  // 尝试加载分类别名映射（category -> [alias...])
  const storedAliases = await window.idb.getPrefRaw(pkey('cat_aliases'));
  if(storedAliases && typeof storedAliases === 'object'){
    // 使用数据库中保存的映射，但确保所有分类都有数组（可能为空）
    state.categoryAliases = Object.assign({}, storedAliases);
    state.categories.forEach(c => { if(!Array.isArray(state.categoryAliases[c])) state.categoryAliases[c] = (DEFAULT_CATEGORY_ALIASES[c] || []).slice(); });
  } else {
    // 使用预定义别名（对默认分类使用 DEFAULT_CATEGORY_ALIASES，其他自定义分类创建空数组）
    state.categoryAliases = {};
    state.categories.forEach(c => {
      if(DEFAULT_CATEGORY_ALIASES[c]) state.categoryAliases[c] = DEFAULT_CATEGORY_ALIASES[c].slice();
      else state.categoryAliases[c] = [];
    });
    await window.idb.setPrefRaw(pkey('cat_aliases'), state.categoryAliases);
  }
  
  // 更新分类选择器
  updateCategorySelects();
}

// 更新分类选择器
function updateCategorySelects(){
  if(!window.state) return;
  const state = window.state;
  // 过滤掉转账类（如原先逻辑）
  const cats = state.categories.filter(c=>!c.startsWith('转账'));
  const opts = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  const txCat = $('#tx_category');
  if(txCat) txCat.innerHTML = opts;
  const bdgCat = $('#bdg_category');
  if(bdgCat) bdgCat.innerHTML = opts;
}

// 保存分类和别名到数据库
async function saveCategories(){
  if(!window.state || !window.pkey) return;
  const state = window.state;
  const pkey = window.pkey;
  await window.idb.setPrefRaw(pkey('categories'), state.categories);
  await window.idb.setPrefRaw(pkey('cat_aliases'), state.categoryAliases || {});
  updateCategorySelects();
}

// 添加分类，允许传入 aliases（字符串或数组）
async function addCategory(name, aliases){
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

  // 处理别名参数
  let aliasArr = [];
  if(aliases){
    if(Array.isArray(aliases)) aliasArr = aliases.map(a=>String(a||'').trim()).filter(Boolean);
    else aliasArr = String(aliases||'').split(',').map(s=>s.trim()).filter(Boolean);
  } else {
    // 如果没有��入别名，尝试从默认别名里拿
    if(DEFAULT_CATEGORY_ALIASES[trimmed]) aliasArr = DEFAULT_CATEGORY_ALIASES[trimmed].slice();
  }
  if(!state.categoryAliases) state.categoryAliases = {};
  state.categoryAliases[trimmed] = aliasArr;
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
    // 删除别名映射
    if(state.categoryAliases && state.categoryAliases[name]) delete state.categoryAliases[name];
    await saveCategories();
    return true;
  }
  return false;
}

// 编辑分类（重命名）
async function renameCategory(oldName, newName, aliases){
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
    // 迁移别名
    if(!state.categoryAliases) state.categoryAliases = {};
    const oldAliases = state.categoryAliases[oldName] || [];
    delete state.categoryAliases[oldName];
    // 如果外部传入 aliases 参数，优先使用它
    if(aliases){
      let aliasArr = Array.isArray(aliases) ? aliases.map(a=>String(a||'').trim()).filter(Boolean) : String(aliases||'').split(',').map(s=>s.trim()).filter(Boolean);
      state.categoryAliases[trimmed] = aliasArr;
    } else {
      state.categoryAliases[trimmed] = oldAliases;
    }

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
  // 使用默认别名映射的副本
  state.categoryAliases = {};
  state.categories.forEach(c => {
    state.categoryAliases[c] = (DEFAULT_CATEGORY_ALIASES[c] || []).slice();
  });
  await saveCategories();
  if(window.renderCategoriesTable) window.renderCategoriesTable();
  alert('已重置为默认分类');
}

// 设置单个分类的别名（覆盖）
async function setCategoryAliases(category, aliases){
  if(!window.state) return false;
  const state = window.state;
  if(!state.categories.includes(category)) return false;
  let aliasArr = [];
  if(Array.isArray(aliases)) aliasArr = aliases.map(a=>String(a||'').trim()).filter(Boolean);
  else aliasArr = String(aliases||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!state.categoryAliases) state.categoryAliases = {};
  state.categoryAliases[category] = aliasArr;
  await saveCategories();
  return true;
}

// 获取单个分类的别名数组
function getCategoryAliases(category){
  if(!window.state) return [];
  return (window.state.categoryAliases && window.state.categoryAliases[category]) ? window.state.categoryAliases[category].slice() : [];
}

// 根据一个原始文本尝试匹配到已有分类（通过名称、别名、子串或 token 匹配）
function findCategoryByLabel(raw){
  if(!window.state || !raw) return null;
  const state = window.state;
  const s = String(raw).trim();
  if(!s) return null;
  const norm = (x) => String(x||'').toLowerCase().replace(/\s+/g,'').replace(/[^\w\u4e00-\u9fa5]/g,'');
  const input = norm(s);

  // 1) 直接名称匹配（忽略大小写/空白/符号）
  for(const c of state.categories){
    if(norm(c) === input) return c;
  }

  // 2) 别名精确或子串匹配
  if(state.categoryAliases){
    for(const [cat, aliases] of Object.entries(state.categoryAliases)){
      if(!aliases || !aliases.length) continue;
      for(const a of aliases){
        const na = norm(a);
        if(!na) continue;
        if(na === input) return cat;
        if(na && input.includes(na)) return cat;
        if(na.length > 3 && na.split('').some(ch => input.includes(ch))) {
          // very loose fallback (kept minimal)
        }
      }
    }
  }

  // 3) token-based matching: split by non-alnum and compare overlap
  const tokens = input.split(/[^0-9a-z\u4e00-\u9fa5]+/).filter(Boolean);
  if(tokens.length){
    const scores = {};
    for(const c of state.categories){
      const cname = norm(c);
      let score = 0;
      if(cname && tokens.some(t => cname.includes(t))) score += 2;
      const aliases = (state.categoryAliases && state.categoryAliases[c]) ? state.categoryAliases[c] : [];
      for(const a of aliases){
        const na = norm(a);
        if(na && tokens.some(t => na.includes(t))) score += 2;
      }
      if(score > 0) scores[c] = (scores[c]||0) + score;
    }
    // pick best score (>=2)
    const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
    if(best && best[1] >= 2) return best[0];
  }

  return null;
}

// 暴露到全局
window.loadCategories = loadCategories;
window.updateCategorySelects = updateCategorySelects;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.renameCategory = renameCategory;
window.resetCategories = resetCategories;
window.setCategoryAliases = setCategoryAliases;
window.getCategoryAliases = getCategoryAliases;
window.findCategoryByLabel = findCategoryByLabel;