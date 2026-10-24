(()=>{'use strict';const MAX_ROWS=500;const text=value=>String(value??'').trim();
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
function fromSongs(songs,title){return {version:1,mode:'medley',title,rows:songs.map(s=>({name:s.name,productionNumber:s.productionNumber,team:s.team,lyrics:s.lyrics,position:'ポジション選択',songId:String(s.id||'')}))}}
function save(value){const data=validate(value),key=data.mode==='medley'?'ouenkaBaseSavedMedleysV1':'ouenkaBaseSavedLineupsV1';const rows=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(rows))throw Error('保存一覧を読み込めません。');const entry={...data,id:crypto.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),savedAt:new Date().toISOString()};rows.push(entry);localStorage.setItem(key,JSON.stringify(rows));return entry}
async function encode(value){const data=await window.OuenkaShortShare.create('playlist',validate(value));return data.code}
async function decode(raw){return validate(await window.OuenkaShortShare.read(raw,'playlist'))}
window.OuenkaPlaylistShare={encode,decode,validate,fromSongs,save};
})();
