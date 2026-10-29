(()=>{'use strict';
const MEDLEY_BAR_SEC=(60/170)*4;
// All continuous playback uses the same song-local timing as the approved 1-9.
function tempo(song){return Number(song?.tempo)===140?140:170}
function barSecondsForSong(song){return 240/tempo(song)}
function getSongJoinOffsetSec(song,openingExtraSec=0){
 const bar=barSecondsForSong(song),total=Math.max(song.melody.duration,song.accompaniment.duration),body=Number.isFinite(song.bodyDurationSec)?song.bodyDurationSec:Math.max(0,total-openingExtraSec);
 const bars=Math.max(1,Math.round(body/bar)),musicalBars=bars>=13?16:8;
 return openingExtraSec+musicalBars*bar;
}
// Approved 140→140 preview: bring the next file forward by exactly one bar.
// Use this boundary rule for normal sequences and every loop wrap alike.
function getTransitionOffsetSec(song,next,openingExtraSec=0){
 const offset=getSongJoinOffsetSec(song,openingExtraSec);
 return tempo(song)===140&&tempo(next)===140?offset-barSecondsForSong(song):offset;
}
function buildDynamicSongStarts(songs,openingExtraSec=0){
 let cursor=0;return songs.map((song,i)=>{const start=cursor;if(i<songs.length-1)cursor+=getTransitionOffsetSec(song,songs[i+1],i===0?openingExtraSec:0);return start});
}
const registrationKey=(name,number)=>String(name||'').normalize('NFKC').trim()+'#'+String(number??'').trim();
async function resolveSongs(input,options={}){
 const timeout=AbortSignal.timeout(15000),signal=options.signal&&AbortSignal.any?AbortSignal.any([options.signal,timeout]):options.signal||timeout;
 const response=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal});
 if(!response.ok)throw Error('登録テンポを確認できませんでした。通信状態を確認して再度お試しください。');
 const data=await response.json();if(!Array.isArray(data.songs))throw Error('登録データの形式を確認できませんでした。');
 const catalog=new Map(data.songs.map(song=>[registrationKey(song.player_name??song.name,song.production_number??song.productionNumber),song]));
 return input.map(original=>{
  const source=original.audioSource||original,name=source.reuseName||source.player_name||source.name,number=source.reuseProductionNumber||source.production_number||source.productionNumber;
  const song=catalog.get(registrationKey(name,number));
  if(!song)throw Error(`${name}（制作番号 ${number||'未設定'}）の登録データが見つかりません。`);
  return {...original,...song,name:String(song.player_name??song.name),productionNumber:String(song.production_number??song.productionNumber),tempo:tempo(song)};
 });
}
async function build(ctx,items,options={}){
 if(!items.length)throw Error('結合する音源がありません。');
 if(typeof options.load!=='function')throw Error('音源の読み込み処理が設定されていません。');
 const load=options.load,opening=options.opening!==false,separated=new Array(items.length);let cursor=0,loaded=0,failed=false;
 const cancelled=()=>{options.cancelled?.();if(failed)throw Error('音源の作成を中断しました。')};
 async function optional(item,file){try{return await load(item,file,true)}catch(error){cancelled();return null}}
 async function worker(){while(cursor<items.length){cancelled();const i=cursor++,item=items[i];try{
  const first=i===0&&opening;
  let usedOpeningMelody=false;
  const [melody,normalAccompaniment,openingAccompaniment]=await Promise.all([
   first?optional(item,'audio.m4a').then(buffer=>{usedOpeningMelody=!!buffer;return buffer||load(item,'melody.m4a',false)}):load(item,'melody.m4a',false),
   load(item,'accompaniment.m4a',false),first?optional(item,'intro_accompaniment.m4a'):Promise.resolve(null)
  ]);
  cancelled();separated[i]={tempo:tempo(item),melody,accompaniment:openingAccompaniment||normalAccompaniment,normalAccompaniment,usedOpeningMelody,hasOpeningAccompaniment:!!openingAccompaniment};
  options.onProgress?.(++loaded,items.length);
 }catch(error){failed=true;throw Error(`${item.name||item.player_name||'応援歌'} の音源を読み込めませんでした。\n${error.message||error}`)}}}
 await Promise.all(Array.from({length:Math.min(Math.max(1,options.concurrency||3),items.length)},worker));cancelled();
 let openingExtraSec=0;
 // audio.m4a may include an introduction even when intro_accompaniment.m4a
 // was never exported. Always compare with the body melody in that case.
 // Both the introduction and the next song's first bar use this song's BPM.
 if(opening&&(separated[0].usedOpeningMelody||separated[0].hasOpeningAccompaniment)){
  const normalMelody=await optional(items[0],'melody.m4a');cancelled();
  const first=separated[0],bar=barSecondsForSong(first);
  const melodyExtra=normalMelody&&first.usedOpeningMelody?Math.max(0,first.melody.duration-normalMelody.duration):0;
  const chordExtra=first.hasOpeningAccompaniment?Math.max(0,first.accompaniment.duration-first.normalAccompaniment.duration):0;
  openingExtraSec=Math.round(Math.max(melodyExtra,chordExtra)/bar)*bar;
  // Classify the body as 8/16 bars from body files, not intro-included length.
  // Keep the legacy classification when no separate body melody is available.
  if(normalMelody&&openingExtraSec>0)first.bodyDurationSec=Math.max(normalMelody.duration,first.normalAccompaniment.duration);
 }
 const originalStarts=buildDynamicSongStarts(separated,openingExtraSec);
 const callPlan=options.callsRows&&window.OuenkaCalls?await window.OuenkaCalls.plan(ctx,separated,originalStarts,options.callsRows):{starts:originalStarts,events:[]};cancelled();
 let buffer=mixSmoothIndependent(ctx,separated,null,callPlan.starts);
 if(options.callsRows&&window.OuenkaCalls)buffer=window.OuenkaCalls.decorate(ctx,buffer,callPlan);cancelled();
 return {buffer,starts:callPlan.starts,originalStarts,separated,openingExtraSec,callPlan,duration:buffer.duration,rowIndices:options.rowIndices||items.map((_,i)=>i),barSeconds:barSecondsForSong(separated[0]),barSecondsBySong:separated.map(barSecondsForSong),tempos:separated.map(tempo)};
}
function mixSmoothIndependent(ctx,songs,intro,starts,range=null){
 const sampleRate=songs[0].melody.sampleRate;
 const channels=Math.max(
  ...songs.flatMap(s=>[s.melody.numberOfChannels,s.accompaniment.numberOfChannels]),
  ...(intro?[intro.melody.numberOfChannels,intro.accompaniment.numberOfChannels]:[])
 );
 const startFrames=starts.map(v=>Math.round(v*sampleRate));
 const rangeStart=range?Math.round(range[0]*sampleRate):0;
 const totalFrames=range?Math.round((range[1]-range[0])*sampleRate):Math.max(
  ...songs.map((song,i)=>startFrames[i]+Math.max(song.melody.length,song.accompaniment.length)),
  ...(intro?[Math.max(intro.melody.length,intro.accompaniment.length)]:[0])
 );
 const melodyBus=ctx.createBuffer(channels,totalFrames,sampleRate);
 const accompanimentBus=ctx.createBuffer(channels,totalFrames,sampleRate);

 const blockSize=Math.max(64,Math.round(sampleRate*0.006));
 const threshold=Math.pow(10,-42/20);
 const activityCache=new WeakMap();

 function getActivity(buffer,ch){
  let byChannel=activityCache.get(buffer);
  if(!byChannel){byChannel=new Map();activityCache.set(buffer,byChannel)}
  const realCh=Math.min(ch,buffer.numberOfChannels-1);
  if(byChannel.has(realCh))return byChannel.get(realCh);
  const data=buffer.getChannelData(realCh);
  const blocks=Math.ceil(data.length/blockSize);
  const active=new Uint8Array(blocks);
  for(let b=0;b<blocks;b++){
   const from=b*blockSize,to=Math.min(data.length,from+blockSize);
   let sum=0;
   for(let i=from;i<to;i++){const v=data[i];sum+=v*v}
   active[b]=Math.sqrt(sum/Math.max(1,to-from))>threshold?1:0;
  }
  byChannel.set(realCh,active);
  return active;
 }

 function addIndependentTrack(target,cur,curStart,next,nextStart,ch){
  const out=target.getChannelData(ch);
  const src=cur.getChannelData(Math.min(ch,cur.numberOfChannels-1));
  const curActivity=getActivity(cur,ch);
  const nextActivity=next?getActivity(next,ch):null;
  const overlapStart=next?Math.max(curStart,nextStart):Infinity;
  const overlapEnd=next?Math.min(curStart+cur.length,nextStart+next.length):-Infinity;
  // 次曲の音が存在する区間では前曲側だけを抑制。
  // ブロック境界は3msの滑らかな遷移でクリックノイズを防ぐ。
  const fadeFrames=Math.max(1,Math.round(sampleRate*0.003));
  let gain=1;
  const gainStep=1/fadeFrames;
  for(let f=0;f<cur.length;f++){
   const global=curStart+f;
   let targetGain=1;
   if(global>=overlapStart && global<overlapEnd && nextActivity){
    const nextLocal=global-nextStart;
    const cb=Math.min(curActivity.length-1,Math.floor(f/blockSize));
    const nb=Math.min(nextActivity.length-1,Math.floor(nextLocal/blockSize));
    if(curActivity[cb]&&nextActivity[nb])targetGain=0;
   }
   gain=targetGain===0?Math.max(0,gain-gainStep):Math.min(1,gain+gainStep);
   const target=global-rangeStart;if(target>=0&&target<out.length)out[target]+=src[f]*gain;
  }
 }

 for(let ch=0;ch<channels;ch++){
  if(intro){
   addIndependentTrack(melodyBus,intro.melody,0,songs[0].melody,startFrames[0],ch);
   addIndependentTrack(accompanimentBus,intro.accompaniment,0,songs[0].accompaniment,startFrames[0],ch);
  }
  for(let i=0;i<songs.length;i++){
   const next=i<songs.length-1?songs[i+1]:null;
   const nextStart=next?startFrames[i+1]:0;
   addIndependentTrack(melodyBus,songs[i].melody,startFrames[i],next?next.melody:null,nextStart,ch);
   addIndependentTrack(accompanimentBus,songs[i].accompaniment,startFrames[i],next?next.accompaniment:null,nextStart,ch);
  }
 }
 const output=ctx.createBuffer(channels,totalFrames,sampleRate);
 for(let ch=0;ch<channels;ch++){
  const dst=output.getChannelData(ch),mel=melodyBus.getChannelData(ch),acc=accompanimentBus.getChannelData(ch);
  for(let i=0;i<totalFrames;i++){const x=mel[i]+acc[i];dst[i]=Math.max(-1,Math.min(1,x*0.75));}
 }
 return output;
}
function combine(ctx,buffers){
 const rate=buffers[0].sampleRate,channels=Math.max(...buffers.map(b=>b.numberOfChannels));
 const out=ctx.createBuffer(channels,buffers.reduce((sum,b)=>sum+b.length,0),rate);
 for(let ch=0;ch<channels;ch++){let at=0;for(const b of buffers){out.getChannelData(ch).set(b.getChannelData(Math.min(ch,b.numberOfChannels-1)),at);at+=b.length}}
 return out;
}
function seamless(ctx,first,normal,decorate=(buffer)=>buffer){
 const initial=first.separated,body=normal.separated,n=body.length;
 const initialJoin=getTransitionOffsetSec(initial[n-1],body[0],n===1?(first.openingExtraSec||0):0);
 const prefixDuration=first.starts[n-1]+initialJoin;
 const period=normal.starts[n-1]+getTransitionOffsetSec(body[n-1],body[0]);
 const prefix=decorate(mixSmoothIndependent(ctx,[...initial,body[0]],null,[...first.starts,prefixDuration],[0,prefixDuration]),first.callPlan);
 const tailJoin=getTransitionOffsetSec(body[n-1],body[0]);
 const steady=decorate(mixSmoothIndependent(ctx,[body[n-1],...body,body[0]],null,[-tailJoin,...normal.starts,period],[0,period]),normal.callPlan);
 const buffers=[prefix],starts=[...first.starts],indices=[...first.rowIndices];let offset=prefix.duration;
 // A single-song opening can have a different tail: render the first wrap separately.
 if(n===1){
  const transition=decorate(mixSmoothIndependent(ctx,[initial[0],body[0],body[0]],null,[-initialJoin,0,period],[0,period]),normal.callPlan);
  buffers.push(transition);starts.push(offset);indices.push(normal.rowIndices[0]);offset+=transition.duration;
 }
 const loopStart=offset;
 buffers.push(steady);starts.push(...normal.starts.map(v=>loopStart+v));indices.push(...normal.rowIndices);
 const buffer=combine(ctx,buffers);
 return {buffer,starts,rowIndices:indices,duration:buffer.duration,loopStart,loopEnd:buffer.duration,isSeamlessLoop:true,prefixDuration:prefix.duration,normalStarts:normal.starts,normalDuration:steady.duration,normalRowIndices:normal.rowIndices,firstTimeline:first,barSeconds:first.barSeconds||barSecondsForSong(initial[0]),barSecondsBySong:[...(first.barSecondsBySong||initial.map(barSecondsForSong)),...(n===1?[barSecondsForSong(body[0])]:[]),...body.map(barSecondsForSong)],tempos:[...initial.map(tempo),...(n===1?[tempo(body[0])]:[]),...body.map(tempo)],normalBarSecondsBySong:body.map(barSecondsForSong)};
}
window.OuenkaMedleyCore={getTransitionOffsetSec,build,resolveSongs,tempo,barSecondsForSong,seamless,barSeconds:MEDLEY_BAR_SEC,buildDynamicSongStarts,getSongJoinOffsetSec,mix:mixSmoothIndependent};
})();
