(()=>{'use strict';const $=id=>document.getElementById(id),input=$('homeLyricsQuery'),team=$('homeLyricsTeam'),active=$('homeLyricsActive'),status=$('homeLyricsStatus'),list=$('homeLyricsResults');if(!input)return;
const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));let catalog=null,pending=null,limit=24,debounce=0,request=0,matches=[];
function node(tag,text){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element}
async function load(){if(catalog)return catalog;if(pending)return pending;
 pending=(async()=>{const response=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(data.ok===false||!Array.isArray(data.songs))throw Error('形式を確認できません');
 catalog=data.songs.map(s=>({...s,name:String(s.player_name||s.name||''),productionNumber:String(s.production_number||s.productionNumber||1),team:String(s.team||''),lyrics:String(s.lyrics||''),isActive:['現在使用','現役','1','true'].includes(String(s.player_type??s.active??'').trim())})).filter(s=>s.name);
 const previous=team.value,teams=[...new Set(catalog.map(s=>s.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));team.replaceChildren(new Option('すべての球団',''),...teams.map(t=>new Option(t,t)));if(teams.includes(previous))team.value=previous;return catalog;
 })().finally(()=>{pending=null});return pending;
}
function draw(){
 const terms=normalize(input.value).trim().split(/\s+/).filter(Boolean);list.replaceChildren();$('homeLyricsMore').hidden=true;
 if(!terms.length){matches=[];status.textContent='空白で区切ると、すべての言葉を含む曲を探せます。';return}
 matches=catalog.filter(s=>(!team.value||s.team===team.value)&&(active.value==='all'||(active.value==='active'?s.isActive:!s.isActive))&&terms.every(term=>normalize(s.lyrics).includes(term)));
 status.textContent=matches.length+'曲が見つかりました。';
 for(const song of matches.slice(0,limit)){
  const card=window.OuenkaLyricCandidates.create(song,async selected=>{window.ouenkaHomeQueue=matches;$('homeLyricsPlaybackStatus').textContent=selected.name+' の音源を読み込み中…';try{await window.playSongData(selected);$('homeLyricsPlaybackStatus').textContent=$('nowPlaying')?.textContent||selected.name}catch{$('homeLyricsPlaybackStatus').textContent='再生できませんでした。'}});list.append(card);
 }
 $('homeLyricsMore').hidden=matches.length<=limit;
}
async function search(){const token=++request;$('homeLyricsRetry').hidden=true;if(!input.value.trim()){draw();return}status.textContent='歌詞を検索中…';try{await load();if(token===request)draw()}catch(error){if(token===request){status.textContent='登録データを読み込めませんでした。通信を確認して再度お試しください。';$('homeLyricsRetry').hidden=false}}}
input.addEventListener('input',()=>{limit=24;request++;clearTimeout(debounce);debounce=setTimeout(search,180)});team.addEventListener('change',()=>{limit=24;search()});active.addEventListener('change',()=>{limit=24;search()});$('homeLyricsRetry').addEventListener('click',search);$('homeLyricsMore').addEventListener('click',()=>{limit+=24;draw()});
})();
