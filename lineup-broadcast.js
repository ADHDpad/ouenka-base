/* 写真なし・1-9表示。既存の検索・音声処理とは独立。 */
(()=>{'use strict';
 const $=id=>document.getElementById(id),root=$('broadcastLineup');if(!root||!window.OuenkaBroadcast)return;
 const KEY='ouenkaBroadcastLineupV1';
 function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')||{}}catch{return {}}}
 const studio=read('ouenka_studio_tabs_v1');
 let prefs={variant:'7',color:'#07549a',teamDark:'#071d33',accent:'#1392c6',fadeMode:'card',fadeEndColor:'#1392c6',gradientAngle:110,broadcastLine:'#ffd43b',...Object.fromEntries(['color','teamDark','accent','fadeMode','fadeEndColor','gradientAngle','broadcastLine'].filter(k=>studio[k]!==undefined).map(k=>[k,studio[k]])),...read(KEY)};
 const fields={lineupVariant:'variant',lineupMain:'color',lineupDark:'teamDark',lineupAccent:'accent',lineupGradient:'fadeMode',lineupEnd:'fadeEndColor',lineupAngle:'gradientAngle'};
 for(const [id,key] of Object.entries(fields))if($(id))$(id).value=prefs[key];
 let frame=0,settleTimer=0,persistTimer=0,editingColor=false;
 function persist(){clearTimeout(persistTimer);try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}}
 window.addEventListener('pagehide',persist);
 function rows(){return typeof currentRows==='function'?currentRows():[]}
 function draw(){
  frame=0;const canvas=$('lineupBroadcastCanvas'),width=editingColor?960:1920;if(canvas.width!==width){canvas.width=width;canvas.height=width*9/16}const ctx=canvas.getContext('2d'),list=rows();
  const active=[...document.querySelectorAll('#lineup .player-row')].findIndex(row=>row.querySelector('.order.playing'));
  ctx.save();ctx.scale(canvas.width/1280,canvas.height/720);
  window.OuenkaBroadcast.drawLineup(ctx,list,{...prefs,title:$('lineupTitle')?.value||'1-9 応援歌',activeIndex:active});ctx.restore();
  $('lineupAngleValue').textContent=prefs.gradientAngle+'°';
  $('lineupEnd').disabled=prefs.fadeMode==='none'||prefs.fadeMode==='card';
  $('lineupBroadcastStatus').textContent=list.some(p=>p.name)?'入力した選手・打順がそのまま反映されます。':'下の入力欄で選手を選ぶと、ここに表示されます。';
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(draw)}
 for(const [id,key] of Object.entries(fields))$(id)?.addEventListener('input',e=>{
  prefs[key]=key==='gradientAngle'?Number(e.target.value):e.target.value;
  editingColor=true;clearTimeout(persistTimer);persistTimer=setTimeout(persist,180);clearTimeout(settleTimer);settleTimer=setTimeout(()=>{editingColor=false;schedule()},180);schedule();
 });
 $('saveLineupImage').addEventListener('click',async()=>{
  if(!rows().some(p=>p.name)){$('lineupBroadcastStatus').textContent='先に選手を入力してください。';return}
  try{editingColor=false;persist();draw();await window.OuenkaBroadcast.savePng($('lineupBroadcastCanvas'),'1-9一覧.png')}catch(e){$('lineupBroadcastStatus').textContent=e.message}
 });
 document.addEventListener('input',e=>{if(e.target.closest('#lineup')||e.target.id==='lineupTitle')schedule()});
 document.addEventListener('change',e=>{if(e.target.closest('#lineup'))schedule()});
 new MutationObserver(schedule).observe($('lineup'),{subtree:true,childList:true,attributes:true,attributeFilter:['class','value']});
 window.addEventListener('storage',e=>{if(e.key==='ouenka_studio_tabs_v1'){const s=read(e.key);for(const key of ['color','teamDark','accent','fadeMode','fadeEndColor','gradientAngle','broadcastLine'])if(s[key]!==undefined)prefs[key]=s[key];for(const [id,key] of Object.entries(fields))$(id).value=prefs[key];schedule()}});
 draw();
})();
