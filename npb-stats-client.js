(()=>{'use strict';
const B=['year','team','avg','hr','rbi','sb','slg','obp','pa','ab','hits','tb','walks','hbp','sf'],P=['year','team','wins','losses','era','innings','hits','walks','strikeouts','earnedRuns'];
const normal=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s　・･.．]/g,'').toLowerCase();
const number=s=>/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(s).trim())?Number(s):null;
const rate=n=>n.toFixed(3).replace(/^0\./,'.');
function outs(value){const m=String(value||'').replace(/\s/g,'').match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null}
function seasons(rows,type){
 const groups=new Map(),keys=type==='pitching'?P:B;
 for(const values of rows){const r=Object.fromEntries(keys.map((key,i)=>[key,values[i]]));if(!/^\d{4}$/.test(r.year))continue;if(!groups.has(r.year))groups.set(r.year,[]);groups.get(r.year).push(r)}
 return [...groups].map(([year,parts])=>{
  if(parts.length===1)return {...parts[0],year:Number(year)};
  const officialTotal=parts.find(p=>/^(合計|通算|全体|\d+球団)$/.test(p.team));if(officialTotal)return {...officialTotal,year:Number(year)};
  const r={year:Number(year),team:[...new Set(parts.map(p=>p.team))].join('・')};
  const sum=key=>{const values=parts.map(p=>number(p[key]));return values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0)};
  if(type==='batting'){
   for(const key of ['hr','rbi','sb','pa','ab','hits','tb','walks','hbp','sf'])r[key]=sum(key);
   r.avg=r.ab>0&&r.hits!==null?rate(r.hits/r.ab):'-';r.slg=r.ab>0&&r.tb!==null?rate(r.tb/r.ab):'-';
   const denominator=r.ab+r.walks+r.hbp+r.sf;r.obp=[r.ab,r.hits,r.walks,r.hbp,r.sf].every(v=>v!==null)&&denominator>0?rate((r.hits+r.walks+r.hbp)/denominator):'-';
  }else{
   for(const key of ['wins','losses','hits','walks','strikeouts','earnedRuns'])r[key]=sum(key);
   const innings=parts.map(p=>outs(p.innings)),total=innings.some(v=>v===null)?null:innings.reduce((a,b)=>a+b,0);r.innings=total===null?'':Math.floor(total/3)+(total%3?'.'+total%3:'');r.era=total>0&&r.earnedRuns!==null?(r.earnedRuns*27/total).toFixed(2):'-';
  }
  return r;
 });
}
function stats(row,type){
 if(type==='pitching'){const total=outs(row.innings);return {wins:row.wins,losses:row.losses,era:row.era||'-',whip:total>0&&number(row.hits)!==null&&number(row.walks)!==null?((Number(row.hits)+Number(row.walks))*3/total).toFixed(2):'-',strikeouts:row.strikeouts,innings:row.innings}}
 const slg=number(row.slg),obp=number(row.obp);return {avg:row.avg,hr:row.hr,rbi:row.rbi,sb:row.sb,ops:slg!==null&&obp!==null?rate(slg+obp):'-'};
}
function select(rows,year,type){const annual=seasons(rows,type);if(year!=='career')return annual.find(r=>r.year===Number(year))||null;
 const eligible=annual.filter(r=>type==='pitching'?outs(r.innings)>=150:Number(r.pa)>=300);const candidates=eligible.length?eligible:annual;
 return candidates.slice().sort((a,b)=>{if(!eligible.length)return (type==='pitching'?(outs(b.innings)||0)-(outs(a.innings)||0):Number(b.pa||0)-Number(a.pa||0))||b.year-a.year;if(type==='pitching')return (number(a.era)??Infinity)-(number(b.era)??Infinity)||(outs(b.innings)||0)-(outs(a.innings)||0)||b.year-a.year;return (number(stats(b,type).ops)??-1)-(number(stats(a,type).ops)??-1)||Number(b.pa||0)-Number(a.pa||0)||b.year-a.year})[0]||null;
}
const pending=new Map();
function chunk(index){if(window.OuenkaNpbStatsChunks?.[index])return Promise.resolve(window.OuenkaNpbStatsChunks[index]);if(!pending.has(index))pending.set(index,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='npb-stats/'+index+'.js?v=20261024-r242';const timer=setTimeout(()=>{script.remove();reject(Error('NPB成績データの読み込みがタイムアウトしました。'))},20000);script.onload=()=>{clearTimeout(timer);script.remove();window.OuenkaNpbStatsChunks?.[index]?resolve(window.OuenkaNpbStatsChunks[index]):reject(Error('NPB成績データを確認できませんでした。'))};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('NPB成績データを読み込めませんでした。'))};document.head.append(script)}).catch(e=>{pending.delete(index);throw e}));return pending.get(index)}
async function get(name,year,type='batting',auto=false){
 const all=await window.OuenkaNpbDirectory.load(),q=normal(name);let matches=all.filter(p=>[p.name,...(p.aliases||[]),String(p.reading||'').split(/[（(]/)[0]].some(v=>normal(v)===q));
 const resolved=await Promise.all(matches.map(async p=>{const id=p.sourceUrl.match(/\/(\d+)\.html$/)[1],tables=(await chunk(Number(id)%32))[id];if(!tables)return null;let kind=type;if(auto&&type==='batting'&&tables.p.length&&!tables.b.some(r=>Number(r[8])>0))kind='pitching';const row=select(tables[kind==='pitching'?'p':'b'],year,kind);return row?{player:p,row,type:kind}:null}));
 const found=resolved.filter(Boolean);if(found.length!==1)return {requestedName:name,status:found.length?'ambiguous':'not_found',error:found.length?'同名の選手が複数いるため成績を特定できませんでした。':'指定年のNPB一軍成績が見つかりませんでした。'};
 const hit=found[0];return {requestedName:name,status:'matched',statsType:hit.type,selectedYear:hit.row.year,team:hit.row.team,sourceUrl:hit.player.sourceUrl,stats:stats(hit.row,hit.type)};
}
window.OuenkaNpbStats={get,seasons,select,stats,outs};
})();
