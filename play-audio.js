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
function state(){const time=ctx?Math.min(timeline?.duration||0,Math.max(0,ctx.currentTime-started)):position;if(onTick)onTick(time);return {title:label,duration:timeline?.duration||0,currentTime:time,playing:!!ctx&&!paused&&ctx.state==='running',paused,hasPrevious:!!timeline?.starts&&time>timeline.starts[0]+.1,hasNext:!!timeline?.starts&&time<timeline.starts[timeline.starts.length-1]}}
function stop(){epoch++;controller?.abort();controller=null;for(const s of sources){s.onended=null;try{s.stop()}catch{}}sources=[];if(ctx)ctx.close().catch(()=>{});ctx=null;paused=false;position=0;onTick=null;endCallback=null;if(navigator.mediaSession)navigator.mediaSession.playbackState='none';window.OuenkaTransport?.hide()}
function schedule(offset=0){
 const context=ctx,token=epoch;for(const s of sources){s.onended=null;try{s.stop()}catch{}}sources=[];const base=context.currentTime+.04;started=base-offset;position=offset;
 let pending=0;for(const item of timeline.entries){if(offset>=item.start+item.buffer.duration)continue;const source=context.createBufferSource();source.buffer=item.buffer;source.connect(context.destination);source.start(base+Math.max(0,item.start-offset),Math.max(0,offset-item.start),Math.max(0,Math.min(item.buffer.duration-Math.max(0,offset-item.start),timeline.duration-Math.max(offset,item.start))));sources.push(source);pending++;source.onended=()=>{if(token!==epoch||context!==ctx||!sources.includes(source)||--pending>0)return;position=timeline.duration;context.close().catch(()=>{});ctx=null;paused=false;onTick?.(position);const callback=endCallback;endCallback=null;callback?.();if(navigator.mediaSession)navigator.mediaSession.playbackState='none'}}
}
function mount(options={}){window.OuenkaTransport?.mount({state,pause:async()=>{if(ctx){paused=true;await ctx.suspend()}},play:async()=>{if(ctx){paused=false;await ctx.resume()}else await replay?.()},stop:options.onStop||stop,previous:timeline?.starts?.length>1?()=>jump(-1):undefined,next:timeline?.starts?.length>1?()=>jump(1):undefined,seek:value=>{if(!ctx)return;const at=Math.max(0,Math.min(timeline.duration-.001,Number(value)||0));schedule(at)}},{host:document.getElementById('playTransport')})}
async function play(song,options={}){
 stop();const token=epoch;timeline=null;controller=new AbortController();const signal=controller.signal;label=options.mask?'応援歌クイズ':song.name;let context;if(!options.mask)window.OuenkaTransport?.mount({state:()=>({busy:true,title:'音源を検索中…'}),stop:options.onStop||stop},{host:document.getElementById('playTransport')});
 try{
  context=await window.ouenkaAudioRecovery.create();if(token!==epoch){context.close().catch(()=>{});return null}ctx=context;
  song=window.OuenkaQuizMetadata?.merge(song)||song;const normal=!!options.mask;const [melody,accompaniment]=await Promise.all([
   decode(context,song,normal?'melody.m4a':'audio.m4a',signal),
   normal?decode(context,song,'accompaniment.m4a',signal):decode(context,song,'intro_accompaniment.m4a',signal).catch(()=>decode(context,song,'accompaniment.m4a',signal))
  ]);
  if(token!==epoch)return null;
  const bodyOffset=normal?Math.max(0,(Number(song.mainStartBar||song.main_start_bar||1)-1)*window.OuenkaMedleyCore.barSeconds):0;const duration=Math.max(melody.duration,accompaniment.duration)-bodyOffset,excerpt=window.OuenkaQuizRules.excerpt(duration,options,window.OuenkaMedleyCore.barSeconds),clip=excerpt.duration,start=excerpt.start+bodyOffset;excerpt.bodyOffset=bodyOffset;
  // Clip each source against the same audio clock; no wall-clock timeout reveals an answer.
  timeline={duration:clip,entries:[melody,accompaniment].filter(b=>b.duration>start).map(buffer=>({buffer,start:-start}))};
  label=options.mask?'応援歌クイズ':song.name;replay=()=>play(song,options);endCallback=options.onEnded||null;schedule(0);trackPlayback([song],[0],context,token);if(!options.mask)mount(options);
  if(navigator.mediaSession){navigator.mediaSession.metadata=new MediaMetadata({title:label,artist:options.mask?'応援歌BASE':song.team||'応援歌BASE'});navigator.mediaSession.playbackState='playing'}
  return excerpt;
 }catch(error){if(token!==epoch||signal.aborted)return null;stop();throw error}
}

function jump(direction){if(!ctx||!timeline?.starts)return;const at=state().currentTime;let i=0;while(i+1<timeline.starts.length&&at>=timeline.starts[i+1])i++;schedule(timeline.starts[Math.max(0,Math.min(timeline.starts.length-1,i+direction))])}
function trackPlayback(songs,starts,context,token){window.OuenkaSongbook?.watch(()=>token!==epoch||ctx!==context||context.state==='closed'?null:{playing:!paused&&context.state==='running',clock:context.currentTime,position:context.currentTime-started,entries:starts.map((start,i)=>({song:songs[i],start,end:starts[i+1]??timeline.duration}))})}
async function playMedley(input,options={}){
 stop();const songs=input.map(s=>({...s}));if(!songs.length)return null;
 const token=epoch;timeline=null;controller=new AbortController();const signal=controller.signal;label=options.title||'応援歌メドレー';
 window.OuenkaTransport?.mount({state:()=>({busy:true,title:'音源を検索中…'}),stop:options.onStop||stop});
 try{
  const context=await window.ouenkaAudioRecovery.create();if(token!==epoch){context.close().catch(()=>{});return null}ctx=context;
  const separated=new Array(songs.length);let cursor=0;
  const cancelled=()=>{if(signal.aborted||token!==epoch)throw new DOMException('中止','AbortError')};
  async function load(){while(cursor<songs.length){const i=cursor++,song=songs[i];cancelled();const [melody,normalAccompaniment,opening]=await Promise.all([
   i===0?decode(context,song,'audio.m4a',signal).catch(()=>decode(context,song,'melody.m4a',signal)):decode(context,song,'melody.m4a',signal),
   decode(context,song,'accompaniment.m4a',signal),i===0?decode(context,song,'intro_accompaniment.m4a',signal).catch(()=>null):Promise.resolve(null)
  ]);cancelled();separated[i]={melody,accompaniment:opening||normalAccompaniment,normalAccompaniment,opening}}}
  await Promise.all(Array.from({length:Math.min(3,songs.length)},load));cancelled();
  const core=window.OuenkaMedleyCore;let openingExtra=0;
  if(separated[0].opening){const body=await decode(context,songs[0],'melody.m4a',signal).catch(()=>null);cancelled();openingExtra=Math.round(Math.max(body?separated[0].melody.duration-body.duration:0,separated[0].accompaniment.duration-separated[0].normalAccompaniment.duration,0)/core.barSeconds)*core.barSeconds}
  const originalStarts=core.buildDynamicSongStarts(separated,openingExtra);
  const plan=window.OuenkaCalls?await window.OuenkaCalls.plan(context,separated,originalStarts,songs):{starts:originalStarts,events:[]};cancelled();
  let buffer=core.mix(context,separated,null,plan.starts);if(window.OuenkaCalls)buffer=window.OuenkaCalls.decorate(context,buffer,plan);cancelled();
  timeline={duration:buffer.duration,entries:[{buffer,start:0}],starts:plan.starts,songs};
  replay=()=>playMedley(songs,options);endCallback=options.onEnded||null;let last=-1;
  onTick=time=>{let i=0;while(i+1<plan.starts.length&&time>=plan.starts[i+1])i++;if(i!==last){last=i;label=(options.title?options.title+' ／ ':'')+songs[i].name;options.onSong?.(songs[i],i)}};
  schedule(0);trackPlayback(songs,plan.starts,context,token);mount(options);
  if(navigator.mediaSession){navigator.mediaSession.metadata=new MediaMetadata({title:label,artist:'応援歌BASE'});navigator.mediaSession.playbackState='playing'}
  return {starts:plan.starts,duration:buffer.duration};
 }catch(error){if(token!==epoch||signal.aborted)return null;stop();throw error}
}

function melodyNotes(buffer){const data=buffer.getChannelData(0),step=.14,rate=8000,notes=[];for(let t=0;t<buffer.duration;t+=step){let energy=0;const samples=new Float32Array(560);for(let i=0;i<samples.length;i++){samples[i]=data[Math.min(data.length-1,Math.floor((t+i/rate)*buffer.sampleRate))]||0;energy+=samples[i]*samples[i]}if(energy/samples.length<.000025){notes.push(null);continue}let best=0,note=null;for(let midi=43;midi<=90;midi++){const omega=2*Math.PI*440*Math.pow(2,(midi-69)/12)/rate,coeff=2*Math.cos(omega);let a=0,b=0;for(const sample of samples){const c=sample+coeff*a-b;b=a;a=c}const score=a*a+b*b-coeff*a*b;if(score>best){best=score;note=midi}}notes.push(note)}return notes}
async function sameMelodyPart(a,b,excerpt){let analysis;try{a=window.OuenkaQuizMetadata?.merge(a)||a;b=window.OuenkaQuizMetadata?.merge(b)||b;analysis=new (window.AudioContext||window.webkitAudioContext)();const control=new AbortController(),timeout=setTimeout(()=>control.abort(),20000);let buffers;try{buffers=await Promise.all([decode(analysis,a,'melody.m4a',control.signal),decode(analysis,b,'melody.m4a',control.signal)])}finally{clearTimeout(timeout)}const left=melodyNotes(buffers[0]),right=melodyNotes(buffers[1]),start=Math.round((excerpt.start+(excerpt.bodyOffset||0))/.14),length=Math.floor(excerpt.duration/.14),part=left.slice(start,start+length);if(part.length<8||part.filter(n=>n!==null).length<6)return null;const from=Math.max(0,Math.round(((Number(b.mainStartBar||b.main_start_bar||1)-1)*window.OuenkaMedleyCore.barSeconds)/.14));for(let at=from;at+part.length<=right.length;at++){const offsets=new Map();let valid=0,voiced=0;for(let i=0;i<part.length;i++){const x=part[i],y=right[at+i];if(x===null&&y===null){valid++;continue}if(x!==null&&y!==null){voiced++;const delta=y-x;offsets.set(delta,(offsets.get(delta)||0)+1)}}const best=Math.max(0,...offsets.values());if(voiced>=6&&best>=voiced*.96&&(best+valid)/part.length>=.94)return true}return false}catch{return null}finally{analysis?.close().catch(()=>{})}}
window.OuenkaPlayAudio={play,playMedley,stop,state,sameMelodyPart};window.addEventListener('pagehide',stop);
})();
