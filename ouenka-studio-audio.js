/* Audio helpers copied from the existing approved 1-9 engine. */
(()=>{'use strict';
const OUENKA_PUBLIC_BASE="https://adhdpad.github.io/ouenka-base/";
const MEDLEY_BAR_SEC=(60/170)*4;
function toPublicAudioUrl(path){
 if(!path)return "";
 if(/^https?:\/\//i.test(path))return path;
 return new URL(path,OUENKA_PUBLIC_BASE).href;
}

function separatedAudioCandidates(item,fileName){
 const name=String(item.name||item.playerName||"").trim();
 const no=String(item.productionNumber||"").trim();
 const root=OUENKA_PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/";
 const n=encodeURIComponent(name),p=encodeURIComponent(no),f=encodeURIComponent(fileName);
 const list=[];
 const registered=fileName==="audio.m4a"?item.audioUrl:
                  fileName==="melody.m4a"?item.melodyUrl:
                  fileName==="accompaniment.m4a"?item.accompanimentUrl:
                  fileName==="intro_melody.m4a"?item.introMelodyUrl:
                  fileName==="intro_accompaniment.m4a"?item.introAccompanimentUrl:"";
 // 1曲目の個人再生用は必ず正規の audio.m4a を最優先する。
 // 登録メタデータに古い別名が残っていてもメドレー音源へ置き換えない。
 if(registered)list.push(registered);
 if(fileName==="audio.m4a"&&name&&no)list.push(root+n+"/"+p+"/audio.m4a");
 if(name&&no){
  list.push(root+n+"/"+p+"/"+f);              // データ/選手名/制作番号/
  list.push(root+n+"_"+p+"/"+f);             // データ/選手名_制作番号/
  list.push(root+n+"/"+f);                    // データ/選手名/
  list.push(root+n+"/"+p+"_"+f);             // データ/選手名/制作番号_melody.m4a
 }
 return [...new Set(list)];
}


/* ===== 1-9高速化：取得済みm4aをメモリキャッシュ =====
   AudioBufferはAudioContext依存を避けるため、元ArrayBufferを保存し、
   再生時はローカルメモリからdecodeする。 */
const oneNineAudioDataCache=new Map();
const oneNineAudioFetchPromises=new Map();
const oneNineDecodedCache=new WeakMap();
const oneNineResolvedPaths=new Map();
const oneNineMissingPaths=new Set();

async function fetchAudioDataCached(url){
 if(oneNineAudioDataCache.has(url))return oneNineAudioDataCache.get(url).slice(0);
 if(oneNineAudioFetchPromises.has(url)){
  const data=await oneNineAudioFetchPromises.get(url);
  return data.slice(0);
 }
 const promise=(async()=>{
  const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const data=await r.arrayBuffer();
  oneNineAudioDataCache.set(url,data);
  return data;
 })();
 oneNineAudioFetchPromises.set(url,promise);
 try{
  const data=await promise;
  return data.slice(0);
 }finally{
  oneNineAudioFetchPromises.delete(url);
 }
}
async function fetchDecodeAudioCached(ctx,url){
 let cache=oneNineDecodedCache.get(ctx);
 if(!cache){cache=new Map();oneNineDecodedCache.set(ctx,cache)}
 if(!cache.has(url))cache.set(url,(async()=>ctx.decodeAudioData(await fetchAudioDataCached(url)))());
 return cache.get(url);
}
async function fetchFirstExistingAudio(ctx,item,fileName,optional=false){
 let lastError=null;
 const key=String(item.name||item.playerName||'')+'/'+String(item.productionNumber||'')+'/'+fileName;
 const preferred=oneNineResolvedPaths.get(key);
 const candidates=[...new Set([preferred,...separatedAudioCandidates(item,fileName)].filter(Boolean))];
 for(const path of candidates){
  if(oneNineMissingPaths.has(path))continue;
  try{
   // 個人再生と同様、1曲目の再生用音源は常に最新ファイルを直接取得。
   // 先読み時の古い音源キャッシュ（force-cache）を使わない。
   if(fileName==="audio.m4a"){
    const url=toPublicAudioUrl(path);
    const response=await fetch(url,{cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(6500)});
    if(!response.ok){if(response.status===404)oneNineMissingPaths.add(path);throw new Error(`HTTP ${response.status}`)}
    const decoded=await ctx.decodeAudioData(await response.arrayBuffer());
    oneNineResolvedPaths.set(key,path);
    return decoded;
   }
   const decoded=await fetchDecodeAudioCached(ctx,path);
   oneNineResolvedPaths.set(key,path);
   return decoded;
  }catch(e){lastError=e;if(/HTTP 404/.test(String(e)))oneNineMissingPaths.add(path)}
 }
 if(optional)return null;
 throw lastError||new Error(`${fileName} が見つかりません。`);
}

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

function mixSmoothIndependent(ctx,songs,intro,starts){
 const sampleRate=songs[0].melody.sampleRate;
 const channels=Math.max(
  ...songs.flatMap(s=>[s.melody.numberOfChannels,s.accompaniment.numberOfChannels]),
  ...(intro?[intro.melody.numberOfChannels,intro.accompaniment.numberOfChannels]:[])
 );
 const startFrames=starts.map(v=>Math.round(v*sampleRate));
 const totalFrames=Math.max(
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
   out[global]+=src[f]*gain;
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


async function build(ctx,rows){
 const selected=rows.map((r,rowIndex)=>({name:r.reuseName||r.name,productionNumber:r.reuseProductionNumber||r.productionNumber,
 audioUrl:r.reuseName?'':r.audioUrl,melodyUrl:r.reuseName?'':r.melodyUrl,accompanimentUrl:r.reuseName?'':r.accompanimentUrl,introAccompanimentUrl:r.reuseName?'':r.introAccompanimentUrl,rowIndex})).filter(r=>r.name);
 if(!selected.length)throw new Error('1-9で選手を登録してください。');
 for(const item of selected){if(!item.productionNumber)throw new Error(item.name+' の応援歌が未選択です。1-9の検索候補から選び直してください。');}
  const separated=await Promise.all(selected.map(async(item,i)=>{
   try{
    const melodyFile=i===0?"audio.m4a":"melody.m4a";
    const [melody,normalAccompaniment,openingAccompaniment]=await Promise.all([
     (i===0?fetchFirstExistingAudio(ctx,item,melodyFile,true).then(v=>v||fetchFirstExistingAudio(ctx,item,"melody.m4a")):fetchFirstExistingAudio(ctx,item,melodyFile)),
     fetchFirstExistingAudio(ctx,item,"accompaniment.m4a"),
     i===0?fetchFirstExistingAudio(ctx,item,"intro_accompaniment.m4a",true):Promise.resolve(null)
    ]);
    return {melody,accompaniment:(i===0&&openingAccompaniment)||normalAccompaniment,
            hasOpeningAccompaniment:i===0&&!!openingAccompaniment};
   }catch(e){throw new Error(`${item.name} の音源を読み込めませんでした。`)}
  }));
  // 前奏は再生用音源に収録済み。別の前奏トラックを加えない。
  const intro=null;

  // 1曲目の前奏分だけ2曲目以降を後ろへ送る。
  // 本編の melody.m4a と再生用 audio.m4a の長さの差を小節単位で判定する。
  // 前奏付きコード進行がない場合は従来どおりの9小節接続を維持。
  let openingExtraSec=0;
  if(separated[0].hasOpeningAccompaniment){
   // 再生用音源・前奏付き伴奏の双方から前奏の長さを確認する。
   // 片方が本編と同じ長さで書き出されていても、もう片方の差を採用する。
   const [normalMelody,normalAccompaniment]=await Promise.all([
    fetchFirstExistingAudio(ctx,selected[0],"melody.m4a",true),
    fetchFirstExistingAudio(ctx,selected[0],"accompaniment.m4a",true)
   ]);
   const melodyExtra=normalMelody?Math.max(0,separated[0].melody.duration-normalMelody.duration):0;
   const chordExtra=normalAccompaniment?Math.max(0,separated[0].accompaniment.duration-normalAccompaniment.duration):0;
   openingExtraSec=Math.round(Math.max(melodyExtra,chordExtra)/MEDLEY_BAR_SEC)*MEDLEY_BAR_SEC;
  }
  const starts=buildDynamicSongStarts(separated,openingExtraSec);

  /* 今日最初の「サンプルを足さない」方式で1本のAudioBufferにする。
     メロディーとコード進行は別々に重複判定する。 */
  const mixed=mixSmoothIndependent(ctx,separated,intro,starts);

 return {buffer:mixed,starts,duration:mixed.duration,rowIndices:selected.map(p=>p.rowIndex),barSeconds:MEDLEY_BAR_SEC};
}
window.OuenkaStudioAudio={build};
})();
