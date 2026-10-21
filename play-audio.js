(()=>{'use strict';
const BASE='https://adhdpad.github.io/ouenka-base/';let ctx=null,sources=[],epoch=0,controller=null,timeline=null,started=0,paused=false,position=0,label='',onTick=null,replay=null,endCallback=null;const cache=new Map();
function urls(song,file){const n=encodeURIComponent(song.name),p=encodeURIComponent(song.productionNumber||'1'),root=BASE+'%E3%83%87%E3%83%BC%E3%82%BF/';return [...new Set([root+n+'/'+p+'/'+file,root+n+'_'+p+'/'+file,root+n+'/'+file,root+n+'/'+p+'_'+file])]}
async function decode(context,song,file,signal){
 let last;
 for(const url of urls(song,file)){
  if(signal.aborted)throw new DOMException('中止','AbortError');
  if(cache.has(url)){const buffer=cache.get(url);cache.delete(url);cache.set(url,buffer);return buffer}
  try{const r=await fetch(url,{signal,credentials:'omit',cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const buffer=await context.decodeAudioData(await r.arrayBuffer());cache.set(url,buffer);while(cache.size>16)cache.delete(cache.keys().next().value);return buffer}catch(error){if(signal.aborted)throw error;last=error}
 }
 throw Error(song.name+' の '+file+' を読み込めませんでした。');
}
function state(){const time=ctx?Math.min(timeline?.duration||0,Math.max(0,ctx.currentTime-started)):position;if(onTick)onTick(time);return {title:label,duration:timeline?.duration||0,currentTime:time,playing:!!ctx&&!paused&&ctx.state==='running',paused,hasPrevious:false,hasNext:false}}
function stop(){epoch++;controller?.abort();controller=null;for(const s of sources){s.onended=null;try{s.stop()}catch{}}sources=[];if(ctx)ctx.close().catch(()=>{});ctx=null;paused=false;position=0;onTick=null;endCallback=null;if(navigator.mediaSession)navigator.mediaSession.playbackState='none';window.OuenkaTransport?.hide()}
function schedule(offset=0){
 const context=ctx,token=epoch;for(const s of sources){s.onended=null;try{s.stop()}catch{}}sources=[];const base=context.currentTime+.04;started=base-offset;position=offset;
 let pending=0;for(const item of timeline.entries){if(offset>=item.start+item.buffer.duration)continue;const source=context.createBufferSource();source.buffer=item.buffer;source.connect(context.destination);source.start(base+Math.max(0,item.start-offset),Math.max(0,offset-item.start),Math.max(0,Math.min(item.buffer.duration-Math.max(0,offset-item.start),timeline.duration-Math.max(offset,item.start))));sources.push(source);pending++;source.onended=()=>{if(token!==epoch||context!==ctx||!sources.includes(source)||--pending>0)return;position=timeline.duration;context.close().catch(()=>{});ctx=null;paused=false;onTick?.(position);const callback=endCallback;endCallback=null;callback?.();if(navigator.mediaSession)navigator.mediaSession.playbackState='none'}}
}
function mount(){window.OuenkaTransport?.mount({state,pause:async()=>{if(ctx){paused=true;await ctx.suspend()}},play:async()=>{if(ctx){paused=false;await ctx.resume()}else await replay?.()},stop,seek:value=>{if(!ctx)return;const at=Math.max(0,Math.min(timeline.duration-.001,Number(value)||0));schedule(at)}},{host:document.getElementById('playTransport')})}
async function play(song,options={}){
 stop();const token=epoch;controller=new AbortController();const signal=controller.signal;label=options.mask?'応援歌クイズ':song.name;let context;
 try{
  context=await window.ouenkaAudioRecovery.create();if(token!==epoch){context.close().catch(()=>{});return null}ctx=context;
  const normal=!!options.mask;const [melody,accompaniment]=await Promise.all([
   decode(context,song,normal?'melody.m4a':'audio.m4a',signal),
   normal?decode(context,song,'accompaniment.m4a',signal):decode(context,song,'intro_accompaniment.m4a',signal).catch(()=>decode(context,song,'accompaniment.m4a',signal))
  ]);
  if(token!==epoch)return null;
  const duration=Math.max(melody.duration,accompaniment.duration),excerpt=window.OuenkaQuizRules.excerpt(duration,options,window.OuenkaMedleyCore.barSeconds),clip=excerpt.duration,start=excerpt.start;
  // Clip each source against the same audio clock; no wall-clock timeout reveals an answer.
  timeline={duration:clip,entries:[melody,accompaniment].filter(b=>b.duration>start).map(buffer=>({buffer,start:-start}))};
  label=options.mask?'応援歌クイズ':song.name;replay=()=>play(song,options);endCallback=options.onEnded||null;schedule(0);if(!options.mask)mount();
  if(navigator.mediaSession){navigator.mediaSession.metadata=new MediaMetadata({title:label,artist:options.mask?'応援歌BASE':song.team||'応援歌BASE'});navigator.mediaSession.playbackState='playing'}
  return excerpt;
 }catch(error){if(token!==epoch||signal.aborted)return null;stop();throw error}
}
window.OuenkaPlayAudio={play,stop,state};window.addEventListener('pagehide',stop);
})();
