// ====== 主题管理 ======
function applyTheme(theme){
  document.body.classList.toggle('light', theme==='light');
  if(window.state) window.state.prefs.theme=theme;
}

async function savePrefs(){
  if(!window.state) return;
  const state = window.state;
  const pkey = window.pkey || ((k)=> `${state.profileId}::${k}`);
  await window.idb.setPrefRaw(pkey('baseCurrency'),state.prefs.baseCurrency);
  await window.idb.setPrefRaw(pkey('maskAmounts'),state.prefs.maskAmounts);
  await window.idb.setPrefRaw(pkey('theme'),state.prefs.theme);
}

// 暴露到全局
window.applyTheme = applyTheme;
window.savePrefs = savePrefs;
