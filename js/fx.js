// ====== 汇率工具 ======
function rateToBase(currency){
  if(!window.state) return 1;
  if(!currency || currency===window.state.prefs.baseCurrency) return 1;
  const q=(window.state.fxrates[currency]!==undefined)? Number(window.state.fxrates[currency]) : null;
  return q && q>0 ? q : null;
}

function amountToBase(amount,currency){
  if(!window.state) return Number(amount)||0;
  if(currency===window.state.prefs.baseCurrency) return Number(amount)||0;
  const r=rateToBase(currency); 
  return r? (Number(amount)||0)*r : null;
}

async function fetchRatesOpenERAPI(base, quotes){
  const url=`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
  const resp=await fetch(url,{mode:'cors'});
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  const data=await resp.json();
  if(!data || !data.rates) throw new Error('响应格式异常');
  const out={};
  quotes.forEach(q=>{
    const v = data.rates[q];
    if(v!=null && v>0){
      out[q] = 1 / v; // base->quote to quote->base
    }
  });
  return out;
}

async function updateFxFromNetwork(quotes){
  if(!window.state) return;
  const state = window.state;
  const pkey = window.pkey || ((k)=> `${state.profileId}::${k}`);
  const base=state.prefs.baseCurrency;
  try{
    const rates=await fetchRatesOpenERAPI(base, quotes);
    const updated=[];
    for(const [q,r] of Object.entries(rates)){
      const key=pkey(`fx:${q}`);
      await window.idb.put('fxrates',{key,profileId:state.profileId,quote:q,rate:r,updatedAt:new Date().toISOString()});
      state.fxrates[q]=r; updated.push(q);
    }
    if(window.renderAll) window.renderAll();
    alert(updated.length? ('汇率已更新（外币→基准）：'+updated.join(', ')) : '未获取到任何汇率');
  }catch(e){
    alert('联网获取失败：'+e.message);
  }
}

// 暴露到全局
window.rateToBase = rateToBase;
window.amountToBase = amountToBase;
window.updateFxFromNetwork = updateFxFromNetwork;
