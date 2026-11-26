(()=>{'use strict';
const B=['year','team','avg','hr','rbi','sb','slg','obp','pa','ab','hits','tb','walks','hbp','sf'],P=['year','team','wins','losses','era','innings','hits','walks','strikeouts','earnedRuns'];
const normal=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s　・･.．]/g,'').toLowerCase();
const number=s=>/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(s).trim())?Number(s):null;
const rate=n=>n.toFixed(3).replace(/^0\./,'.');
function outs(value){const m=String(value||'').replace(/\s/g,'').match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null}
const clubAliases=[
 ['日本ハム','日ハム','北海道日本ハム','北海道日本ハムファイターズ','日本ハムファイターズ','ファイターズ'],
 ['ソフトバンク','福岡ソフトバンク','福岡ソフトバンクホークス'],
 ['楽天','東北楽天','東北楽天ゴールデンイーグルス','楽天イーグルス','ゴールデンイーグルス'],
 ['西武','埼玉西武','埼玉西武ライオンズ','西武ライオンズ','ライオンズ'],
 ['ロッテ','千葉ロッテ','千葉ロッテマリーンズ','マリーンズ'],
 ['巨人','読売','読売ジャイアンツ','ジャイアンツ'],
 ['阪神','阪神タイガース','タイガース'],
 ['DeNA','横浜DeNA','横浜DeNAベイスターズ'],
 ['横浜','横浜ベイスターズ'],
 ['広島','広島東洋','広島東洋カープ','カープ'],
 ['中日','中日ドラゴンズ','ドラゴンズ'],
 ['ヤクルト','東京ヤクルト','東京ヤクルトスワローズ','ヤクルトスワローズ','スワローズ'],
 ['近鉄','大阪近鉄','大阪近鉄バファローズ','近鉄バファローズ'],
 ['オリックスブルーウェーブ','ブルーウェーブ'],
 ['オリックスバファローズ']
];
const clubKeys=new Map(clubAliases.flatMap(group=>group.map(name=>[normal(name),normal(group[0])])));
function clubKey(team,year){
 const key=normal(team);
 if(key===normal('オリックス')&&year){
  if(Number(year)>=2005)return normal('オリックスバファローズ');
  if(Number(year)>=1991)return normal('オリックスブルーウェーブ');
 }
 return clubKeys.get(key)||key;
}
function inClub(rows,team){
 const key=clubKey(team);
 return rows.filter(row=>key===clubKey(row[1],row[0])||
  (key===normal('オリックス')&&[normal('オリックス'),normal('オリックスバファローズ')].includes(clubKey(row[1],row[0]))));
}
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
function select(rows,year,type,team=''){const annual=seasons(year==='career'?inClub(rows,team):rows,type);if(year!=='career')return annual.find(r=>r.year===Number(year))||null;
 const eligible=annual.filter(r=>type==='pitching'?outs(r.innings)>=150:Number(r.pa)>=300);const candidates=eligible.length?eligible:annual;
 return candidates.slice().sort((a,b)=>{if(!eligible.length)return (type==='pitching'?(outs(b.innings)||0)-(outs(a.innings)||0):Number(b.pa||0)-Number(a.pa||0))||b.year-a.year;if(type==='pitching')return (number(a.era)??Infinity)-(number(b.era)??Infinity)||(outs(b.innings)||0)-(outs(a.innings)||0)||b.year-a.year;return (number(stats(b,type).ops)??-1)-(number(stats(a,type).ops)??-1)||Number(b.pa||0)-Number(a.pa||0)||b.year-a.year})[0]||null;
}
const pending=new Map();
function chunk(index){if(window.OuenkaNpbStatsChunks?.[index])return Promise.resolve(window.OuenkaNpbStatsChunks[index]);if(!pending.has(index))pending.set(index,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='npb-stats/'+index+'.js?v=20261103-r331';const timer=setTimeout(()=>{script.remove();reject(Error('NPB成績データの読み込みがタイムアウトしました。'))},20000);script.onload=()=>{clearTimeout(timer);script.remove();window.OuenkaNpbStatsChunks?.[index]?resolve(window.OuenkaNpbStatsChunks[index]):reject(Error('NPB成績データを確認できませんでした。'))};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('NPB成績データを読み込めませんでした。'))};document.head.append(script)}).catch(e=>{pending.delete(index);throw e}));return pending.get(index)}
const profiles=new Map();
const playerApi='https://ouenka-base-npb-stats.ninzin5600.workers.dev/stats/player/';
function profileTables(html){
 const document=new DOMParser().parseFromString(html,'text/html');
 const tables={b:[],p:[]};
 for(const table of document.querySelectorAll('table')){
  const rows=Array.from(table.rows,row=>Array.from(row.cells,cell=>cell.textContent.replace(/\s/g,'').trim()));
  const headerIndex=rows.findIndex(row=>row.includes('年度')&&row.includes('所属球団'));
  if(headerIndex<0)continue;
  const header=rows[headerIndex];
  const labels=header.includes('打席')?
   ['年度','所属球団','打率','本塁打','打点','盗塁','長打率','出塁率','打席','打数','安打','塁打','四球','死球','犠飛']:
   header.includes('投球回')?['年度','所属球団','勝利','敗北','防御率','投球回','安打','四球','三振','自責点']:null;
  if(!labels)continue;
  const columns=labels.map(label=>header.indexOf(label));
  let year='';
  const data=rows.slice(headerIndex+1).map(row=>{
   if(row.length===header.length-1&&year)row=['',...row];
   const entry=columns.map(index=>row[index]||'');
   if(/^\d{4}$/.test(entry[0]))year=entry[0];
   else if(!entry[0]&&entry[1]&&!/^(通算|合計)$/.test(entry[1]))entry[0]=year;
   return entry;
  });
  tables[header.includes('打席')?'b':'p'].push(...data.filter(row=>/^\d{4}$/.test(row[0])));
 }
 return tables;
}
async function playerTables(id){
 try{
  const bundled=(await chunk(Number(id)%32))[id];
  if(bundled)return bundled;
 }catch{}
 if(!profiles.has(id))profiles.set(id,(async()=>{
  const response=await fetch(playerApi+id,{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('NPB成績データを読み込めませんでした。');
  return profileTables(await response.text());
 })().catch(error=>{profiles.delete(id);throw error}));
 return profiles.get(id);
}
async function get(name,year,type='batting',auto=false,team=''){
 const scoped=year==='career',teamLabel=String(team||'').trim();
 if(scoped&&!teamLabel)return {requestedName:name,status:'not_found',error:'キャリアハイを検索する球団が未設定です。'};
 const all=await window.OuenkaNpbDirectory.load(),q=normal(name);
 const matches=all.filter(p=>[p.name,...(p.aliases||[]),String(p.reading||'').split(/[（(]/)[0]].some(v=>normal(v)===q));
 const resolved=await Promise.all(matches.map(async p=>{
  const id=p.sourceUrl.match(/\/(\d+)\.html$/)?.[1];
  if(!id)return null;
  const tables=await playerTables(id);
  const batting=scoped?inClub(tables.b,teamLabel):tables.b;
  const pitching=scoped?inClub(tables.p,teamLabel):tables.p;
  const kind=auto&&type==='batting'&&pitching.length&&!batting.some(row=>Number(row[8])>0)?'pitching':type;
  const row=select(tables[kind==='pitching'?'p':'b'],year,kind,teamLabel);
  return row?{player:p,row,type:kind}:null;
 }));
 const found=resolved.filter(Boolean);
 if(found.length!==1)return {requestedName:name,status:found.length?'ambiguous':'not_found',
  error:found.length?'同名の選手が複数いるため成績を特定できませんでした。':scoped?teamLabel+'でのNPB一軍成績が見つかりませんでした。':'指定年のNPB一軍成績が見つかりませんでした。'};
 const hit=found[0];return {requestedName:name,status:'matched',statsType:hit.type,selectedYear:hit.row.year,team:hit.row.team,sourceUrl:hit.player.sourceUrl,stats:stats(hit.row,hit.type)};
}
window.OuenkaNpbStats={get,seasons,select,stats,outs,clubKey};
})();
