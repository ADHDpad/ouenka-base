(()=>{'use strict';
const KEY='ouenkaSongbookV1';
const key=s=>String(s.player_name??s.name??'').normalize('NFKC').trim()+'#'+String(s.production_number??s.productionNumber??'');
function all(){try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}}
function get(s){return all()[key(s)]||{}}
function set(s,field,value){if(!['heard','sung','quizCorrect'].includes(field))throw Error('記録の種類が不正です');const id=key(s);if(!id.split('#')[0]||!id.split('#')[1])return;const data=all();data[id]={...data[id],[field]:!!value};localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('ouenka-songbook-change'))}
// Use the audio clock so pauses, seeking and background playback stay accurate.
function watch(read){
 const heardTime=new Map();let previous=null,timer=0,done=false;
 const stop=()=>{done=true;clearInterval(timer)};
 function tick(){
  if(done)return;
  let state;try{state=read()}catch{stop();return}if(!state){stop();return}
  const current={...state,position:Number(state.position),clock:Number(state.clock)};
  if(previous&&current.playing&&previous.playing&&Number.isFinite(current.clock)&&Number.isFinite(current.position)){
   const moved=current.position-previous.position,elapsed=current.clock-previous.clock;
   // A seek changes the position without the corresponding elapsed audio time.
   if(moved>0&&elapsed>0&&Math.abs(moved-elapsed)<.15){
    const records=all();
    for(const entry of current.entries||[]){
     const song=entry.song;if(!song||records[key(song)]?.heard)continue;
     const span=Math.max(0,Math.min(current.position,entry.end)-Math.max(previous.position,entry.start));
     if(!span)continue;const id=key(song),total=(heardTime.get(id)||0)+span;heardTime.set(id,total);
     if(total>=.25){try{set(song,'heard',true)}catch(e){console.warn('図鑑の記録を保存できませんでした',e)}}
    }
   }
  }
  previous=current;
 }
 tick();timer=setInterval(tick,200);return stop;
}
function track(ctx,s,isCurrent,start=ctx.currentTime){if(!s||get(s).heard)return;return watch(()=>ctx.state==='closed'?null:{playing:ctx.state==='running'&&isCurrent(),clock:ctx.currentTime,position:ctx.currentTime-start,entries:[{song:s,start:0,end:Infinity}]})}
function exportData(){return {version:1,records:Object.entries(all()).flatMap(([id,r])=>{const at=id.lastIndexOf('#'),name=id.slice(0,at),productionNumber=id.slice(at+1);return at>0&&/^\d{1,10}$/.test(productionNumber)&&r&&typeof r==='object'?[{name,productionNumber,heard:!!r.heard,sung:!!r.sung,quizCorrect:!!r.quizCorrect}]:[]}),favorites:(window.OuenkaFavorites?.list()||[]).map(s=>({name:s.name,productionNumber:s.productionNumber,team:s.team||'',reading:s.reading||''}))}}
function validateShared(data){if(data?.version!==1||!Array.isArray(data.records)||data.records.length>20000||!Array.isArray(data.favorites)||data.favorites.length>500)throw Error('図鑑の共有データを確認してください。');for(const s of [...data.records,...data.favorites])if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||!/^\d{1,10}$/.test(String(s.productionNumber)))throw Error('図鑑の曲情報を確認してください。');return data}
function mergeShared(input){const data=validateShared(input),records=all(),before=localStorage.getItem(KEY);for(const r of data.records){const id=key(r),old=records[id]||{};records[id]={...old,heard:!!old.heard||r.heard===true,sung:!!old.sung||r.sung===true,quizCorrect:!!old.quizCorrect||r.quizCorrect===true}}localStorage.setItem(KEY,JSON.stringify(records));try{window.OuenkaFavorites.mergeShared(data.favorites)}catch(e){if(before===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,before);throw e}window.dispatchEvent(new Event('ouenka-songbook-change'))}
window.OuenkaSongbook={key,get,set,all,track,watch,exportData,validateShared,mergeShared};
window.addEventListener('storage',e=>{if(e.key===KEY)window.dispatchEvent(new Event('ouenka-songbook-change'))});
})();
