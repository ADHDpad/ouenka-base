/* 背景透過の作成・通常表示切替。元の写真は変更しない。 */
(()=>{'use strict';
 const DB='ouenka_photo_cutouts_v1',cache=new Map(),loads=new Map(),keys=new Map();let database,engine;
 function key(source){if(keys.has(source))return keys.get(source);let a=2166136261,b=5381;for(let i=0;i<source.length;i++){const n=source.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n}const id=(a>>>0).toString(16)+'-'+(b>>>0).toString(16)+'-'+source.length;keys.set(source,id);return id}
 function db(){if(!database)database=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore('images');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}).catch(error=>{database=null;throw error});return database}
 async function read(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('images','readonly'),r=tx.objectStore('images').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function write(id,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('images','readwrite');tx.objectStore('images').put(value,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('透過画像を保存できませんでした。'))})}
 function remember(id,record){const old=cache.get(id);if(old?.url)URL.revokeObjectURL(old.url);const entry={...record,url:URL.createObjectURL(record.blob)};cache.set(id,entry);return entry}
 function isTransparent(p){return p?.photoMode==='transparent'&&!!p.photo&&p.photoCutoutKey===key(p.photo)}
 async function load(p){if(!isTransparent(p))return null;const id=p.photoCutoutKey,original=p.photo;if(cache.get(id)?.original===original)return cache.get(id);if(!loads.has(id)){loads.set(id,read(id).then(record=>{if(!record||record.original!==original)return null;const entry=remember(id,record);window.dispatchEvent(new Event('ouenka-cutout-ready'));return entry}).finally(()=>loads.delete(id)))}return loads.get(id)}
 function source(p){if(!isTransparent(p))return p?.photo||'';const entry=cache.get(p.photoCutoutKey);if(entry?.original===p.photo)return entry.url;load(p).catch(()=>{});return p.photo}
 async function prepare(original,status=()=>{}){
  if(!original)throw Error('先に写真を選択してください。');const id=key(original),existing=cache.get(id)||await read(id);if(existing?.original===original){if(!cache.has(id))remember(id,existing);return id}
  status('背景透過を準備中…初回は時間がかかります。');
  if(!engine)engine=import('https://esm.sh/@imgly/background-removal@1.7.0?bundle').catch(error=>{engine=null;throw error});
  const module=await engine;const remove=module.removeBackground||module.default;if(typeof remove!=='function')throw Error('背景透過の準備に失敗しました。');
  const input=await fetch(original).then(r=>{if(!r.ok)throw Error('写真を読み込めませんでした。');return r.blob()});
  const blob=await remove(input,{model:'isnet_quint8',device:'cpu',proxyToWorker:false,output:{format:'image/png',type:'foreground'},progress:(name,current,total)=>status(total?'背景透過を準備中… '+Math.min(100,Math.round(current/total*100))+'%':'選手の背景を透過しています…')});
  if(!(blob instanceof Blob)||!blob.size)throw Error('透過画像を作成できませんでした。');
  const record={original,blob};await write(id,record);remember(id,record);status('背景透過を作成しました。');return id;
 }
 window.OuenkaPhotoCutout={source,load,prepare,isTransparent};
})();
