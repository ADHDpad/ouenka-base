/* Fetch and decode audio on demand for the medley illustration studio. */
(()=>{'use strict';
const OUENKA_PUBLIC_BASE="https://adhdpad.github.io/ouenka-base/";
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


// Deduplicate pending transfers and decoding without retaining a second copy of every song.
const oneNineAudioFetchPromises=new Map();
const oneNineDecodedCache=new WeakMap();
const oneNineResolvedPaths=new Map();
const oneNineMissingPaths=new Set();

async function fetchAudioDataCached(url){
 url=toPublicAudioUrl(url);
 if(oneNineAudioFetchPromises.has(url)){
  const data=await oneNineAudioFetchPromises.get(url);
  return data.slice(0);
 }
 const promise=(async()=>{
  const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const data=await r.arrayBuffer();
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
 url=toPublicAudioUrl(url);
 let cache=oneNineDecodedCache.get(ctx);
 if(!cache){cache=new Map();oneNineDecodedCache.set(ctx,cache)}
 if(!cache.has(url))cache.set(url,(async()=>ctx.decodeAudioData(await fetchAudioDataCached(url)))());
 try{return await cache.get(url)}catch(error){cache.delete(url);throw error}
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
    const response=await fetch(url,{cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(25000)});
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

async function build(ctx,rows,{onProgress,cancelled,onSongs}={}){
 oneNineMissingPaths.clear();
 const registered=await window.OuenkaMedleyCore.resolveSongs(rows);
 cancelled?.();
 onSongs?.(registered);
 const selected=registered.map(song=>({...window.OuenkaMedleyCore.registeredAudioUrls(song,song.name,song.productionNumber),name:song.name,tempo:song.tempo}));
 try{
  const {buffer,starts,rowIndices,barSeconds,barSecondsBySong,tempos,duration}=await window.OuenkaMedleyCore.build(ctx,selected,{
   load:(item,file,optional)=>fetchFirstExistingAudio(ctx,item,file,optional),
   rowIndices:selected.map((_,index)=>index),callsRows:rows,onProgress,cancelled,concurrency:4
  });
  return {buffer,starts,rowIndices,barSeconds,barSecondsBySong,tempos,duration};
 }finally{oneNineDecodedCache.delete(ctx)}
}
window.OuenkaStudioAudio={build};
})();
