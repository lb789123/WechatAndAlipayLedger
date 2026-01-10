// ====== 全局状态管理 ======
const state={
  profileId:getCurrentProfile(), 
  accounts:[], 
  txs:[], 
  budgets:{}, 
  fxrates:{}, 
  categories:[], // 交易分类列表
  categoryAliases: {}, // 分类别名映射：{ categoryName: [alias1, alias2, ...] }
  prefs:{
    baseCurrency:'CNY', 
    maskAmounts:false, 
    theme:'dark'
  }
};

// Profile Key 生成器
const pkey = (k)=> `${state.profileId}::${k}`;

// 暴露到全局
window.state = state;