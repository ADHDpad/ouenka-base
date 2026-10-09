const DATA_API="https://ouenka-base-data.ninzin5600.workers.dev";
const PUBLIC_BASE="https://adhdpad.github.io/ouenka-base/";
const params=new URLSearchParams(location.search);
const team=params.get("team")||"北海道日本ハムファイターズ";
let songs=[],filter="all",current=null,currentAudios=[],paused=false;
let teamAudioContext=null,teamSources=[],teamPlayToken=0,teamStartedAt=0,teamPauseOffset=0,teamBuffers=null,teamTimeline=[],teamTotalDuration=0;
let teamEndTimer=null,teamRemainingMs=0,teamTimerStartedAt=0;
const $=id=>document.getElementById(id);
$("teamTitle").textContent=team;
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
function visibleSongs(){return songs.filter(s=>filter==="all"||(filter==="active"?s.isActive:!s.isActive))}
function render(){
 const list=$("songList"), arr=visibleSongs(); list.innerHTML=""; $("teamStatus").style.display=arr.length?"none":"block"; if(!arr.length){$("teamStatus").textContent="該当する応援歌はありません";return}
 arr.forEach((s,i)=>{const row=document.createElement("article");row.className="song-row";row.dataset.key=s.name+"#"+s.productionNumber;
   const num=s.uniformNumber!==""?s.uniformNumber:"—";
   row.innerHTML=`<div class="number"></div><div class="name"></div><span class="tag ${s.isActive?'active':'ob'}">${s.isActive?'現役':'OB'}</span><div class="lyrics"></div><button class="play" type="button" aria-label="${escapeHtml(s.name)}を再生">▶</button><span class="arrow">›</span>`;
   row.querySelector(".number").textContent=num;row.querySelector(".name").textContent=s.name;row.querySelector(".lyrics").textContent=String(s.lyrics).replace(/\n/g," ").replace(/\s+/g," ").trim();
   row.querySelector(".play").addEventListener("click",e=>{e.stopPropagation();playSong(s)});row.addEventListener("click",()=>playSong(s));list.appendChild(row);
 });
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function stopAudio(clear=true){
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
function audibleEnd(buffer){
 const sr=buffer.sampleRate,block=Math.max(1,Math.floor(sr*.020));
 const threshold=Math.pow(10,-48/20);let last=0;
 for(let i=0;i<buffer.length;i+=block){const to=Math.min(buffer.length,i+block);let peak=0;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let j=i;j<to;j++)peak=Math.max(peak,Math.abs(data[j]))}if(peak>threshold)last=to}
 return last/sr;
}
function introJoinOffset(melody,accompaniment){
 const BAR_SEC=(60/170)*4;
 const end=Math.max(audibleEnd(melody),audibleEnd(accompaniment));
 const bars=Math.max(2,Math.ceil(Math.max(0,end-.035)/BAR_SEC));
 return Math.max(0,(bars-2)*BAR_SEC);
}
function armTeamEndTimer(ms){
 if(teamEndTimer){clearTimeout(teamEndTimer);teamEndTimer=null}
 teamRemainingMs=Math.max(0,ms);
 teamTimerStartedAt=performance.now();
 const token=teamPlayToken;
 teamEndTimer=setTimeout(()=>{
  teamEndTimer=null;
  if(token===teamPlayToken&&!paused)stopAudio();
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
 armTeamEndTimer(Math.max(0,(teamTotalDuration-offset+.2)*1000));
}
async function playSong(s){
 if(current&&current.name===s.name&&current.productionNumber===s.productionNumber&&teamBuffers){togglePause();return}
 stopAudio();const token=++teamPlayToken;current=s;
 $("miniPlayer").hidden=false;$("miniTitle").textContent=s.name;$("miniState").textContent="読み込み中…";
 document.querySelectorAll(".song-row").forEach(x=>x.classList.toggle("playing",x.dataset.key===s.name+"#"+s.productionNumber));setMediaSession(s);
 try{
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error("AudioContext非対応");
  const ctx=await window.ouenkaAudioRecovery.create();teamAudioContext=ctx;
  const [audio,normalAccompaniment,openingAccompaniment]=await Promise.all([
   fetchDecoded(ctx,s,"audio.m4a"),fetchDecoded(ctx,s,"accompaniment.m4a"),
   fetchDecoded(ctx,s,"intro_accompaniment.m4a").catch(()=>null)
  ]);
  if(token!==teamPlayToken){try{await ctx.close()}catch(_){};return}
  const accompaniment=openingAccompaniment||normalAccompaniment;
  teamBuffers=[audio,accompaniment];
  teamTimeline=[{buffer:audio,start:0},{buffer:accompaniment,start:0}];
  teamTotalDuration=Math.max(...teamTimeline.map(x=>x.start+x.buffer.duration));
  teamPauseOffset=0;paused=false;startSyncedBuffers(0);
  $("miniState").textContent="再生中";if(navigator.mediaSession)navigator.mediaSession.playbackState="playing";
 }catch(e){console.warn("球団別同期再生エラー",e);if(token===teamPlayToken){$("miniState").textContent="再生できませんでした"}}
}
async function togglePause(){
 if(!teamAudioContext||!teamBuffers)return;
 if(paused){
  try{
   await teamAudioContext.resume();
   paused=false;
   armTeamEndTimer(teamRemainingMs||Math.max(0,(teamTotalDuration-teamPauseOffset+.2)*1000));
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
loadSongs();
