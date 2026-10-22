(()=>{'use strict';
const KEY='ouenkaSongbookV1';
const key=s=>String(s.player_name??s.name??'').normalize('NFKC').trim()+'#'+String(s.production_number??s.productionNumber??'');
function all(){try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{return {}}}
function get(s){return all()[key(s)]||{}}
function set(s,field,value){if(!['heard','sung'].includes(field))throw Error('記録の種類が不正です');const id=key(s);if(!id.split('#')[0]||!id.split('#')[1])return;const data=all();data[id]={...data[id],[field]:!!value};localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('ouenka-songbook-change'))}
// Record only after the running audio clock has advanced; failed/suspended starts do not count.
function track(ctx,s,isCurrent,start=ctx.currentTime){if(!s||get(s).heard)return;const timer=setInterval(()=>{if(ctx.state==='closed'||!isCurrent()){clearInterval(timer);return}if(ctx.state==='running'&&ctx.currentTime-start>=.25){clearInterval(timer);try{set(s,'heard',true)}catch(e){console.warn('図鑑の記録を保存できませんでした',e)}}},300)}
window.OuenkaSongbook={key,get,set,all,track};
window.addEventListener('storage',e=>{if(e.key===KEY)window.dispatchEvent(new Event('ouenka-songbook-change'))});
})();
