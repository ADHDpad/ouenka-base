(()=>{'use strict';
const $=id=>document.getElementById(id),node=(t,s)=>{const e=document.createElement(t);if(s!==undefined)e.textContent=s;return e};
const status=t=>$('popularStatus').textContent=t;let songs=[],loading=false;
function render(){
 const filtered=songs.filter(s=>!$('popularTeam').value||s.team===$('popularTeam').value),max=$('popularLimit').value==='all'?filtered.length:Number($('popularLimit').value),shown=filtered.slice(0,max);let rank=0,previous=null;
 $('popularCount').textContent='ポイント獲得 '+filtered.length+'曲 ／ '+shown.length+'曲表示';
 $('popularList').replaceChildren(...shown.map((s,i)=>{
  if(previous!==s.points)rank=i+1;previous=s.points;
  const li=node('li'),place=node('b',rank+'位'),info=node('span'),name=node('strong',s.name),meta=node('small',s.team+' ／ 制作番号 '+s.productionNumber),lyric=node('small',String(s.lyrics||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/\s+/g,' ').trim()||'歌詞未登録'),points=node('strong',s.points+'pt'),play=node('button','▶');
  lyric.className='popular-lyrics';lyric.title=lyric.textContent;const colors=window.OuenkaTeamColors.get(s.team);li.dataset.team=s.team;li.style.setProperty('--team',colors[0]);li.style.setProperty('--popular-background',window.OuenkaTeamColors.css(colors,window.OuenkaTeamColors.getWidth(s.team)));info.append(name,meta,lyric);play.type='button';play.setAttribute('aria-label',s.name+'を再生');play.onclick=()=>window.OuenkaPlayAudio.play(s).catch(()=>status('試聴できませんでした。'));const actions=node('div');actions.className='popular-actions';actions.append(window.OuenkaFavorites.button(s),play);li.append(place,info,points,actions);return li;
 }));
 if(!shown.length)$('popularList').append(node('li','まだポイントがありません。お気に入りを付けると集計されます。'));
}
async function refresh(){if(loading)return;loading=true;$('popularRefresh').disabled=true;status('ランキングを集計中…');try{
 const [stats,r]=await Promise.all([window.OuenkaStats.load(),fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(15000)})]);
 if(!stats)throw Error('集計を取得できません。通信状態と同梱worker.jsへの更新を確認してください。');if(!r.ok)throw Error('応援歌を取得できませんでした。');const data=await r.json();if(!Array.isArray(data.songs))throw Error('応援歌を取得できませんでした。');
 const unique=new Map();for(const song of data.songs){const points=Number(stats[window.OuenkaStats.key(song)]?.favorites||0);if(points<=0)continue;unique.set(window.OuenkaStats.key(song),{...song,name:song.player_name??song.name,productionNumber:String(song.production_number??song.productionNumber),team:song.team||'球団未設定',points})}
 songs=[...unique.values()].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'ja')||Number(a.productionNumber)-Number(b.productionNumber));
 const selected=$('popularTeam').value;$('popularTeam').replaceChildren(new Option('すべて',''),...[...new Set(songs.map(s=>s.team))].sort((a,b)=>a.localeCompare(b,'ja')).map(t=>new Option(t,t)));if([...$('popularTeam').options].some(o=>o.value===selected))$('popularTeam').value=selected;
 render();status('全ユーザーのお気に入りポイントを反映しました。');
 }catch(e){status(e.message||'ランキングを取得できませんでした。')}finally{loading=false;$('popularRefresh').disabled=false}}
try{const limit=localStorage.getItem('ouenkaPopularLimitV1');if(['10','30','50','100','all'].includes(limit))$('popularLimit').value=limit}catch{}
$('popularLimit').onchange=()=>{try{localStorage.setItem('ouenkaPopularLimitV1',$('popularLimit').value)}catch{}render()};$('popularTeam').onchange=render;$('popularRefresh').onclick=refresh;refresh();
})();
