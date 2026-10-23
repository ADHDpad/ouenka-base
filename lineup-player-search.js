(()=>{'use strict';
const officialAPI='https://ouenka-base-search.ninzin5600.workers.dev',cache=new Map(),controllers=new WeakMap();
const normalize=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\s　・･]/g,'').toLowerCase(),nameOf=s=>String(s.player_name||s.name||'').trim(),teamOf=s=>String(s.team||'').trim();
function merge(songs,players,q,team,max=10){
 let registered=Array.isArray(songs)?songs:[];
 if(team){const same=registered.filter(s=>!s.team||s.team===team);if(same.length)registered=same}
 const missing=(players||[]).filter(p=>nameOf(p)&&!registered.some(s=>normalize(nameOf(s))===normalize(nameOf(p))&&(!teamOf(p)||teamOf(s)===teamOf(p)))).map(p=>({...p,_noSong:true}));
 const exact=[...registered,...missing].some(p=>normalize(nameOf(p))===normalize(q));
 const manual=exact?[]:[{name:q,team:team||'',_noSong:true,_manual:true}];
 return [...registered,...missing,...manual];
}
async function search(q,api,emit,signal){
 const state={songs:[],players:[],pending:true,songError:false,playerError:false,directoryTotal:0};
 const publish=()=>{if(!signal?.aborted)emit({...state})};publish();
 async function get(url){const hit=cache.get(url);if(hit&&Date.now()-hit.at<300000)return hit.data;const r=await fetch(url,{cache:'no-store',signal});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(url,{at:Date.now(),data});return data}
 await Promise.allSettled([
  (async()=>{try{const d=await get(api+'/songs/search?q='+encodeURIComponent(q));state.songs=Array.isArray(d.songs)?d.songs:[]}catch{state.songError=true}publish()})(),
  (async()=>{try{const directory=await window.OuenkaNpbDirectory?.load();if(directory){state.directoryTotal=directory.length;const query=normalize(q);state.players=directory.filter(p=>normalize(p.name+' '+(p.aliases||[]).join(' ')+' '+(p.reading||'')).includes(query));publish()}if(!directory&&normalize(q).length>=2){const d=await get(officialAPI+'/player?name='+encodeURIComponent(q));if(d.ok&&d.found&&d.player){const p=d.player;state.players=[{name:p.name||p.player_name||q,team:p.team||'',reading:p.reading||'',uniform_number:p.number??'',position:p.position||''}]}}}catch{state.playerError=true}publish()})()
 ]);state.pending=false;publish();return state;
}
function assign(row,player){
 row.querySelector('.player-search').value=nameOf(player);
 for(const key of ['songId','productionNumber','lyrics','audioUrl','medleyUrl','melodyUrl','accompanimentUrl','introMelodyUrl','introAccompanimentUrl','reuseName','reuseProductionNumber'])row.dataset[key]='';
 Object.assign(row.dataset,{team:teamOf(player),jerseyNumber:String(player.uniform_number??player.number??''),reuseMode:'generic',awaitingSong:'1'});
 const box=row.querySelector('.suggestions');box.replaceChildren();box.style.display='none';
}
function refreshHint(row,save){
 let note=row.querySelector('.assignment-note');const input=row.querySelector('.player-search');
 const needed=input?.value.trim()&&!row.dataset.productionNumber&&(row.dataset.awaitingSong==='1'||row.dataset.reuseMode);
 if(!needed){note?.remove();return}
 if(!note){note=document.createElement('div');note.className='assignment-note';row.querySelector('.search-wrap').append(note)}note.replaceChildren();
 const text=document.createElement('span');text.textContent=row.dataset.reuseName?'使用する応援歌：'+row.dataset.reuseName:'応援歌未登録：汎用・流用曲を選んで使えます。';
 const button=document.createElement('button');button.type='button';button.textContent='汎用・流用を設定';button.onclick=()=>{save();location.href='./reuse-register.html?mode='+(/medley\.html$/.test(location.pathname)?'medley':'lineup')};note.append(text,button);
}
function show({row,input,box,api,team,max,onSelect,isCurrent}){
 controllers.get(row)?.abort();const controller=new AbortController();controllers.set(row,controller);
 const q=input.value.trim();box.replaceChildren();if(!q){box.style.display='none';return}
 let visible=20;
 const render=state=>{if(!isCurrent()||controller.signal.aborted)return;box.replaceChildren();const candidates=merge(state.songs,state.players,q,team,max),matches=candidates.filter(p=>!p._manual);const summary=document.createElement('div');summary.className='suggestion search-summary';summary.textContent='検索結果 '+matches.length.toLocaleString()+'件'+(state.directoryTotal?'（NPB名簿 '+state.directoryTotal.toLocaleString()+'名）':'');box.append(summary);for(const player of [...matches.slice(0,visible),...candidates.filter(p=>p._manual)]){
  const button=document.createElement('button');button.type='button';button.className='suggestion';button.dataset.team=player._noSong?'':teamOf(player);button.dataset.unregistered=String(!!player._noSong);
  const title=document.createElement('strong');title.textContent=player._manual?'「'+q+'」を入力名で追加':nameOf(player);
  const meta=document.createElement('small');meta.textContent=(teamOf(player)||(player.sourceUrl?'NPB歴代名簿':'球団未設定'))+(player.sourceUrl&&teamOf(player)?' / NPB名簿':'')+(player._noSong?' / 応援歌未登録':' / 制作番号 '+String(player.production_number??player.productionNumber??''));
  const detail=document.createElement('small');detail.textContent=player._noSong?'汎用・流用曲を割り当てて使用できます':String(player.lyrics||player.lyric||'歌詞未登録').replace(/<br\s*\/?\s*>/gi,' ').replace(/\\n|\s+/g,' ').trim();button.append(title,meta,detail);button.onclick=()=>{if(!isCurrent())return;controller.abort();onSelect(player)};box.append(button)
 }if(matches.length>visible){const more=document.createElement('button');more.type='button';more.className='suggestion search-more';more.textContent='もっと表示（残り '+(matches.length-visible).toLocaleString()+'件）';more.onclick=()=>{visible+=20;render(state)};box.append(more)}if(state.pending){const status=document.createElement('div');status.className='suggestion search-pending';status.textContent='選手情報も検索しています…';box.append(status)}else if(state.playerError){const status=document.createElement('div');status.className='suggestion search-pending';status.textContent='選手情報を取得できませんでした。入力名でも追加できます。';box.append(status)}box.style.display='block'};
 render({songs:[],players:[],pending:true});
 let timer;const job=setTimeout(()=>{timer=setTimeout(()=>{controller.abort();if(isCurrent())box.querySelector('.search-pending')?.remove()},15000);search(q,api,render,controller.signal).finally(()=>clearTimeout(timer))},250);
 controller.signal.addEventListener('abort',()=>{clearTimeout(job);clearTimeout(timer)},{once:true});
}
window.OuenkaLineupPlayerSearch={search,merge,assign,refreshHint,show};
})();
