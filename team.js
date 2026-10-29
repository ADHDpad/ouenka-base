const DATA_API="https://ouenka-base-data.ninzin5600.workers.dev";
const PUBLIC_BASE="https://adhdpad.github.io/ouenka-base/";
const params=new URLSearchParams(location.search);
const team=params.get("team")||"北海道日本ハムファイターズ";
let favoritesOnly=false;
let teamMedley=null;
function clearAllQueue(){teamMedley=null;$("teamPlayAll").setAttribute("aria-pressed","false")}
let songs=[],filter="all",current=null,currentAudios=[],paused=false;
let teamAudioContext=null,teamSources=[],teamPlayToken=0,teamStartedAt=0,teamPauseOffset=0,teamBuffers=null,teamTimeline=[],teamTotalDuration=0;
let teamSavedDuration=0,teamStoppedPosition=0;
let teamEndTimer=null,teamRemainingMs=0,teamTimerStartedAt=0;
const $=id=>document.getElementById(id);

document.title=team+" | OUENKA BASE";

function activeOf(song){const v=String(song.player_type??song.active??"").trim();return v==="現在使用"||v==="現役"||v==="1"||v==="true"}
function normalizeSong(song){
 const name=song.player_name||song.name||"", no=String(song.production_number||song.productionNumber||1);
 const base=PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/"+encodeURIComponent(name)+"/"+encodeURIComponent(no)+"/";
 return {...song,name,productionNumber:no,uniformNumber:song.uniform_number??song.uniformNumber??"",lyrics:song.lyrics||"",isActive:activeOf(song),audioUrl:base+"audio.m4a",accompanimentUrl:base+"accompaniment.m4a"};
}
async function loadSongs(){
 try{
   // 球団ページは検索APIではなく全登録データを取得して球団で絞り込む。
   // /songs/search は選手名・よみがな検索用なので、球団名を渡すと0件になる場合がある。
   const r=await fetch(DATA_API+"/songs",{method:"GET",cache:"no-store"});
   if(!r.ok)throw new Error("HTTP "+r.status);
   const data=await r.json();
   if(!data || data.ok===false || !Array.isArray(data.songs))throw new Error("登録データ形式エラー");
   songs=data.songs.filter(s=>String(s.team||"").trim()===team).map(normalizeSong);
   if(!songs.length)throw new Error("球団データなし");
   songs.sort((a,b)=>{
     // 現役（現在使用）を先頭にし、現役選手は背番号順。
     // 同じ背番号・同じ選手に複数曲ある場合は応援歌番号順。
     if(a.isActive!==b.isActive)return a.isActive?-1:1;
     const an=parseInt(a.uniformNumber,10),bn=parseInt(b.uniformNumber,10);
     const aHas=Number.isFinite(an),bHas=Number.isFinite(bn);
     if(a.isActive&&b.isActive){
       if(aHas&&bHas&&an!==bn)return an-bn;
       if(aHas!==bHas)return aHas?-1:1;
       const byName=a.name.localeCompare(b.name,"ja");
       if(byName)return byName;
       return Number(a.productionNumber)-Number(b.productionNumber);
     }
     return a.name.localeCompare(b.name,"ja")||Number(a.productionNumber)-Number(b.productionNumber);
   });
   render(); preloadVisible();
 }catch(e){console.error(e);$("teamStatus").textContent="この球団の登録データを読み込めませんでした";}
}
function visibleSongs(){return songs.filter(s=>(filter==="all"||(filter==="active"?s.isActive:!s.isActive))&&(!favoritesOnly||window.OuenkaFavorites?.has(s)))}
function render(){
 const list=$("songList"), arr=visibleSongs();const favoriteCount=songs.filter(s=>window.OuenkaFavorites?.has(s)).length;$("teamFavoritesButton").textContent="★ お気に入り（"+favoriteCount+"）";$("teamFavoritesButton").setAttribute("aria-pressed",String(favoritesOnly)); list.innerHTML=""; $("teamStatus").style.display=arr.length?"none":"block"; if(!arr.length){$("teamStatus").textContent=favoritesOnly?"この条件のお気に入りはありません。各曲の☆から登録できます。":"該当する応援歌はありません";return}
 arr.forEach((s,i)=>{const row=document.createElement("article");row.className="song-row";row.dataset.key=s.name+"#"+s.productionNumber;
   const num=s.uniformNumber!==""?s.uniformNumber:"—";
   row.innerHTML=`<div class="number"></div><div class="name"></div><span class="tag ${s.isActive?'active':'ob'}">${s.isActive?'現役':'現在未使用'}</span><div class="lyrics"></div>`;
   row.querySelector(".number").textContent=num;row.querySelector(".name").textContent=s.name;row.querySelector(".lyrics").textContent=String(s.lyrics).replace(/\n/g," ").replace(/\s+/g," ").trim();
   row.tabIndex=0;row.setAttribute("role","group");row.setAttribute("aria-label",s.name+"の応援歌、タップすると再生します");row.addEventListener("keydown",e=>{if(e.target===row&&(e.key==="Enter"||e.key===" ")){e.preventDefault();playSong(s)}});row.classList.toggle("playing",current?.name===s.name&&current?.productionNumber===s.productionNumber);row.addEventListener("click",()=>playSong(s));if(window.OuenkaFavorites)row.appendChild(window.OuenkaFavorites.button(s));list.appendChild(row);
 });
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function stopAudio(clear=true,keepQueue=false){
 if(!keepQueue)clearAllQueue();
 teamPlayToken++;
 if(teamEndTimer){clearTimeout(teamEndTimer);teamEndTimer=null}
 teamRemainingMs=0;teamTimerStartedAt=0;
 teamSources.forEach(src=>{try{src.stop()}catch(_){}});teamSources=[];
 currentAudios.forEach(a=>{try{a.pause();a.removeAttribute("src");a.load()}catch(_){}});currentAudios=[];
 if(teamAudioContext){try{teamAudioContext.close()}catch(_){}}teamAudioContext=null;teamBuffers=null;teamTimeline=[];teamTotalDuration=0;teamPauseOffset=0;paused=false;
 if(clear){current=null;$("miniPlayer").hidden=true;document.querySelectorAll(".song-row.playing").forEach(x=>x.classList.remove("playing"))}
}
function audioCandidates(s,fileName){
 const f=encodeURIComponent(fileName),n=encodeURIComponent(s.name),pn=encodeURIComponent(s.productionNumber);
 const registered=fileName==="audio.m4a"?s.audioUrl:fileName==="accompaniment.m4a"?s.accompanimentUrl:"";
 return [...new Set([registered,
  PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/"+n+"/"+pn+"/"+f,
  PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/"+n+"_"+pn+"/"+f,
  PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/"+n+"/"+f,
  PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/"+n+"/"+pn+"_"+f
 ].filter(Boolean))];
}
async function fetchDecoded(ctx,s,fileName){
 let last;
 for(const url of audioCandidates(s,fileName)){
  try{const r=await fetch(url,{cache:"no-store",credentials:"omit"});if(!r.ok)throw new Error("HTTP "+r.status);const ab=await r.arrayBuffer();return await ctx.decodeAudioData(ab.slice(0))}catch(e){last=e}
 }
 throw last||new Error(fileName+" が見つかりません");
}
const teamSpecialMissing=new Set();
async function fetchTeamSpecial(ctx,s){
 const url=audioCandidates(s,"special_audio.m4a")[0];
 if(teamSpecialMissing.has(url))return null;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
 try{const response=await fetch(url,{cache:"no-store",credentials:"omit",signal:controller.signal});if(response.status===404){teamSpecialMissing.add(url);return null}if(!response.ok)return null;const bytes=await response.arrayBuffer();return await ctx.decodeAudioData(bytes.slice(0))}catch(_){return null}finally{clearTimeout(timer)}
}
function armTeamEndTimer(ms){
 if(teamEndTimer){clearTimeout(teamEndTimer);teamEndTimer=null}
 teamRemainingMs=Math.max(0,ms);
 teamTimerStartedAt=performance.now();
 const token=teamPlayToken;
 teamEndTimer=setTimeout(()=>{
  teamEndTimer=null;
  if(token===teamPlayToken&&!paused){
   if(teamAudioContext&&teamAudioContext.currentTime-teamStartedAt<teamTotalDuration-.01){armTeamEndTimer(Math.max(100,(teamTotalDuration-(teamAudioContext.currentTime-teamStartedAt))*1000));return}
   teamSavedDuration=teamTotalDuration;teamStoppedPosition=teamTotalDuration;stopAudio(true,true);
   clearAllQueue();
  }
 },teamRemainingMs);
}
function startSyncedBuffers(offset=0){
 if(!teamAudioContext||!teamTimeline.length)return;
 teamSources.forEach(src=>{try{src.stop()}catch(_){}});teamSources=[];
 const when=teamAudioContext.currentTime+.055;
 for(const item of teamTimeline){
  const end=item.start+item.buffer.duration;if(offset>=end-.005)continue;
  const seek=Math.max(0,offset-item.start);
  const delay=Math.max(0,item.start-offset);
  const src=teamAudioContext.createBufferSource();src.buffer=item.buffer;src.connect(teamAudioContext.destination);
  src.start(when+delay,Math.min(seek,Math.max(0,item.buffer.duration-.01)));teamSources.push(src);
 }
 teamStartedAt=when-offset;
 if(!teamMedley){const song=current;window.OuenkaSongbook?.track(teamAudioContext,song,()=>current===song&&!paused&&teamSources.length>0,when)}
 else{const context=teamAudioContext,medley=teamMedley,base=when-offset;window.OuenkaSongbook?.watch(()=>teamAudioContext!==context||teamMedley!==medley||teamStartedAt!==base||context.state==='closed'?null:{playing:context.state==='running'&&!paused,clock:context.currentTime,position:context.currentTime-base,entries:medley.starts.map((start,i)=>({song:medley.queue[i],start,end:medley.starts[i+1]??teamTotalDuration}))})}
 if(teamMedley){
  if(teamEndTimer){clearTimeout(teamEndTimer);teamEndTimer=null}
  const source=teamSources[0],token=teamPlayToken;
  if(source)source.addEventListener('ended',()=>{if(token!==teamPlayToken||!teamSources.includes(source))return;teamSavedDuration=teamTotalDuration;teamStoppedPosition=teamTotalDuration;stopAudio()},{once:true});
 }else armTeamEndTimer(Math.max(0,(teamTotalDuration-offset+.2)*1000));
}
async function playSong(s,fromQueue=false){
 const wasMedley=!!teamMedley;
 if(!fromQueue)clearAllQueue();
 if(!wasMedley&&current&&current.name===s.name&&current.productionNumber===s.productionNumber&&teamBuffers){togglePause();return}
 stopAudio(true,fromQueue);const token=++teamPlayToken;current=s;
 $("miniPlayer").hidden=false;$("miniTitle").textContent=s.name;$("miniState").textContent="読み込み中…";window.OuenkaTransport?.mount({state:()=>({busy:true,title:"音源を検索中…"}),stop:()=>{stopAudio();window.OuenkaTransport?.hide()}});
 document.querySelectorAll(".song-row").forEach(x=>x.classList.toggle("playing",x.dataset.key===s.name+"#"+s.productionNumber));setMediaSession(s);
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error("AudioContext非対応");
  const ctx=await window.ouenkaAudioRecovery.create();teamAudioContext=ctx;
  // A special recording is a complete mix and must play without added accompaniment.
  const special=await fetchTeamSpecial(ctx,s);
  let timeline;
  if(special){timeline=[{buffer:special,start:0}]}else{
   const [audio,normalAccompaniment,openingAccompaniment]=await Promise.all([
    fetchDecoded(ctx,s,"audio.m4a"),fetchDecoded(ctx,s,"accompaniment.m4a"),
    fetchDecoded(ctx,s,"intro_accompaniment.m4a").catch(()=>null)
   ]);
   timeline=[{buffer:audio,start:0},{buffer:openingAccompaniment||normalAccompaniment,start:0}];
  }
  if(token!==teamPlayToken){try{await ctx.close()}catch(_){};return}
  teamTimeline=timeline;teamBuffers=timeline.map(x=>x.buffer);
  teamTotalDuration=Math.max(...teamTimeline.map(x=>x.start+x.buffer.duration));
  teamPauseOffset=0;teamStoppedPosition=0;teamSavedDuration=teamTotalDuration;paused=false;startSyncedBuffers(0);attachTeamTransport(s);
  $("miniState").textContent="再生中";if(navigator.mediaSession)navigator.mediaSession.playbackState="playing";
 }catch(e){console.warn("球団別同期再生エラー",e);if(token===teamPlayToken){window.OuenkaTransport?.hide();stopAudio();$("teamStatus").style.display="block";$("teamStatus").textContent=s.name+"を再生できませんでした。もう一度お試しください"}}
}
async function togglePause(){
 if(!teamAudioContext||!teamBuffers)return;
 if(paused){
  try{
   await teamAudioContext.resume();
   paused=false;
   if(!teamMedley)armTeamEndTimer(teamRemainingMs||Math.max(0,(teamTotalDuration-teamPauseOffset+.2)*1000));
   $("miniState").textContent="再生中";
   if(navigator.mediaSession)navigator.mediaSession.playbackState="playing";
  }catch(e){console.warn(e)}
 }else{
  try{
   teamPauseOffset=Math.max(0,teamAudioContext.currentTime-teamStartedAt);
   if(teamEndTimer){
    clearTimeout(teamEndTimer);teamEndTimer=null;
    teamRemainingMs=Math.max(0,teamRemainingMs-(performance.now()-teamTimerStartedAt));
   }
   await teamAudioContext.suspend();
   paused=true;
   $("miniState").textContent="一時停止";
   if(navigator.mediaSession)navigator.mediaSession.playbackState="paused";
  }catch(e){console.warn(e)}
 }
}
function setMediaSession(s){if(!("mediaSession" in navigator))return;try{navigator.mediaSession.metadata=new MediaMetadata({title:s.name,artist:team,album:"OUENKA BASE"});navigator.mediaSession.setActionHandler("play",()=>{if(paused)togglePause()});navigator.mediaSession.setActionHandler("pause",()=>{if(!paused)togglePause()});navigator.mediaSession.setActionHandler("stop",()=>stopAudio())}catch(e){console.warn("MediaSession",e)}}
function preloadVisible(){visibleSongs().slice(0,4).forEach(s=>[s.audioUrl,s.accompanimentUrl].forEach(url=>{const a=new Audio();a.preload="metadata";a.src=url}))}
document.querySelectorAll(".filter").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));render();preloadVisible()}));
$("miniPause").addEventListener("click",async()=>{
 if(!teamAudioContext||!teamBuffers||paused)return;
 await togglePause();
});
$("miniPlay").addEventListener("click",async()=>{
 if(!teamAudioContext||!teamBuffers)return;
 if(paused) await togglePause();
});
$("miniStop").addEventListener("click",()=>stopAudio());
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&current&&!paused)$("miniState").textContent="再生中"});
$("teamFavoritesButton").addEventListener("click",()=>{favoritesOnly=!favoritesOnly;render();preloadVisible()});
window.addEventListener("ouenka-favorites-change",render);
loadSongs();

function attachTeamTransport(song){const queue=()=>visibleSongs(),index=()=>queue().findIndex(s=>s.name===song.name&&s.productionNumber===song.productionNumber);window.OuenkaTransport?.mount({state:()=>({title:current?.name||song.name,duration:teamTotalDuration||teamSavedDuration,currentTime:teamAudioContext?Math.min(teamTotalDuration,Math.max(0,teamAudioContext.currentTime-teamStartedAt)):teamStoppedPosition,playing:!!teamAudioContext&&!paused&&teamAudioContext.state==='running',paused,hasPrevious:index()>0,hasNext:index()>=0&&index()<queue().length-1}),pause:()=>{if(!paused)return togglePause()},play:async()=>{if(!teamAudioContext){const at=teamStoppedPosition;await playSong(song);if(at>0){teamPauseOffset=at;startSyncedBuffers(at)}return}if(paused)return togglePause()},stop:()=>{const duration=teamTotalDuration;stopAudio();teamTotalDuration=duration;teamStoppedPosition=0},previous:()=>{const i=index();if(i>0)return playSong(queue()[i-1])},next:()=>{const i=index();if(i>=0&&i+1<queue().length)return playSong(queue()[i+1])},seek:position=>{if(!teamAudioContext){teamStoppedPosition=Math.min(teamTotalDuration||teamSavedDuration,Math.max(0,position));return}const time=Math.min(teamTotalDuration,Math.max(0,position));teamPauseOffset=time;startSyncedBuffers(time);if(paused&&teamEndTimer){clearTimeout(teamEndTimer);teamEndTimer=null}}})}

$("teamPlayAll").addEventListener("click",()=>playTeamMedley());

async function playTeamMedley(queue=visibleSongs()){
 queue=[...queue];if(!queue.length)return;
 stopAudio();const token=++teamPlayToken;
 teamMedley={queue,starts:[],index:-1};
 $('teamPlayAll').setAttribute('aria-pressed','true');$('miniPlayer').hidden=false;$('miniState').textContent='メドレーを作成中…';window.OuenkaTransport?.mount({state:()=>({busy:true,title:'音源を検索中…'}),stop:()=>{stopAudio();window.OuenkaTransport?.hide()}});
 $('teamStatus').style.display='block';$('teamStatus').textContent='メドレー用音源を読み込み中… 0 / '+queue.length;
 let ctx;
 try{
  ctx=await window.ouenkaAudioRecovery.create();
  if(token!==teamPlayToken){ctx.close().catch(()=>{});return}teamAudioContext=ctx;
  const cancelled=()=>{if(token!==teamPlayToken)throw Error('cancelled')};
  const timeline=await window.OuenkaMedleyCore.build(ctx,queue,{
   load:async(song,file,optional)=>{try{return await fetchDecoded(ctx,song,file)}catch(error){if(optional)return null;throw error}},
   cancelled,onProgress:(loaded,total)=>{$('teamStatus').textContent='メドレー用音源を読み込み中… '+loaded+' / '+total}
  });cancelled();
  const {buffer,starts}=timeline;
  teamMedley={queue,starts,index:-1};teamBuffers=[buffer];teamTimeline=[{buffer,start:0}];teamTotalDuration=buffer.duration;teamSavedDuration=buffer.duration;teamStoppedPosition=0;paused=false;
  $('teamStatus').style.display='none';$('miniState').textContent='メドレー再生中';startSyncedBuffers();updateTeamMedley();attachTeamMedleyTransport(queue,starts);
  if(navigator.mediaSession)navigator.mediaSession.playbackState='playing';
 }catch(error){
  if(token!==teamPlayToken){if(ctx&&ctx!==teamAudioContext)ctx.close().catch(()=>{});return}
  stopAudio();window.OuenkaTransport?.hide();$('teamStatus').style.display='block';$('teamStatus').textContent=error.message||'メドレーを再生できませんでした。';
 }
}
function teamMedleyPosition(){return teamAudioContext?Math.min(teamTotalDuration,Math.max(0,teamAudioContext.currentTime-teamStartedAt)):teamStoppedPosition}
function updateTeamMedley(){
 if(!teamMedley?.starts.length)return;
 const at=teamMedleyPosition();let index=0;while(index+1<teamMedley.starts.length&&at>=teamMedley.starts[index+1])index++;
 if(index===teamMedley.index)return;teamMedley.index=index;current=teamMedley.queue[index];
 $('miniTitle').textContent=current.name;setMediaSession(current);
 document.querySelectorAll('.song-row').forEach(row=>row.classList.toggle('playing',row.dataset.key===current.name+'#'+current.productionNumber));
}
function attachTeamMedleyTransport(queue,starts){
 const index=()=>{const at=teamMedleyPosition();let i=0;while(i+1<starts.length&&at>=starts[i+1])i++;return i};
 async function seek(position){
  if(!teamAudioContext){teamStoppedPosition=Math.max(0,Math.min(teamSavedDuration,position));return}
  teamPauseOffset=Math.max(0,Math.min(teamTotalDuration,position));
  if(teamPauseOffset>=teamTotalDuration){teamStoppedPosition=teamTotalDuration;stopAudio();return}
  startSyncedBuffers(teamPauseOffset);updateTeamMedley();
 }
 window.OuenkaTransport?.mount({state:()=>{updateTeamMedley();const i=index();return {title:current?.name||queue[i].name,duration:teamTotalDuration||teamSavedDuration,currentTime:teamMedleyPosition(),playing:!!teamAudioContext&&!paused&&teamAudioContext.state==='running',paused,hasPrevious:i>0,hasNext:i<queue.length-1}},pause:()=>{if(!paused)return togglePause()},play:async()=>{if(!teamAudioContext){const at=teamStoppedPosition;await playTeamMedley(queue);if(at>0)seek(at);return}if(paused)return togglePause()},stop:()=>{stopAudio();teamStoppedPosition=0},previous:()=>seek(starts[Math.max(0,index()-1)]),next:()=>seek(starts[Math.min(starts.length-1,index()+1)]),seek});
}
