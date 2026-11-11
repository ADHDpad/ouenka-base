(()=>{'use strict';
const MEDLEY_BAR_SEC=(60/170)*4;
// All continuous playback uses the same song-local timing as the approved 1-9.
function tempo(song){return Number(song?.tempo)===140?140:170}
function barSecondsForSong(song){return 240/tempo(song)}
function getSongJoinOffsetSec(song,openingExtraSec=0){
 const bar=barSecondsForSong(song),total=Math.max(song.melody.duration,song.accompaniment.duration),body=Number.isFinite(song.bodyDurationSec)?song.bodyDurationSec:Math.max(0,total-openingExtraSec);
 // Body exports include the two-bar shared boundary. Preserve that overlap
 // for every length instead of coercing 9/12-bar tunes into 8/16.
 const bars=Math.max(1,Math.round(body/bar)),musicalBars=Math.max(1,bars-2);
 return openingExtraSec+musicalBars*bar;
}
// Only a BPM change inserts a silent half-bar. Equal-BPM overlaps stay unchanged.
const transitionBoundsCache=new WeakMap();
function transitionBounds(buffer){
 if(transitionBoundsCache.has(buffer))return transitionBoundsCache.get(buffer);
 const threshold=Math.pow(10,-45/20);let first=buffer.length,last=-1;
 for(let ch=0;ch<buffer.numberOfChannels;ch++){
  const data=buffer.getChannelData(ch);let a=0,b=data.length-1;
  while(a<data.length&&Math.abs(data[a])<threshold)a++;
  while(b>=a&&Math.abs(data[b])<threshold)b--;
  if(b>=a){first=Math.min(first,a);last=Math.max(last,b);}
 }
 const result=last<0?null:{start:first/buffer.sampleRate,end:(last+1)/buffer.sampleRate};
 transitionBoundsCache.set(buffer,result);return result;
}
function transitionSongBounds(song){
 const bounds=[song.melody,song.timingAccompaniment??song.accompaniment].map(transitionBounds).filter(Boolean);
 return bounds.length?{start:Math.min(...bounds.map(b=>b.start)),end:Math.max(...bounds.map(b=>b.end))}:null;
}
function getTransitionOffsetSec(song,next,openingExtraSec=0){
 if(tempo(song)!==tempo(next)){
  const current=transitionSongBounds(song),following=transitionSongBounds(next);
  if(current&&following)return Math.max(0,current.end+barSecondsForSong(song)/2-following.start);
 }
 return getSongJoinOffsetSec(song,openingExtraSec);
}
function buildDynamicSongStarts(songs,openingExtraSec=0){
 let cursor=0;return songs.map((song,i)=>{const start=cursor;if(i<songs.length-1)cursor+=getTransitionOffsetSec(song,songs[i+1],i===0?openingExtraSec:0);return start});
}
const registrationKey=(name,number)=>String(name||'').normalize('NFKC').trim()+'#'+String(number??'').trim();
function registeredAudioUrls(song,playerName,productionNumber){
 if(!song)return null;
 const name=String(song.player_name||song.name||playerName||"").trim();
 const no=String(song.production_number||song.productionNumber||productionNumber||"").trim();
 const audioFile=String(song.audio_filename||song.audioFilename||"audio.m4a").trim();
 const medleyFile=String(song.medley_filename||song.medleyFilename||"medley.m4a").trim();
 if(!name||!no)return null;
 const base="https://adhdpad.github.io/ouenka-base/"+"%E3%83%87%E3%83%BC%E3%82%BF/"+encodeURIComponent(name)+"/"+encodeURIComponent(no)+"/";
 return{playerName:name,productionNumber:no,audioUrl:base+encodeURIComponent(audioFile),medleyUrl:base+encodeURIComponent(medleyFile),melodyUrl:base+"melody.m4a",accompanimentUrl:base+"accompaniment.m4a",introMelodyUrl:base+"intro_melody.m4a",introAccompanimentUrl:base+"intro_accompaniment.m4a"};
}

let recentCatalog=null;
async function loadCatalog(options){
 const now=Date.now();
 if(options.reuseCatalog&&recentCatalog&&now-recentCatalog.loadedAt<60000)return recentCatalog.songs;

 const timeout=AbortSignal.timeout(15000),signal=options.signal&&AbortSignal.any?AbortSignal.any([options.signal,timeout]):options.signal||timeout;
 const response=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal});
 if(!response.ok)throw Error('登録テンポを確認できませんでした。通信状態を確認して再度お試しください。');
 const data=await response.json();if(!Array.isArray(data.songs))throw Error('登録データの形式を確認できませんでした。');
 if(options.reuseCatalog)recentCatalog={loadedAt:Date.now(),songs:data.songs};
 return data.songs;
}
async function resolveSongs(input,options={}){
 const catalog=new Map((await loadCatalog(options)).map(song=>[registrationKey(song.player_name??song.name,song.production_number??song.productionNumber),song]));
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
  cancelled();
  const source=openingAccompaniment||normalAccompaniment;
  const accompaniment=window.OuenkaPlaybackSpeed?.tuneAccompaniment?.(ctx,item,source)??source;
  separated[i]={tempo:tempo(item),melody,accompaniment,timingAccompaniment:accompaniment===source?undefined:source,normalAccompaniment,usedOpeningMelody,hasOpeningAccompaniment:!!openingAccompaniment};
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
 const timeline={starts:callPlan.starts,originalStarts,separated,openingExtraSec,callPlan,rowIndices:options.rowIndices||items.map((_,i)=>i),barSeconds:barSecondsForSong(separated[0]),barSecondsBySong:separated.map(barSecondsForSong),tempos:separated.map(tempo)};
 if(options.render===false)return timeline;
 const levels=options.linearHeadroom?{peak:0}:null;
 let buffer=mixSmoothIndependent(ctx,separated,null,callPlan.starts,null,null,levels);
 applyHeadroom(buffer,levels);
 if(options.callsRows&&window.OuenkaCalls)buffer=window.OuenkaCalls.decorate(ctx,buffer,callPlan);cancelled();
 return {...timeline,buffer,duration:buffer.duration};
}
function mixSmoothIndependent(ctx,songs,intro,starts,range=null,destination=null,levels=null){
 const sampleRate=songs[0].melody.sampleRate;
 const channels=destination?.buffer.numberOfChannels??Math.max(
  ...songs.flatMap(s=>[s.melody.numberOfChannels,s.accompaniment.numberOfChannels]),
  ...(intro?[intro.melody.numberOfChannels,intro.accompaniment.numberOfChannels]:[])
 );
 const startFrames=starts.map(v=>Math.round(v*sampleRate));
 const rangeStart=range?Math.round(range[0]*sampleRate):0;
 const totalFrames=range?Math.round((range[1]-range[0])*sampleRate):Math.max(
  ...songs.map((song,i)=>startFrames[i]+Math.max(song.melody.length,song.accompaniment.length)),
  ...(intro?[Math.max(intro.melody.length,intro.accompaniment.length)]:[0])
 );
 const output=destination?.buffer??ctx.createBuffer(channels,totalFrames,sampleRate);
 const chunkFrames=Math.min(totalFrames,262144);
 const accompaniment=new Float32Array(chunkFrames);

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

 function addIndependentTrack(out,cur,curStart,next,nextStart,ch,chunkStart){
  const src=cur.getChannelData(Math.min(ch,cur.numberOfChannels-1));
  const from=Math.max(0,chunkStart-curStart),to=Math.min(src.length,chunkStart+out.length-curStart);
  if(from>=to)return;
  const overlapStart=next?Math.max(0,nextStart-curStart):src.length;
  const overlapEnd=next?Math.min(src.length,nextStart+next.length-curStart):0;
  const fadeFrames=Math.max(1,Math.round(sampleRate*0.003)),gainStep=1/fadeFrames;
  const offset=curStart-chunkStart;
  // Non-overlapping audio can be added without measuring activity or updating gain.
  if(overlapEnd<=overlapStart||to<=overlapStart||from>overlapEnd+fadeFrames){
   for(let f=from;f<to;f++)out[offset+f]+=src[f];
   return;
  }
  const curActivity=getActivity(cur,ch),nextActivity=getActivity(next,ch);
  for(let f=from;f<Math.min(to,overlapStart);f++)out[offset+f]+=src[f];
  let gain=1;
  // Reconstruct the gain when a work chunk starts partway through an overlap.
  for(let f=overlapStart;f<to;f++){
   const active=f<overlapEnd&&curActivity[Math.floor(f/blockSize)]&&nextActivity[Math.floor((curStart+f-nextStart)/blockSize)];
   gain=active?Math.max(0,gain-gainStep):Math.min(1,gain+gainStep);
   if(f>=from)out[offset+f]+=src[f]*gain;
   if(f>=overlapEnd&&gain===1){
    for(let tail=Math.max(f+1,from);tail<to;tail++)out[offset+tail]+=src[tail];
    break;
   }
  }
 }

 for(let ch=0;ch<channels;ch++){
  const target=output.getChannelData(ch),offset=destination?.offset??0;
  for(let chunk=0;chunk<totalFrames;chunk+=chunkFrames){
   const length=Math.min(chunkFrames,totalFrames-chunk),chunkStart=rangeStart+chunk;
   const melody=target.subarray(offset+chunk,offset+chunk+length);
   const chords=accompaniment.subarray(0,length);
   chords.fill(0);
   if(intro){
    addIndependentTrack(melody,intro.melody,0,songs[0].melody,startFrames[0],ch,chunkStart);
    addIndependentTrack(chords,intro.accompaniment,0,songs[0].accompaniment,startFrames[0],ch,chunkStart);
   }
   for(let i=0;i<songs.length;i++){
    const next=songs[i+1],nextStart=startFrames[i+1]??0;
    addIndependentTrack(melody,songs[i].melody,startFrames[i],next?.melody,nextStart,ch,chunkStart);
    addIndependentTrack(chords,songs[i].accompaniment,startFrames[i],next?.accompaniment,nextStart,ch,chunkStart);
   }
   if(levels){
    let peak=levels.peak;
    for(let i=0;i<length;i++){
     const sample=(melody[i]+chords[i])*0.75;
     melody[i]=sample;
     const magnitude=Math.abs(sample);
     if(magnitude>peak)peak=magnitude;
    }
    levels.peak=peak;
   }else{
    for(let i=0;i<length;i++){
     const sample=(melody[i]+chords[i])*0.75,peak=Math.abs(sample);
     melody[i]=peak<=0.92?sample:Math.sign(sample)*(0.92+0.08*Math.tanh((peak-0.92)/0.08));
    }
   }
  }
 }
 return output;
}
function applyHeadroom(buffer,levels){
 if(!levels||levels.peak<=.98)return;
 // One gain for the whole mix preserves waveform shape and stereo balance.
 const gain=.98/levels.peak;
 for(let ch=0;ch<buffer.numberOfChannels;ch++){
  const samples=buffer.getChannelData(ch);
  for(let i=0;i<samples.length;i++)samples[i]*=gain;
 }
}
function combine(ctx,buffers){
 const rate=buffers[0].sampleRate,channels=Math.max(...buffers.map(b=>b.numberOfChannels));
 const out=ctx.createBuffer(channels,buffers.reduce((sum,b)=>sum+b.length,0),rate);
 for(let ch=0;ch<channels;ch++){let at=0;for(const b of buffers){out.getChannelData(ch).set(b.getChannelData(Math.min(ch,b.numberOfChannels-1)),at);at+=b.length}}
 return out;
}
function seamless(ctx,first,normal,decorate=(buffer)=>buffer,{linearHeadroom=false}={}){
 const levels=linearHeadroom?{peak:0}:null;
 const initial=first.separated,body=normal.separated,n=body.length;
 const initialJoin=getTransitionOffsetSec(initial[n-1],body[0],n===1?(first.openingExtraSec||0):0);
 const prefixDuration=first.starts[n-1]+initialJoin;
 const period=normal.starts[n-1]+getTransitionOffsetSec(body[n-1],body[0]);
 const tailJoin=getTransitionOffsetSec(body[n-1],body[0]);
 const prefixSongs=[...initial,body[0]],prefixStarts=[...first.starts,prefixDuration];
 const steadySongs=[body[n-1],...body,body[0]],steadyStarts=[-tailJoin,...normal.starts,period];
 const starts=[...first.starts],indices=[...first.rowIndices];
 let buffer,prefixLength,normalDuration,loopStart;
 // With no calls, render the prefix and each loop range straight into the final buffer.
 if(!first.callPlan.events.length&&!normal.callPlan.events.length){
  const rate=initial[0].melody.sampleRate;
  const channels=Math.max(...[...initial,...body].flatMap(song=>[song.melody.numberOfChannels,song.accompaniment.numberOfChannels]));
  const prefixFrames=Math.round(prefixDuration*rate),periodFrames=Math.round(period*rate);
  const loopFrame=prefixFrames+(n===1?periodFrames:0);
  buffer=ctx.createBuffer(channels,loopFrame+periodFrames,rate);
  prefixLength=prefixFrames/rate;normalDuration=periodFrames/rate;loopStart=loopFrame/rate;
  mixSmoothIndependent(ctx,prefixSongs,null,prefixStarts,[0,prefixDuration],{buffer,offset:0},levels);
  if(n===1)mixSmoothIndependent(ctx,[initial[0],body[0],body[0]],null,[-initialJoin,0,period],[0,period],{buffer,offset:prefixFrames},levels);
  mixSmoothIndependent(ctx,steadySongs,null,steadyStarts,[0,period],{buffer,offset:loopFrame},levels);
 }else{
  const prefix=decorate(mixSmoothIndependent(ctx,prefixSongs,null,prefixStarts,[0,prefixDuration],null,levels),first.callPlan);
  const steady=decorate(mixSmoothIndependent(ctx,steadySongs,null,steadyStarts,[0,period],null,levels),normal.callPlan);
  const buffers=[prefix];
  prefixLength=prefix.duration;normalDuration=steady.duration;loopStart=prefixLength;
  if(n===1){
   const transition=decorate(mixSmoothIndependent(ctx,[initial[0],body[0],body[0]],null,[-initialJoin,0,period],[0,period],null,levels),normal.callPlan);
   buffers.push(transition);loopStart+=transition.duration;
  }
  buffers.push(steady);buffer=combine(ctx,buffers);
 }
 applyHeadroom(buffer,levels);
 if(n===1){starts.push(prefixLength);indices.push(normal.rowIndices[0]);}
 starts.push(...normal.starts.map(v=>loopStart+v));indices.push(...normal.rowIndices);
 return {buffer,starts,rowIndices:indices,duration:buffer.duration,loopStart,loopEnd:buffer.duration,isSeamlessLoop:true,prefixDuration:prefixLength,normalStarts:normal.starts,normalDuration,normalRowIndices:normal.rowIndices,firstTimeline:{starts:first.starts,rowIndices:first.rowIndices},barSeconds:first.barSeconds||barSecondsForSong(initial[0]),barSecondsBySong:[...(first.barSecondsBySong||initial.map(barSecondsForSong)),...(n===1?[barSecondsForSong(body[0])]:[]),...body.map(barSecondsForSong)],tempos:[...initial.map(tempo),...(n===1?[tempo(body[0])]:[]),...body.map(tempo)],normalBarSecondsBySong:body.map(barSecondsForSong)};
}
window.OuenkaMedleyCore={getTransitionOffsetSec,build,resolveSongs,registeredAudioUrls,tempo,barSecondsForSong,seamless,barSeconds:MEDLEY_BAR_SEC,buildDynamicSongStarts,getSongJoinOffsetSec,mix:mixSmoothIndependent};
})();
