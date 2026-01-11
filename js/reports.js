// ====== 报表 ======
function lastNMonthsLabels(n=12){
  const labels=[]; const now=new Date(); now.setDate(1);
  for(let i=n-1;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); labels.push(ym(d)); }
  return labels;
}

function monthlyIEBase(n=12){
  if(!window.state) return {labels:[],inc:[],exp:[]};
  const state = window.state;
  const labels=lastNMonthsLabels(n); const inc=Array(n).fill(0), exp=Array(n).fill(0);
  state.txs.filter(t=>!t.isTransfer).forEach(t=>{
    const idx=labels.indexOf(ym(t.date)); if(idx<0) return; 
    const acc=state.accounts.find(a=>a.id===t.accountId); if(!acc) return;
    const v=amountToBase(t.amount,acc.currency); if(v===null) return; 
    if(t.side==='in') inc[idx]+=v; if(t.side==='out') exp[idx]+=v;
  });
  return {labels,inc,exp};
}

function setCanvasSizePlot(cnv){
  const dpr=window.devicePixelRatio||1; const rect=cnv.getBoundingClientRect();
  cnv.width=Math.max(300, Math.floor(rect.width*dpr)); cnv.height=Math.floor(260*dpr);
  return dpr;
}

function drawLineChart(cnv, labels, s1, s2){
  const dpr=setCanvasSizePlot(cnv); const ctx=cnv.getContext('2d');
  ctx.clearRect(0,0,cnv.width,cnv.height);
  const W=cnv.width, H=cnv.height, pad=40*dpr;
  const all=[...s1,...s2]; const max=Math.max(1, Math.ceil(Math.max(...all,0)*1.2));
  ctx.strokeStyle='#2b394a'; ctx.lineWidth=1*dpr; ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.lineTo(W-pad, pad); ctx.stroke();
  const muted=getComputedStyle(document.body).getPropertyValue('--muted')||'#9fb3c8';
  const text=getComputedStyle(document.body).getPropertyValue('--text')||'#e7edf3';
  ctx.fillStyle=muted; ctx.font=`${11*dpr}px system-ui`;
  const ticks=4; for(let i=0;i<=ticks;i++){ const y=H-pad-(H-2*pad)/ticks*i; const val=max/ticks*i; ctx.fillText(val.toFixed(0), 6*dpr, y+4*dpr); ctx.strokeStyle='rgba(0,0,0,.1)'; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke(); }
  const step=(W-2*pad)/(labels.length-1||1);
  labels.forEach((lb,i)=>{ const x=pad+i*step; ctx.save(); ctx.translate(x, H-pad+14*dpr); ctx.rotate(-Math.PI/5); ctx.fillText(lb, 0,0); ctx.restore(); });
  function plot(arr, color){ ctx.strokeStyle=color; ctx.lineWidth=2*dpr; ctx.beginPath(); arr.forEach((v,i)=>{ const x=pad+i*step; const y=H-pad - (v/max)*(H-2*pad); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke(); }
  plot(s1,'#31c48d');
  plot(s2,'#f05252');
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--panel')||'#12161c';
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--border')||'#243140';
  ctx.fillRect(W-150*dpr, pad, 120*dpr, 30*dpr); ctx.strokeRect(W-150*dpr, pad, 120*dpr, 30*dpr);
  ctx.fillStyle=text; ctx.font=`${11*dpr}px system-ui`;
  ctx.fillText('收入', W-140*dpr, pad+10*dpr); ctx.fillText('支出', W-80*dpr, pad+10*dpr);
  ctx.fillStyle='#31c48d'; ctx.fillRect(W-148*dpr, pad+14*dpr, 10*dpr, 3*dpr);
  ctx.fillStyle='#f05252'; ctx.fillRect(W-88*dpr, pad+14*dpr, 10*dpr, 3*dpr);
}

// 按不同范围统计支出分类
// mode: 'month' | 'select-month' | 'year'
function expenseByCatForRange(mode = 'month', monthValue = null) {
  if (!window.state) return { labels: [], values: [], periodLabel: '' };
  const state = window.state;
  const now = new Date();

  let year, month;
  if (monthValue) {
    const parts = String(monthValue).split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1] || (now.getMonth() + 1), 10);
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const monthDate = new Date(year, month - 1, 1);
  const map = {};

  state.txs
    .filter(t => t.side === 'out' && !t.isTransfer)
    .forEach(t => {
      const d = new Date(t.date);
      if (isNaN(d)) return;

      if (mode === 'year') {
        if (d.getFullYear() !== year) return;
      } else {
        if (!sameMonth(d, monthDate)) return;
      }

      const acc = state.accounts.find(a => a.id === t.accountId);
      if (!acc) return;
      const v = amountToBase(t.amount, acc.currency);
      if (v === null) return;
      const c = t.category || '其他';
      map[c] = (map[c] || 0) + v;
    });

  const labels = Object.keys(map);
  const values = labels.map(k => map[k]);

  let periodLabel = '';
  if (mode === 'year') {
    periodLabel = `${year} 年`;
  } else {
    periodLabel = `${ym(monthDate)}`;
  }

  return { labels, values, periodLabel };
}

function drawPieChart(cnv, labels, values){
  if (!cnv) return;
  const dpr = setCanvasSizePlot(cnv);
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, cnv.width, cnv.height);

  const W = cnv.width, H = cnv.height;
  const R = Math.min(W, H) / 2 - 30 * dpr;
  const cx = W / 2, cy = H / 2;
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  let start = -Math.PI / 2;

  const segments = [];

  values.forEach((v, i) => {
    const ang = 2 * Math.PI * (v / sum);
    const hue = (i * 55) % 360;
    const color = `hsl(${hue} 70% 55% / 1)`;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, start, start + ang);
    ctx.closePath();
    ctx.fill();

    segments.push({
      label: labels[i],
      value: v,
      startAngle: start,
      endAngle: start + ang,
      color
    });

    start += ang;
  });

  const muted = getComputedStyle(document.body).getPropertyValue('--muted') || '#9fb3c8';
  const text = getComputedStyle(document.body).getPropertyValue('--text') || '#e7edf3';
  ctx.fillStyle = text;
  ctx.font = `${12 * dpr}px system-ui`;
  let ly = 20 * dpr;
  labels.forEach((lb, i) => {
    const hue = (i * 55) % 360;
    ctx.fillStyle = `hsl(${hue} 70% 60% / 1)`;
    ctx.fillRect(20 * dpr, ly - 8 * dpr, 10 * dpr, 10 * dpr);
    ctx.fillStyle = muted;
    const val = values[i];
    const pct = ((val / sum) * 100).toFixed(1);
    ctx.fillText(`${lb} · ${val.toFixed(2)} (${pct}%)`, 36 * dpr, ly);
    ly += 18 * dpr;
  });

  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;

  function showTooltip(x, y, textContent) {
    tooltip.textContent = textContent;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  cnv.onmousemove = (e) => {
    const rect = cnv.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (cnv.width / rect.width);
    const y = (e.clientY - rect.top) * (cnv.height / rect.height);
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > R || dist < 5 * dpr) {
      hideTooltip();
      return;
    }

    let ang = Math.atan2(dy, dx);

    const seg = segments.find(s => ang >= s.startAngle && ang <= s.endAngle);
    if (!seg) {
      hideTooltip();
      return;
    }

    const pct = ((seg.value / sum) * 100).toFixed(1);
    const content = `${seg.label}：${seg.value.toFixed(2)}（${pct}%）`;
    showTooltip(e.clientX, e.clientY, content);
  };

  cnv.onmouseleave = hideTooltip;}

function renderReports(){
  if(!window.state) return;
  const state = window.state;
  const {labels,inc,exp}=monthlyIEBase(12);
  $('#trendNote').textContent=`基准：${state.prefs.baseCurrency}`;
  drawLineChart($('#lineChart'), labels, inc, exp);

  const modeSel = document.getElementById('reportPieViewMode');
  const monthInput = document.getElementById('reportPieMonth');
  const mode = modeSel ? modeSel.value : 'month';

  if (monthInput && !monthInput.value) {
    const now = new Date();
    monthInput.value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  const monthVal = monthInput ? monthInput.value : null;
  const effectiveMode = (mode === 'select-month') ? 'select-month' : mode;
  const pie = expenseByCatForRange(effectiveMode, monthVal);

  $('#pieNote').textContent=`期间：${pie.periodLabel} · 基准：${state.prefs.baseCurrency}`;
  drawPieChart($('#pieChart'), pie.labels, pie.values);
}

// 暴露到全局
window.renderReports = renderReports;
