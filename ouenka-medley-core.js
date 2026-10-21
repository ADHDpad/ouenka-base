(()=>{'use strict';
const MEDLEY_BAR_SEC=(60/170)*4;
function getSongJoinOffsetSec(song,openingExtraSec=0){
 const total=Math.max(song.melody.duration,song.accompaniment.duration);
 const body=Math.max(0,total-openingExtraSec);
 const bars=Math.max(1,Math.round(body/MEDLEY_BAR_SEC));
 const musicalBars=bars>=13?16:8;
 return openingExtraSec+musicalBars*MEDLEY_BAR_SEC;
}
function buildDynamicSongStarts(songs,openingExtraSec=0){
 const starts=[];let cursor=0;
 for(let i=0;i<songs.length;i++){
  starts.push(cursor);
  if(i<songs.length-1)cursor+=getSongJoinOffsetSec(songs[i],i===0?openingExtraSec:0);
 }
 return starts;
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
 const initialJoin=getSongJoinOffsetSec(initial[n-1],n===1?(first.openingExtraSec||0):0);
 const prefixDuration=first.starts[n-1]+initialJoin;
 const period=normal.starts[n-1]+getSongJoinOffsetSec(body[n-1]);
 const prefix=decorate(mixSmoothIndependent(ctx,[...initial,body[0]],null,[...first.starts,prefixDuration],[0,prefixDuration]),first.callPlan);
 const tailJoin=getSongJoinOffsetSec(body[n-1]);
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
 return {buffer,starts,rowIndices:indices,duration:buffer.duration,loopStart,loopEnd:buffer.duration,isSeamlessLoop:true,prefixDuration:prefix.duration,normalStarts:normal.starts,normalDuration:steady.duration,normalRowIndices:normal.rowIndices,firstTimeline:first,barSeconds:MEDLEY_BAR_SEC};
}
window.OuenkaMedleyCore={seamless,barSeconds:MEDLEY_BAR_SEC,buildDynamicSongStarts,getSongJoinOffsetSec,mix:mixSmoothIndependent};
})();
