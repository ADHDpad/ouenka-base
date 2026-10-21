(()=>{'use strict';const MAX_ROWS=500,MAX_BYTES=200000;const text=value=>String(value??'').trim();
function validate(value){
 if(value?.version!==1||!['lineup','medley'].includes(value.mode)||!Array.isArray(value.rows)||!value.rows.length||value.rows.length>MAX_ROWS)throw Error('共有コードの内容を確認できません。');
 const rows=value.rows.map(row=>{
  if(!row||typeof row!=='object')throw Error('曲の情報を確認できません。');
  if(!text(row.name))return {name:'',position:text(row.position).slice(0,30),productionNumber:''};
  const name=text(row.name),productionNumber=text(row.productionNumber),sourceName=text(row.reuseName),sourceNumber=text(row.reuseProductionNumber);
  if(!name||name.length>120||!/^\d{1,10}$/.test(sourceName?sourceNumber:productionNumber))throw Error('曲の登録情報が不足しています。選手を検索候補から選び直してください。');
  if(sourceName.length>120)throw Error('流用元の名前が長すぎます。');
  return {name,productionNumber,position:text(row.position).slice(0,30),team:text(row.team).slice(0,120),lyrics:text(row.lyrics).slice(0,10000),songId:text(row.songId).slice(0,80),reuseName:sourceName,reuseProductionNumber:sourceNumber,reuseMode:sourceName?(text(row.reuseMode)||'reuse'):''};
 });
 if(!rows.some(row=>row.name))throw Error('選手を入力してから共有してください。');
 return {version:1,mode:value.mode,title:text(value.title).slice(0,200)||'共有された'+(value.mode==='medley'?'メドレー':'1-9'),year:text(value.year).slice(0,10),team:text(value.team).slice(0,120),rows};
}
function b64(bytes){let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function encode(value){const data=validate(value),bytes=new TextEncoder().encode(JSON.stringify(data));if(bytes.length>MAX_BYTES)throw Error('共有データが大きすぎます。曲数を減らしてください。');if(typeof CompressionStream==='function'){const compressed=await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();return 'OBZ1.'+b64(new Uint8Array(compressed))}return 'OB1.'+b64(bytes)}
async function decode(raw){const code=text(raw).replace(/\s/g,'');if(code.length>300000||!/^OBZ?1\.[A-Za-z0-9_-]+$/.test(code))throw Error('応援歌BASEの共有コードを貼り付けてください。');const [prefix,body]=code.split('.');let bytes=Uint8Array.from(atob(body.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(prefix==='OBZ1'){
 if(typeof DecompressionStream!=='function')throw Error('このブラウザはこのコードに未対応です。新しいSafari・Chrome等で開いてください。');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw Error('共有データが大きすぎます。')}chunks.push(value)}bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
 }if(bytes.length>MAX_BYTES)throw Error('共有データが大きすぎます。');let value;try{value=JSON.parse(new TextDecoder().decode(bytes))}catch{throw Error('コードが途中で切れているか、形式が正しくありません。')}return validate(value)}
function fromSongs(songs,title){return {version:1,mode:'medley',title,rows:songs.map(s=>({name:s.name,productionNumber:s.productionNumber,team:s.team,lyrics:s.lyrics,position:'ポジション選択',songId:String(s.id||'')}))}}
function save(value){const data=validate(value),key=data.mode==='medley'?'ouenkaBaseSavedMedleysV1':'ouenkaBaseSavedLineupsV1';const rows=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(rows))throw Error('保存一覧を読み込めません。');const entry={...data,id:crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),savedAt:new Date().toISOString()};rows.push(entry);localStorage.setItem(key,JSON.stringify(rows));return entry}
window.OuenkaPlaylistShare={encode,decode,validate,fromSongs,save};
})();
