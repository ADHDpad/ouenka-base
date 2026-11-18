(()=>{'use strict';
const $=id=>document.getElementById(id),node=(t,s)=>{const e=document.createElement(t);if(s!==undefined)e.textContent=s;return e};
const status=t=>$('popularStatus').textContent=t;let songs=[],loading=false;
const audio=window.OuenkaPlayAudio;
const continuous=$('popularContinuous'),dialog=$('popularPlayDialog'),endRank=$('popularEndRank');
let playbackToken=0,playing=false;
const normalize=value=>String(value??'').normalize('NFKC').toLowerCase()
 .replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))
 .replace(/<br\s*\/?\s*>/gi,' ').replace(/[\s・]+/g,'');
function teamRanking(){
 const team=$('popularTeam').value;
 const filtered=team?songs.filter(song=>song.team===team):songs;
 let rank=0,previous=null;
 return filtered.map((song,index)=>{
  if(song.points!==previous)rank=index+1;
  previous=song.points;
  return {song,rank};
 });
}
function render(){
 const ranked=teamRanking(),query=normalize($('popularSearch').value);
 const max=$('popularLimit').value==='all'?ranked.length:Number($('popularLimit').value);
 const shown=query?ranked.filter(({song})=>[song.name,song.reading,song.team,song.lyrics]
  .some(value=>normalize(value).includes(query))):ranked.slice(0,max);
 continuous.disabled=!ranked.length&&!playing;
 $('popularCount').textContent='ポイント獲得 '+ranked.length+'曲 ／ '+shown.length+'曲表示';
 $('popularList').replaceChildren(...shown.map(({song:s,rank})=>{
  const li=node('li'),place=node('b',rank+'位'),info=node('span'),name=node('strong',s.name),meta=node('small',s.team),lyric=node('small',String(s.lyrics||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/\s+/g,' ').trim()||'歌詞未登録'),points=node('strong',s.points+'pt'),play=node('button','▶');
  lyric.className='popular-lyrics';lyric.title=lyric.textContent;const colors=window.OuenkaTeamColors.get(s.team);li.dataset.team=s.team;li.style.setProperty('--team',colors[0]);li.style.setProperty('--popular-background',window.OuenkaTeamColors.css(colors,window.OuenkaTeamColors.getWidth(s.team)));info.append(name,meta,lyric);play.type='button';play.setAttribute('aria-label',s.name+'を再生');play.onclick=()=>{if(playing)finishPlayback();audio.play(s).catch(()=>status('試聴できませんでした。'))};const actions=node('div');actions.className='popular-actions';actions.append(window.OuenkaFavorites.button(s),play);li.append(place,info,points,actions);return li;
 }));
 if(!shown.length)$('popularList').append(node('li',query?'検索条件に一致する応援歌がありません。':'まだポイントがありません。お気に入りを付けると集計されます。'));
}
function finishPlayback(message){
 playbackToken++;
 audio.stop();
 playing=false;
 continuous.textContent='連続再生';
 continuous.setAttribute('aria-haspopup','dialog');
 continuous.disabled=!teamRanking().length;
 if(message)status(message);
}
function selectedQueue(){
 const limit=endRank.valueAsNumber;
 return teamRanking().filter(({rank})=>rank<=limit);
}
function updateQueueSize(){
 $('popularQueueSize').textContent=selectedQueue().length+'曲を再生します。同順位の曲も含みます。';
}
continuous.onclick=()=>{
 if(playing){finishPlayback('連続再生を停止しました。');return}
 const ranked=teamRanking();
 if(!ranked.length)return;
 const team=$('popularTeam').value||'全球団';
 const max=ranked.at(-1).rank;
 endRank.max=String(max);
 endRank.value=String(Math.min(Number(endRank.value)||10,max));
 $('popularPlayScope').textContent=team+'のランキングで1位から指定した順位まで再生します。';
 updateQueueSize();
 dialog.showModal();
};
endRank.oninput=updateQueueSize;
$('popularPlayCancel').onclick=()=>dialog.close();
$('popularPlayForm').onsubmit=async event=>{
 event.preventDefault();
 const queue=selectedQueue();
 if(!queue.length)return;
 dialog.close();
 const token=++playbackToken;
 playing=true;
 continuous.textContent='■ 停止';
 continuous.removeAttribute('aria-haspopup');
 status(queue.length+'曲の音源を準備しています…');
 try{
  await audio.playMedley(queue.map(({song})=>song),{
   title:'人気ランキング',
   onSong:(song,index)=>{if(token===playbackToken)status(queue[index].rank+'位 '+song.name+'（'+(index+1)+' / '+queue.length+'曲）')},
   onStop:()=>{if(token===playbackToken)finishPlayback('連続再生を停止しました。')},
   onEnded:()=>{if(token===playbackToken)finishPlayback('連続再生が終了しました。')}
  });
 }catch(error){
  if(token===playbackToken)finishPlayback(error.message||'連続再生できませんでした。');
 }
};
async function refresh(){if(loading)return;loading=true;$('popularRefresh').disabled=true;$('popularRefresh').textContent='更新中…';$('popularRefresh').setAttribute('aria-busy','true');status('ランキングを集計中…');try{
 const [stats,r]=await Promise.all([window.OuenkaStats.load(),fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(15000)})]);
 if(!stats)throw Error('集計を取得できません。通信状態と同梱worker.jsへの更新を確認してください。');if(!r.ok)throw Error('応援歌を取得できませんでした。');const data=await r.json();if(!Array.isArray(data.songs))throw Error('応援歌を取得できませんでした。');
 const unique=new Map();for(const song of data.songs){const points=Number(stats[window.OuenkaStats.key(song)]?.favorites||0);if(points<=0)continue;unique.set(window.OuenkaStats.key(song),{...song,name:song.player_name??song.name,productionNumber:String(song.production_number??song.productionNumber),team:song.team||'球団未設定',points})}
 songs=[...unique.values()].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ja')||Number(a.productionNumber)-Number(b.productionNumber));
 const selected=$('popularTeam').value;$('popularTeam').replaceChildren(new Option('すべて',''),...[...new Set(songs.map(s=>s.team))].sort((a,b)=>a.localeCompare(b,'ja')).map(t=>new Option(t,t)));if([...$('popularTeam').options].some(o=>o.value===selected))$('popularTeam').value=selected;
 render();status('全ユーザーのお気に入りポイントを反映しました。');
 }catch(e){status(e.message||'ランキングを取得できませんでした。')}finally{loading=false;$('popularRefresh').disabled=false;$('popularRefresh').textContent='↻ 更新';$('popularRefresh').setAttribute('aria-busy','false')}}
try{const limit=localStorage.getItem('ouenkaPopularLimitV1');if(['10','30','50','100','all'].includes(limit))$('popularLimit').value=limit}catch{}
$('popularLimit').onchange=()=>{try{localStorage.setItem('ouenkaPopularLimitV1',$('popularLimit').value)}catch{}render()};$('popularTeam').onchange=render;$('popularSearch').oninput=render;$('popularRefresh').onclick=refresh;refresh();
})();
