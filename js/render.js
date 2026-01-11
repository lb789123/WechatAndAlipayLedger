// ====== 渲染函数 ======
function renderAll(){ 
  fillAccountSelects(); 
  renderDashboard(); 
  renderAccountsTable(); 
  renderTxTable(); 
  renderBudget(); 
  renderFxTable(); 
  renderCategoriesTable();
  fillFilterCategorySelect();//更新分类筛选
  updateDataProfileId();
}
function fillFilterCategorySelect(){
  if(!window.state) return;
  const sel = $('#filter_category');
  if(!sel) return;
  const state = window.state;
  const cats = state.categories || [];

  sel.innerHTML = '<option value="">全部分类</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}
function fillAccountSelects(){
  if(!window.state) return;
  const state = window.state;
  const opts=state.accounts.sort((a,b)=>a.sort-b.sort).map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
  $('#tx_account').innerHTML=opts; 
  $('#tx_target').innerHTML=opts; 
  $('#filter_account').innerHTML='<option value="">全部账户</option>'+opts;
  $('#tx_date').value=todayStr();
}

function renderDashboard(){
  if(!window.state) return;
  const state = window.state;
  const base=state.prefs.baseCurrency;
  let income=0, expense=0, net=0; const missing=new Set();
  state.accounts.filter(a=>a.includeInNetWorth).forEach(a=>{
    const bal=accountBalance(a);
    const baseVal=amountToBase(bal,a.currency);
    if(baseVal===null) missing.add(a.currency); else net+=baseVal;
  });
  state.txs.filter(t=>sameMonth(t.date,new Date()) && !t.isTransfer).forEach(t=>{
    const acc=state.accounts.find(a=>a.id===t.accountId); if(!acc) return;
    const v=amountToBase(t.amount,acc.currency); if(v===null) return; if(t.side==='in') income+=v; if(t.side==='out') expense+=v;
  });
  $('#netWorth').textContent=fmtAmount(net,base);
  $('#monthIn').textContent=fmtAmount(income,base);
  $('#monthOut').textContent=fmtAmount(expense,base);
  $('#netWorthNote').textContent=missing.size? `缺少 ${Array.from(missing).join(', ')} 汇率，相关账户未计入净资产。` : '';

  const wrap=$('#accountCards'); wrap.innerHTML='';
  state.accounts.sort((a,b)=>a.sort-b.sort).forEach(a=>{
    const bal=accountBalance(a);
    const baseVal=amountToBase(bal,a.currency);
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<div class="content">
      <div class="row"><strong>${a.name}</strong><span class="space"></span><span class="tag">${a.type}</span></div>
      <div class="muted" style="margin:6px 0">币种：${a.currency} · ${a.includeInNetWorth? '计入净资产':'不计入'}</div>
      <div class="kpi"><span class="label">余额</span><span class="value amount">${fmtAmount(bal,a.currency)}</span>
        ${baseVal!==null && a.currency!==base ? `<span class="note">≈ ${fmtAmount(baseVal,base)}</span>`:''}
      </div>
    </div>`;
    wrap.appendChild(card);
  });

  const tbody=$('#recentTxTable tbody'); tbody.innerHTML='';
  state.txs.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).forEach(t=>{
    const acc=state.accounts.find(a=>a.id===t.accountId);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${t.date}</td><td>${acc?acc.name:''}</td><td>${t.category||t.payee||''}${t.memo? ' · '+t.memo:''}</td>
    <td style='text-align:right' class='amount ${t.side==='in'?'positive':'negative'}'>${(t.side==='in'?'+':'-')+fmtAmount(t.amount,acc?acc.currency:state.prefs.baseCurrency)}</td>
    <td style='text-align:right'><button class='btn ghost' data-edit-tx='${t.id}'>编辑</button></td>`;
    tbody.appendChild(tr);
  });
  $$('[data-edit-tx]').forEach(b=>b.onclick=()=>{
    const t=state.txs.find(x=>x.id===b.dataset.editTx); if(!t) return;
    if(window.startEditTx) window.startEditTx(t);
  });

  renderAcctDonut();
  renderIEPieChart();
}

// ====== 圆环图 ======
let donutCache=null;
function accountStructureData(){
  if(!window.state) return {labels:[],values:[],colors:[]};
  const state = window.state;
  const base=state.prefs.baseCurrency;
  const labels=[]; const values=[]; const colors=[]; let idx=0;
  state.accounts.filter(a=>a.includeInNetWorth).forEach(a=>{
    const bal=accountBalance(a);
    const v=amountToBase(bal,a.currency);
    if(v!==null && Math.abs(v)>0.0001){
      labels.push(a.name);
      values.push(v);
      const hue=(idx*50)%360; colors.push(`hsl(${hue} 70% 55% / 1)`); idx++;
    }
  });
  return {labels,values,colors};
}

function setCanvasSize(cnv){
  const dpr=window.devicePixelRatio||1; const rect=cnv.getBoundingClientRect();
  cnv.width=Math.max(300, Math.floor(rect.width*dpr)); cnv.height=Math.floor(260*dpr);
  return dpr;
}

function drawDonutChart(cnv, labels, values, colors){
  const dpr=setCanvasSize(cnv); const ctx=cnv.getContext('2d');
  ctx.clearRect(0,0,cnv.width,cnv.height);
  const W=cnv.width, H=cnv.height; const R=Math.min(W,H)/2 - 30*dpr; const r=R*0.6; const cx=W/2, cy=H/2;
  const sum=values.reduce((a,b)=>a+b,0)||1; let start=-Math.PI/2;
  const arcs=[];
  values.forEach((v,i)=>{
    const ang=2*Math.PI*(v/sum); const end=start+ang; ctx.fillStyle=colors[i]||'#4c8bf5';
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,start,end); ctx.closePath(); ctx.fill();
    arcs.push({start,end,label:labels[i],value:v,color:colors[i],percent:(v/sum)});
    start=end;
  });
  ctx.globalCompositeOperation='destination-out';
  ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.fill();
  ctx.globalCompositeOperation='source-over';
  const text=getComputedStyle(document.body).getPropertyValue('--text')||'#e7edf3';
  const muted=getComputedStyle(document.body).getPropertyValue('--muted')||'#9fb3c8';
  ctx.fillStyle=text; ctx.font=`${14*dpr}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('资产结构', cx, cy-10*dpr);
  ctx.fillStyle=muted; ctx.font=`${12*dpr}px system-ui`; ctx.fillText('按账户（基准）', cx, cy+10*dpr);
  donutCache={cx,cy,R,r,arcs,dpr};
}

function renderAcctDonut(){
  if(!window.state) return;
  const state = window.state;
  const {labels,values,colors}=accountStructureData();
  $('#acctDonutNote').textContent=`基准：${state.prefs.baseCurrency}`;
  const cnv=$('#acctDonut');
  drawDonutChart(cnv, labels, values, colors);
  const lg=$('#acctLegend'); lg.innerHTML='';
  const total=values.reduce((a,b)=>a+b,0)||1;
  labels.forEach((lb,i)=>{
    const item=document.createElement('div'); item.className='item';
    const sw=document.createElement('span'); sw.className='swatch'; sw.style.background=colors[i]; item.appendChild(sw);
    const pct=((values[i]/total)*100).toFixed(1)+'%';
    item.appendChild(document.createTextNode(`${lb} · ${pct}`));
    lg.appendChild(item);
  });
  if(!cnv._hoverBound){
    cnv.addEventListener('mousemove', onDonutHover);
    cnv.addEventListener('mouseleave', ()=>{ const t=$('#tooltip'); t.style.display='none'; });
    cnv._hoverBound=true;
  }
}

function onDonutHover(e){
  if(!donutCache || !window.state) return;
  const state = window.state;
  const rect=e.target.getBoundingClientRect();
  const scale=(window.devicePixelRatio||1);
  const x=(e.clientX - rect.left) * scale;
  const y=(e.clientY - rect.top)  * scale;
  const {cx,cy,R,r,arcs}=donutCache;
  const dx=x - cx, dy=y - cy; const dist=Math.sqrt(dx*dx+dy*dy);
  const t=$('#tooltip');
  if(dist<r || dist>R){ t.style.display='none'; return; }
  let ang=Math.atan2(dy,dx);
  if(ang< -Math.PI/2){ ang+=2*Math.PI; }
  const hit=arcs.find(a=> ang>=a.start && ang<a.end);
  if(!hit){ t.style.display='none'; return; }
  const base=state.prefs.baseCurrency;
  const html=`<div class="title">${hit.label}</div>
    <div class="row"><span>金额</span><strong>${fmtAmount(hit.value, base)}</strong></div>
    <div class="row"><span>占比</span><strong>${(hit.percent*100).toFixed(1)}%</strong></div>`;
  t.innerHTML=html;
  t.style.display='block';
  const pad=10; let tx=e.clientX+12, ty=e.clientY+12;
  const vw=window.innerWidth, vh=window.innerHeight;
  const tw=t.offsetWidth||160, th=t.offsetHeight||80;
  if(tx+tw+pad>vw) tx=vw-tw-pad;
  if(ty+th+pad>vh) ty=vh-th-pad;
  t.style.left=tx+'px'; t.style.top=ty+'px';
}

// ====== 账户表（拖动排序） ======
function renderAccountsTable(){
  if(!window.state) return;
  const state = window.state;
  const tb=$('#accountsTable tbody'); tb.innerHTML='';
  const base=state.prefs.baseCurrency;
  state.accounts.sort((a,b)=>a.sort-b.sort).forEach(a=>{
    const bal=accountBalance(a); const baseVal=amountToBase(bal,a.currency);
    const tr=document.createElement('tr'); tr.dataset.id=a.id; tr.draggable=true;
    tr.innerHTML=`<td class='drag-handle' title='拖动排序'>⋮⋮</td><td>${a.name}</td><td>${a.type}</td><td>${a.currency}</td><td>${a.includeInNetWorth?'是':'否'}</td>
      <td style='text-align:right' class='amount'>${fmtAmount(bal,a.currency)}</td>
      <td style='text-align:right' class='amount'>${baseVal!==null? fmtAmount(baseVal,base): '<span class="note">— 缺汇率</span>'}</td>
      <td style='text-align:right'>
        <button class='btn ghost' data-edit='${a.id}'>编辑</button>
        <button class='btn ghost' data-del='${a.id}'>删除</button>
      </td>`;
    tb.appendChild(tr);
  });
  $$('[data-edit]').forEach(b=>b.onclick=()=>{
    const a=state.accounts.find(x=>x.id===b.dataset.edit); if(!a) return;
    $('#acc_id').value=a.id; $('#acc_name').value=a.name; $('#acc_type').value=a.type; $('#acc_currency').value=a.currency;
    $('#acc_in_net').value=String(a.includeInNetWorth); $('#acc_opening').value=a.openingBalance; $('#acc_sort').value=a.sort;
    $('#sec-accounts').classList.add('active'); $$('#tabs button').forEach(btn=>btn.classList.toggle('active', btn.dataset.target==='#sec-accounts'));
    $('#accountForm').scrollIntoView({behavior:'smooth'});
  });
  $$('[data-del]').forEach(b=>b.onclick=async ()=>{
    const a=state.accounts.find(x=>x.id===b.dataset.del); if(!a) return;
    if(state.txs.some(t=>t.accountId===a.id)){ if(!confirm('该账户存在交易记录，删除将保留交易但孤立。确认删除？')) return; }
    await window.idb.del('accounts',a.id); state.accounts=state.accounts.filter(x=>x.id!==a.id); 
    if(window.renderAll) window.renderAll();
  });
  let draggingId=null;
  tb.addEventListener('dragstart',e=>{
    const tr=e.target.closest('tr'); if(!tr) return;
    draggingId=tr.dataset.id; tr.classList.add('dragging'); e.dataTransfer.effectAllowed='move';
  });
  tb.addEventListener('dragend',e=>{
    const tr=e.target.closest('tr'); if(tr) tr.classList.remove('dragging'); draggingId=null;
    $$('#accountsTable tbody tr').forEach(r=>r.classList.remove('drop-target'));
  });
  tb.addEventListener('dragover',e=>{
    e.preventDefault();
    const tr=e.target.closest('tr'); if(!tr) return;
    $$('#accountsTable tbody tr').forEach(r=>r.classList.remove('drop-target'));
    tr.classList.add('drop-target');
  });
  tb.addEventListener('drop',async e=>{
    e.preventDefault();
    const targetTr=e.target.closest('tr'); if(!targetTr || !draggingId) return;
    const targetId=targetTr.dataset.id;
    if(targetId===draggingId) return;
    const order=state.accounts.sort((a,b)=>a.sort-b.sort).map(a=>a.id);
    const from=order.indexOf(draggingId), to=order.indexOf(targetId);
    if(from<0||to<0) return;
    order.splice(to,0, order.splice(from,1)[0]);
    state.accounts.forEach(a=>{ a.sort=(order.indexOf(a.id)+1)*10; window.idb.put('accounts',a); });
    if(window.renderAll) window.renderAll();
  });
}

function renderTxTable(){
  if(!window.state) return;
  const state = window.state;

  const acct    = $('#filter_account').value;
  const kw      = $('#filter_kw').value.trim().toLowerCase();
  const dFromEl = $('#filter_date_from');
  const dToEl   = $('#filter_date_to');
  const typeEl  = $('#filter_type');
  const catEl   = $('#filter_category');

  const dFrom = dFromEl && dFromEl.value ? dFromEl.value : '';
  const dTo   = dToEl   && dToEl.value   ? dToEl.value   : '';
  const fType = typeEl  ? typeEl.value.trim() : '';
  const fCat  = catEl   ? catEl.value.trim()  : '';

  const tb = $('#txTable tbody'); 
  tb.innerHTML = '';

  let list = [...state.txs];

  // 账户筛选
  if(acct){
    list = list.filter(t => t.accountId === acct);
  }

  // 时间段筛选
  if(dFrom){
    list = list.filter(t => (t.date || '') >= dFrom);
  }
  if(dTo){
    list = list.filter(t => (t.date || '') <= dTo);
  }

  // 类型筛选：收入 / 支出 / 转账
  if(fType){
    if(fType === 'transfer'){
      list = list.filter(t => !!t.isTransfer);
    } else {
      list = list.filter(t => !t.isTransfer && t.side === fType);
    }
  }

  // 分类筛选（这里允许与类型组合）
  if(fCat){
    list = list.filter(t => (t.category || '') === fCat);
  }

  // 关键字筛选
  if(kw){
    list = list.filter(t => {
      const cat = (t.category || '').toLowerCase();
      const pay = (t.payee    || '').toLowerCase();
      const memo= (t.memo     || '').toLowerCase();
      return cat.includes(kw) || pay.includes(kw) || memo.includes(kw);
    });
  }

  list.sort((a,b) => b.date.localeCompare(a.date));

  list.forEach(t => {
    const acc = state.accounts.find(a => a.id === t.accountId);
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${acc ? acc.name : ''}</td>
      <td>${t.isTransfer ? '转账' : (t.side==='in' ? '收入' : '支出')}</td>
      <td>${t.category || ''}${t.payee ? ' · ' + t.payee : ''}</td>
      <td>${t.memo || ''}</td>
      <td style='text-align:right' class='amount ${t.side==='in'?'positive':'negative'}'>
        ${(t.side==='in'?'+':'-') + fmtAmount(t.amount, acc ? acc.currency : state.prefs.baseCurrency)}
      </td>
      <td style='text-align:right'>
        <button class='btn ghost' data-edit-tx='${t.id}'>编辑</button>
        <button class='btn ghost' data-rm='${t.id}'>删除</button>
      </td>`;
    tb.appendChild(tr);
  });

  // 删除逻辑（保持原有）
  $$('[data-rm]').forEach(b=>b.onclick=async ()=>{
    const t=state.txs.find(x=>x.id===b.dataset.rm); if(!t) return;
    if(t.isTransfer && t.transferPeerId){
      await window.idb.del('transactions',t.transferPeerId);
      state.txs = state.txs.filter(x=>x.id!==t.transferPeerId);
    }
    await window.idb.del('transactions',t.id);
    state.txs = state.txs.filter(x=>x.id!==t.id); 
    if(window.renderAll) window.renderAll();
  });

  // 编辑逻辑（下一节讨论转账的策略）
  $$('[data-edit-tx]').forEach(b=>b.onclick=()=>{
    const t=state.txs.find(x=>x.id===b.dataset.editTx); if(!t) return;
    const tr = b.closest('tr');
    if(!tr) return;

    if(t.isTransfer){
      // 方案：转账不支持真正编辑，给出提示
      alert('转账流水暂不支持直接编辑，如需调整，请删除该转账并重新新增。');
    }else{
      // 普通收入/支出：行内编辑
      if(window.startInlineEditTx) window.startInlineEditTx(t, tr);
      // 或者直接调用你在同文件定义的 startInlineEditTx(t, tr)
    }
  });
}
// function renderTxTable(){
//   if(!window.state) return;
//   const state = window.state;
//   const acct=$('#filter_account').value; const kw=$('#filter_kw').value.trim().toLowerCase();
//   const tb=$('#txTable tbody'); tb.innerHTML='';
//   let list=[...state.txs];
//   if(acct) list=list.filter(t=>t.accountId===acct);
//   if(kw) list=list.filter(t=> (t.category||'').toLowerCase().includes(kw) || (t.payee||'').toLowerCase().includes(kw) || (t.memo||'').toLowerCase().includes(kw));
//   list.sort((a,b)=>b.date.localeCompare(a.date));
//   list.forEach(t=>{
//     const acc=state.accounts.find(a=>a.id===t.accountId);
//     const tr=document.createElement('tr');
//     tr.innerHTML=`<td>${t.date}</td><td>${acc?acc.name:''}</td><td>${t.isTransfer? '转账':(t.side==='in'?'收入':'支出')}</td>
//       <td>${t.category||''}${t.payee? ' · '+t.payee:''}</td><td>${t.memo||''}</td>
//       <td style='text-align:right' class='amount ${t.side==='in'?'positive':'negative'}'>${(t.side==='in'?'+':'-')+fmtAmount(t.amount,acc?acc.currency:state.prefs.baseCurrency)}</td>
//       <td style='text-align:right'>
//         <button class='btn ghost' data-edit-tx='${t.id}'>编辑</button>
//         <button class='btn ghost' data-rm='${t.id}'>删除</button>
//       </td>`;
//     tb.appendChild(tr);
//   });
//   $$('[data-rm]').forEach(b=>b.onclick=async ()=>{
//     const t=state.txs.find(x=>x.id===b.dataset.rm); if(!t) return;
//     if(t.isTransfer && t.transferPeerId){ await window.idb.del('transactions',t.transferPeerId); state.txs=state.txs.filter(x=>x.id!==t.transferPeerId); }
//     await window.idb.del('transactions',t.id); state.txs=state.txs.filter(x=>x.id!==t.id); 
//     if(window.renderAll) window.renderAll();
//   });
//   $$('[data-edit-tx]').forEach(b=>b.onclick=()=>{
//     const t=state.txs.find(x=>x.id===b.dataset.editTx); if(!t) return;
//     if(window.startEditTx) window.startEditTx(t);
//   });
// }

function renderBudget(targetMonth = null, viewMode = 'month'){
  if(!window.state) return;
  const state = window.state;
  
  // 确定目标月份
  let targetDate;
  if(targetMonth){
    // targetMonth 格式可能是 "2024-01" 或已经是日期字符串
    const monthStr = typeof targetMonth === 'string' && targetMonth.match(/^\d{4}-\d{2}$/) 
      ? targetMonth 
      : ym(new Date(targetMonth));
    targetDate = new Date(monthStr + '-01');
  } else {
    targetDate = new Date();
  }
  
  // 根据 viewMode 确定标签和时间范围
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  let periodLabel;
  let startDate, endDate;
  
  if(viewMode === 'year'){
    periodLabel = `${year} 年`;
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
  } else {
    const monthStr = ym(targetDate);
    periodLabel = `月份：${monthStr}`;
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 0);
  }
  
  $('#budgetMonthLabel').textContent = periodLabel;
  
  // 设置月份选择器的值（如果存在且未被用户手动设置）
  const monthInput = $('#budgetMonthSelector');
  if(monthInput){
    const monthStr = String(month + 1).padStart(2, '0');
    const newValue = `${year}-${monthStr}`;
    // 只在值不同时更新，避免触发change事件
    if(monthInput.value !== newValue){
      monthInput.value = newValue;
    }
  }
  
  // 设置视图模式选择器（如果存在）
  const viewModeInput = $('#budgetViewMode');
  if(viewModeInput && viewModeInput.value !== viewMode){
    viewModeInput.value = viewMode;
  }
  
  const wrap=$('#budgetGrid'); wrap.innerHTML='';
  const netSpent={}; // 净支出：负值表示净支出，正值表示净收入
  
  // 筛选时间范围内的交易（支持refund-aware）
  state.txs.filter(t=>{
    if(t.isTransfer) return false;
    const txDate = new Date(t.date);
    return txDate >= startDate && txDate <= endDate;
  }).forEach(t=>{
    const acc=state.accounts.find(a=>a.id===t.accountId); if(!acc) return;
    const v=amountToBase(t.amount,acc.currency); if(v===null) return;
    const c=t.category||'其他';
    if(!netSpent[c]) netSpent[c] = 0;
    // 支出减少netSpent（使其更负），收入增加netSpent（使其更正）
    // 最终：netSpent = 收入 - 支出
    if(t.side === 'out') netSpent[c] -= v;
    if(t.side === 'in') netSpent[c] += v;
  });
  
  // 计算实际使用额：Math.max(0, -netSum) 即净支出金额（仅当支出大于收入时为正）
  const spent = {};
  Object.keys(netSpent).forEach(c => {
    spent[c] = Math.max(0, -netSpent[c]);
  });
  
  const categories=[...new Set([...Object.keys(state.budgets), ...Object.keys(spent)])];
  categories.forEach(c=>{
    const bAmt=Number(state.budgets[c]||0);
    const sAmt=Number(spent[c]||0);
    
    // 根据 viewMode，如果是年度视图，预算应该是月预算*12
    const effectiveBudget = viewMode === 'year' ? bAmt * 12 : bAmt;
    const usedPct = effectiveBudget > 0 ? sAmt / effectiveBudget : 0;
    const displayPct = Math.min(100, Math.round(usedPct * 100));
    
    // 确定进度条颜色
    let barClass = 'low';
    if(usedPct >= 0.9) barClass = 'high';
    else if(usedPct >= 0.5) barClass = 'medium';
    
    const card=document.createElement('div'); 
    card.className='card budget-card';
    card.style.cursor='pointer';
    card.dataset.category=c;
    card.dataset.month=ym(targetDate);
    card.dataset.viewMode=viewMode;
    
    card.innerHTML=`<div class='content'>
      <div class='row'><strong>${c}</strong><span class='space'></span><span class='muted'>预算：${fmtAmount(effectiveBudget,state.prefs.baseCurrency)}</span></div>
      <div class='budget-bar-outer' style='margin-top:8px'><div class='budget-bar-inner ${barClass}' style='width:${displayPct}%'></div></div>
      <div class='row' style='margin-top:6px'><span class='pill'>${displayPct}%</span></div>
      <div class='row' style='margin-top:6px'><span class='muted'>已用：</span><strong class='amount negative'>-${fmtAmount(sAmt,state.prefs.baseCurrency)}</strong><span class='space'></span><span class='muted'>剩余：</span><strong>${fmtAmount(Math.max(0,effectiveBudget-sAmt),state.prefs.baseCurrency)}</strong></div>
      <div class='row' style='margin-top:8px;justify-content:flex-end;gap:8px'>
        <button class='btn ghost' data-bdg-edit='${c}'>编辑</button>
        <button class='btn ghost' data-bdg-del='${c}'>删除</button>
      </div>
    </div>`;
    
    // 添加点击事件显示交易明细
    card.addEventListener('click', (e)=>{
      // 如果点击的是按钮，不触发卡片点击
      if(e.target.closest('button')) return;
      if(viewMode === 'year'){
        showBudgetDetail(c, ym(targetDate), 'year');
      } else {
        showBudgetDetail(c, ym(targetDate), 'month');
      }
    });
    
    wrap.appendChild(card);
  });
  
  $$('[data-bdg-edit]').forEach(b=>{
    b.onclick=(e)=>{
      e.stopPropagation();
      if(window.startEditBudget) window.startEditBudget(b.dataset.bdgEdit);
    };
  });
  
  $$('[data-bdg-del]').forEach(b=>{
    b.onclick=(e)=>{
      e.stopPropagation();
      if(window.deleteBudget) window.deleteBudget(b.dataset.bdgDel);
    };
  });
}

// 显示预算分类的交易明细
function showBudgetDetail(category, month, viewMode = 'month'){
  if(!window.state) return;
  const state = window.state;
  
  // 解析月份
  const [year, monthNum] = month.split('-');
  let targetDate, endDate, periodLabel;
  
  if(viewMode === 'year'){
    targetDate = new Date(parseInt(year), 0, 1);
    endDate = new Date(parseInt(year), 11, 31);
    periodLabel = `${year} 年`;
  } else {
    targetDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    endDate = new Date(parseInt(year), parseInt(monthNum), 0);
    periodLabel = month;
  }
  
  // 筛选该分类在该时间范围的所有交易（支持refund-aware）
  const transactions = state.txs.filter(t=>{
    if(t.isTransfer) return false;
    if((t.category||'其他') !== category) return false;
    const txDate = new Date(t.date);
    return txDate >= targetDate && txDate <= endDate;
  }).sort((a,b)=>b.date.localeCompare(a.date));
  
  // 显示明细卡片
  const detailCard = $('#budgetDetailCard');
  const detailTitle = $('#budgetDetailTitle');
  const detailTable = $('#budgetDetailTable tbody');
  const detailTotal = $('#budgetDetailTotal');
  
  detailTitle.textContent = `${category} - ${periodLabel} 交易明细`;
  detailTable.innerHTML = '';
  
  let total = 0;
  transactions.forEach(t=>{
    const acc = state.accounts.find(a=>a.id===t.accountId);
    const baseAmount = amountToBase(t.amount, acc ? acc.currency : state.prefs.baseCurrency);
    
    const tr = document.createElement('tr');
    const sign = t.side === 'in' ? '+' : '-';
    const amtClass = t.side === 'in' ? 'positive' : 'negative';
    const displayAmt = t.amount;
    
    // 计算净支出贡献：支出减少total（使其更负），收入增加total（使其更正）
    // 与预算计算逻辑保持一致
    if(baseAmount !== null){
      if(t.side === 'out') total -= baseAmount;
      if(t.side === 'in') total += baseAmount;
    }
    
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${acc ? acc.name : ''}</td>
      <td>${t.payee || ''}</td>
      <td>${t.memo || ''}</td>
      <td style='text-align:right' class='amount ${amtClass}'>${sign}${fmtAmount(displayAmt, acc ? acc.currency : state.prefs.baseCurrency)}${baseAmount !== null && acc && acc.currency !== state.prefs.baseCurrency ? ` <span class='note'>(≈${sign}${fmtAmount(baseAmount, state.prefs.baseCurrency)})</span>` : ''}</td>
    `;
    detailTable.appendChild(tr);
  });
  
  if(transactions.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan='5' style='text-align:center;color:var(--muted)'>该时段该分类暂无交易记录</td>`;
    detailTable.appendChild(tr);
  }
  
  // 显示净额合计（income - expense，负值表示净支出）
  detailTotal.textContent = fmtAmount(-total, state.prefs.baseCurrency);
  detailCard.style.display = 'block';
  
  // 滚动到明细区域
  detailCard.scrollIntoView({behavior:'smooth', block:'nearest'});
}

// 关闭预算明细
function closeBudgetDetail(){
  const detailCard = $('#budgetDetailCard');
  detailCard.style.display = 'none';
}

function renderFxTable(){
  if(!window.state) return;
  const state = window.state;
  const tb=$('#fxTable tbody'); tb.innerHTML='';
  const nowStr=new Date().toLocaleString();
  Object.keys(state.fxrates).sort().forEach(q=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${q}</td><td style='text-align:right'>${Number(state.fxrates[q]).toFixed(4)}</td><td>${nowStr}</td>
      <td style='text-align:right'>
        <button class='btn ghost' data-fxedit='${q}'>编辑</button>
        <button class='btn ghost' data-fxdel='${q}'>删除</button>
      </td>`;
    tb.appendChild(tr);
  });
  $$('[data-fxedit]').forEach(b=>b.onclick=()=>{ const q=b.dataset.fxedit; $('#fx_quote').value=q; $('#fx_rate').value=state.fxrates[q]; $('#fx_quote').focus(); });
  $$('[data-fxdel]').forEach(b=>b.onclick=async ()=>{ const q=b.dataset.fxdel; const pkey = window.pkey || ((k)=> `${state.profileId}::${k}`); const key=pkey('fx:'+q); await window.idb.del('fxrates',key); delete state.fxrates[q]; if(window.renderAll) window.renderAll(); });
}

function updateDataProfileId(){
  if(!window.state) return;
  const el = document.querySelector('#dataProfileId');
  if(el) el.textContent = window.state.profileId || '';
}

function renderCategoriesTable(){
  if(!window.state) return;
  const state = window.state;
  const tb=$('#categoriesTable tbody'); if(!tb) return;
  tb.innerHTML='';
  
  state.categories.forEach(cat=>{
    const aliases = (state.categoryAliases && state.categoryAliases[cat]) ? state.categoryAliases[cat].join(', ') : '';
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${cat}</td><td>${aliases}</td>
      <td style='text-align:right'>
        <button class='btn ghost' data-cat-edit='${cat}'>编辑</button>
        <button class='btn ghost' data-cat-del='${cat}'>删除</button>
      </td>`;
    tb.appendChild(tr);
  });
  
  $$('[data-cat-edit]').forEach(b=>b.onclick=()=>{
    const cat=b.dataset.catEdit;
    $('#cat_name').value=cat;
    $('#cat_edit_name').value=cat;
    // 回填别名（若表单提供 #cat_aliases input）
    const aliases = (window.state.categoryAliases && window.state.categoryAliases[cat]) ? window.state.categoryAliases[cat].join(', ') : '';
    const aliasInput = $('#cat_aliases');
    if(aliasInput) aliasInput.value = aliases;
    $('#categoryForm').scrollIntoView({behavior:'smooth'});
    $('#cat_name').focus();
  });
  
  $$('[data-cat-del]').forEach(b=>b.onclick=async ()=>{
    const cat=b.dataset.catDel;
    if(window.deleteCategory){
      const success = await window.deleteCategory(cat);
      if(success){
        if(window.renderCategoriesTable) window.renderCategoriesTable();
      }
    }
  });
}
async function saveInlineTxChange(t, fields){
  // fields: {date, type, accountId, amount, category, payee, memo}
  if(!window.state) return;
  const state = window.state;

  // 简化处理：如果原来是转账，暂不支持转成普通记录（可按需要扩展）
  if(t.isTransfer){
    alert('行内暂不支持编辑转账记录，请使用顶部编辑或重新录入。');
    return;
  }

  const date = fields.date || todayStr();
  const accId = fields.accountId || t.accountId;
  const amt = Number(fields.amount);
  if(!(amt > 0)){
    alert('金额必须大于0');
    return;
  }

  // 侧别 / 类型
  let side = fields.type || t.side;
  if(side !== 'in' && side !== 'out') side = 'out';

  const payee = (fields.payee || '').trim();
  const memo  = (fields.memo  || '').trim();
  const cat   = (fields.category || '').trim() || t.category || '';

  t.date = date;
  t.accountId = accId;
  t.side = side;
  t.amount = amt;
  t.payee = payee;
  t.memo = memo;
  t.category = cat;

  await window.idb.put('transactions', t);
  const idx = state.txs.findIndex(x=>x.id===t.id);
  if(idx >= 0) state.txs[idx] = t;

  if(window.renderAll) window.renderAll();
  alert('流水已更新');
}

function startInlineEditTx(t, tr){
  if(!window.state) return;
  const state = window.state;
  const acc = state.accounts.find(a=>a.id===t.accountId);

  // 构造账户下拉 options
  const accOptions = state.accounts
    .map(a=>`<option value="${a.id}" ${a.id===t.accountId?'selected':''}>${a.name}</option>`)
    .join('');

  // 类型下拉
  const typeOptions = `
    <option value="out" ${(!t.isTransfer && t.side==='out')?'selected':''}>支出</option>
    <option value="in"  ${(!t.isTransfer && t.side==='in')?'selected':''}>收入</option>
    <option value="transfer" ${t.isTransfer?'selected':''} disabled>转账</option>
  `;

  // 分类下拉，沿用现有分类
  const catOptions = (state.categories || [])
    .map(c => `<option value="${c}" ${c===(t.category||'')?'selected':''}>${c}</option>`)
    .join('');
  const catSelect = `<select class="inline-cat">${catOptions}</select>`;

  // 替换当前行为编辑态
  tr.innerHTML = `
    <td><input type="date" class="inline-date" value="${t.date || todayStr()}"></td>
    <td><select class="inline-account">${accOptions}</select></td>
    <td>
      <select class="inline-type">
        ${typeOptions}
      </select>
    </td>
    <td>${catSelect} <input class="inline-payee" style="width:45%" placeholder="对方" value="${t.payee||''}"></td>
    <td><input class="inline-memo" style="width:100%" placeholder="备注" value="${t.memo||''}"></td>
    <td style="text-align:right">
      <input class="inline-amount" type="number" step="0.01" style="width:100px;text-align:right" value="${t.amount}">
    </td>
    <td style="text-align:right">
      <button class="btn primary btn-inline-save">保存</button>
      <button class="btn btn-inline-cancel">取消</button>
    </td>
  `;

  const btnSave   = tr.querySelector('.btn-inline-save');
  const btnCancel = tr.querySelector('.btn-inline-cancel');

  btnSave.onclick = async ()=>{
    const date = tr.querySelector('.inline-date').value;
    const accountId = tr.querySelector('.inline-account').value;
    const type = tr.querySelector('.inline-type').value;
    const amount = tr.querySelector('.inline-amount').value;
    const category = tr.querySelector('.inline-cat') ? tr.querySelector('.inline-cat').value : '';
    const payee = tr.querySelector('.inline-payee').value;
    const memo  = tr.querySelector('.inline-memo').value;

    await saveInlineTxChange(t, {date, accountId, type: type==='transfer'?t.side:type, amount, category, payee, memo});
  };

  btnCancel.onclick = ()=>{
    // 取消时重新渲染整个表，恢复原状
    if(window.renderTxTable) window.renderTxTable();
  };
}

// ====== 收支结构饼图 ======
function currentMonthIncomeExpense(){
  if(!window.state) return {labels:[],values:[],colors:[]};
  const state = window.state;
  let income=0, expense=0;
  const now=new Date();
  state.txs.filter(t=>!t.isTransfer && sameMonth(t.date,now)).forEach(t=>{
    const acc=state.accounts.find(a=>a.id===t.accountId); if(!acc) return;
    const v=amountToBase(t.amount,acc.currency); if(v===null) return;
    if(t.side==='in') income+=v;
    if(t.side==='out') expense+=v;
  });
  // 收入用绿色，支出用红色
  return {
    labels:['收入','支出'],
    values:[income, expense],
    colors:['#31c48d','#f05252']
  };
}

function drawIEPieChart(cnv, labels, values, colors){
  const dpr=setCanvasSize(cnv); const ctx=cnv.getContext('2d');
  ctx.clearRect(0,0,cnv.width,cnv.height);
  const W=cnv.width, H=cnv.height; const R=Math.min(W,H)/2 - 30*dpr; const cx=W/2, cy=H/2;
  const sum=values.reduce((a,b)=>a+b,0)||1; let start=-Math.PI/2;
  values.forEach((v,i)=>{
    const ang=2*Math.PI*(v/sum);
    ctx.fillStyle=colors[i]||'#4c8bf5';
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,start,start+ang); ctx.closePath(); ctx.fill();
    start+=ang;
  });
  // 添加中心文字
  const text=getComputedStyle(document.body).getPropertyValue('--text')||'#e7edf3';
  const muted=getComputedStyle(document.body).getPropertyValue('--muted')||'#9fb3c8';
  ctx.fillStyle=text; ctx.font=`${14*dpr}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('本月收支', cx, cy-10*dpr);
  ctx.fillStyle=muted; ctx.font=`${12*dpr}px system-ui`; 
  const net = values[0] - values[1];
  const netSign = net >= 0 ? '+' : '';
  ctx.fillText(netSign + net.toFixed(0), cx, cy+10*dpr);
}

function renderIEPieChart(){
  if(!window.state) return;
  const state = window.state;
  const {labels,values,colors}=currentMonthIncomeExpense();
  const cnv=$('#iePieChart');
  drawIEPieChart(cnv, labels, values, colors);
  $('#iePieNote').textContent=`月份：${ym(new Date())} · 基准：${state.prefs.baseCurrency}`;
}

// 暴露到全局
window.renderAll = renderAll;
window.renderDashboard = renderDashboard;
window.renderAccountsTable = renderAccountsTable;
window.renderTxTable = renderTxTable;
window.renderBudget = renderBudget;
window.renderFxTable = renderFxTable;
window.renderAcctDonut = renderAcctDonut;
window.renderIEPieChart = renderIEPieChart;
window.renderCategoriesTable = renderCategoriesTable;
window.showBudgetDetail = showBudgetDetail;
window.closeBudgetDetail = closeBudgetDetail;