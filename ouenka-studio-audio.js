/* Audio helpers copied from the existing approved 1-9 engine. */
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


/* ===== 1-9高速化：取得済みm4aをメモリキャッシュ =====
   AudioBufferはAudioContext依存を避けるため、元ArrayBufferを保存し、
   再生時はローカルメモリからdecodeする。 */
const oneNineAudioDataCache=new Map();
const oneNineAudioFetchPromises=new Map();
const oneNineDecodedCache=new WeakMap();
const oneNineResolvedPaths=new Map();
const oneNineMissingPaths=new Set();

async function fetchAudioDataCached(url){
 url=toPublicAudioUrl(url);
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
 url=toPublicAudioUrl(url);
 let cache=oneNineDecodedCache.get(ctx);
 if(!cache){cache=new Map();oneNineDecodedCache.set(ctx,cache)}
 if(!cache.has(url))cache.set(url,(async()=>ctx.decodeAudioData(await fetchAudioDataCached(url)))());
 try{return await cache.get(url)}catch(error){cache.delete(url);oneNineAudioDataCache.delete(url);throw error}
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

const DATA_API='https://ouenka-base-data.ninzin5600.workers.dev';
function normalizeSongName(value){return String(value||'').normalize('NFKC').replace(/[\s　・･]/g,'').toLowerCase()}
function songNumber(song){return String(song.production_number??song.productionNumber??'').trim()}
function songName(song){return String(song.player_name||song.playerName||song.name||'').trim()}
function songUrls(song,item){const name=songName(song)||item.name,productionNumber=songNumber(song)||String(item.productionNumber||'');if(!name||!productionNumber)return item;const root=OUENKA_PUBLIC_BASE+'%E3%83%87%E3%83%BC%E3%82%BF/'+encodeURIComponent(name)+'/'+encodeURIComponent(productionNumber)+'/';const file=(url,filename,fallback,existing)=>url?toPublicAudioUrl(url):filename?root+encodeURIComponent(filename):existing?toPublicAudioUrl(existing):root+encodeURIComponent(fallback);return {...item,name,productionNumber,songId:song.id||item.songId,tempo:window.OuenkaMedleyCore.tempo(song),audioUrl:file(song.audio_url,song.audio_filename||song.audioFilename,'audio.m4a',item.audioUrl),medleyUrl:file(song.medley_url,song.medley_filename||song.medleyFilename,'medley.m4a',item.medleyUrl),melodyUrl:file(song.melody_url,song.melody_filename,'melody.m4a',item.melodyUrl),accompanimentUrl:file(song.accompaniment_url,song.accompaniment_filename,'accompaniment.m4a',item.accompanimentUrl),introMelodyUrl:file(song.intro_melody_url,song.intro_melody_filename,'intro_melody.m4a',item.introMelodyUrl),introAccompanimentUrl:file(song.intro_accompaniment_url,song.intro_accompaniment_filename,'intro_accompaniment.m4a',item.introAccompanimentUrl)}}
async function resolveStudioRows(rows){
 let allSongsPromise=null;const searches=new Map();
 const load=async url=>{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(9000)});if(!response.ok)throw Error('登録情報 HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.songs))throw Error('登録情報の形式を確認できませんでした。');return data.songs};
 const exactMatch=(songs,item)=>{if(item.songId&&!item.reused){const byId=songs.filter(song=>String(song.id)===String(item.songId));if(byId.length===1&&(!item.productionNumber||songNumber(byId[0])===String(item.productionNumber)))return byId[0]}const matches=songs.filter(song=>normalizeSongName(songName(song))===normalizeSongName(item.name)&&(!item.productionNumber||songNumber(song)===String(item.productionNumber)));return matches.length===1?matches[0]:null};
 return Promise.all(rows.map(async(r,rowIndex)=>{const source=r.audioSource&&typeof r.audioSource==='object'?r.audioSource:r;const reused=!!source.reuseName,item={name:source.reuseName||source.name,productionNumber:source.reuseProductionNumber||source.productionNumber,songId:reused?'':source.songId,audioUrl:reused?'':source.audioUrl,medleyUrl:reused?'':source.medleyUrl,melodyUrl:reused?'':source.melodyUrl,accompanimentUrl:reused?'':source.accompanimentUrl,introMelodyUrl:reused?'':source.introMelodyUrl,introAccompanimentUrl:reused?'':source.introAccompanimentUrl,rowIndex,reused,tempo:source.reuseTempo||source.tempo};if(!item.name)return null;
  try{const key=String(item.name);if(!searches.has(key))searches.set(key,load(DATA_API+'/songs/search?q='+encodeURIComponent(key)));const candidates=await searches.get(key);let match=exactMatch(candidates,item);if(!match){if(!allSongsPromise)allSongsPromise=load(DATA_API+'/songs');match=exactMatch(await allSongsPromise,item)}if(match)return songUrls(match,item)}catch(e){/* 登録API一時障害時は、1-9から渡された保存先を使って続行。 */}
  return item;
 })).then(items=>items.filter(Boolean));
}

async function build(ctx,rows){
 oneNineMissingPaths.clear();
 const selected=await resolveStudioRows(rows);
 return window.OuenkaMedleyCore.build(ctx,selected,{
  load:(item,file,optional)=>fetchFirstExistingAudio(ctx,item,file,optional),
  rowIndices:selected.map(item=>item.rowIndex),callsRows:rows.filter(row=>row.name)
 });
}
window.OuenkaStudioAudio={build};
})();
