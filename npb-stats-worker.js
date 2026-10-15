// Create a separate Cloudflare Worker for official NPB batting and pitching stats.
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const TEAMS={'北海道日本ハムファイターズ':'f','福岡ソフトバンクホークス':'h','東北楽天ゴールデンイーグルス':'e','埼玉西武ライオンズ':'l','千葉ロッテマリーンズ':'m','オリックス・バファローズ':'b','読売ジャイアンツ':'g','阪神タイガース':'t','横浜DeNAベイスターズ':'db','広島東洋カープ':'c','中日ドラゴンズ':'d','東京ヤクルトスワローズ':'s','大阪近鉄バファローズ':'bu','オリックス・ブルーウェーブ':'bw'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json;charset=utf-8'}});
function plain(html){return html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim()}
function normalize(name){return String(name||'').normalize('NFKC').replace(/[\s　・･.．*+]/g,'')}
function parseBatting(html){
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell=>plain(cell[1])));
  const headerIndex=rows.findIndex(row=>row.includes('打率')&&row.includes('本塁打')&&row.includes('選手'));if(headerIndex<0)continue;
  const header=rows[headerIndex],index=label=>header.indexOf(label);const records=[];
  for(const row of rows.slice(headerIndex+1)){
   const name=row[index('選手')],rate=row[index('打率')];if(!name||!/^\.?\d{3}$|^0\.\d{3}$|^1\.000$/.test(rate||''))continue;
   const value=label=>row[index(label)]||'',slg=value('長打率'),obp=value('出塁率');
   records.push({name,avg:rate,hr:value('本塁打'),rbi:value('打点'),sb:value('盗塁'),ops:/^\.?\d+$|^\d+\.\d+$/.test(slg)&&/^\.?\d+$|^\d+\.\d+$/.test(obp)?(Number(slg)+Number(obp)).toFixed(3).replace(/^0\./,'.'):'',slg,obp});
  }
  if(records.length)return records;
 }
 throw new Error('NPBの打撃成績表を読み取れませんでした。ページ構造か年度・球団を確認してください。');
}

// 投球回の .1/.2 は小数ではなくアウト数。
function inningsToOuts(value){const m=String(value||'').trim().match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null}
function parsePitching(html){
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row=>[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell=>plain(cell[1])));
  const hi=rows.findIndex(r=>r.includes('選手')&&r.includes('防御率')&&r.includes('勝利'));if(hi<0)continue;
  const header=rows[hi],index=k=>header.indexOf(k),records=[];
  for(const row of rows.slice(hi+1)){
   const value=k=>row[index(k)]??'',name=value('選手');if(!name||!/^\d+$/.test(value('登板')))continue;
   const innings=value('投球回'),outs=inningsToOuts(innings),hits=value('安打'),walks=value('四球');
   const whip=outs>0&&/^\d+$/.test(hits)&&/^\d+$/.test(walks)?((Number(hits)+Number(walks))*3/outs).toFixed(2):'-';
   records.push({name,wins:value('勝利'),losses:value('敗北'),era:value('防御率')||'-',whip,strikeouts:value('三振'),innings,hits,walks});
  }
  if(records.length)return records;
 }
 throw new Error('NPBの投手成績表を読み取れませんでした。ページ構造か年度・球団を確認してください。');
}
export default {async fetch(request){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 const url=new URL(request.url);if(url.pathname==='/')return response({ok:true,service:'OUENKA NPB STATS',build:'20261015-pitching-2'});
 if(url.pathname!=='/stats/batch'||request.method!=='POST')return response({ok:false,error:'Not found'},404);
 try{
  const body=await request.json(),year=Number(body.year),team=String(body.team||''),names=body.names,type=body.type||'batting';
  if(!['batting','pitching'].includes(type))return response({ok:false,error:'成績の種類を確認してください。'},400);
  if(!Number.isInteger(year)||year<1950||year>new Date().getFullYear()||!TEAMS[team]||!Array.isArray(names)||names.length<1||names.length>30||names.some(n=>typeof n!=='string'||n.length>100))return response({ok:false,error:'年度・球団・選手名を確認してください。'},400);
  const sourceUrl=`https://npb.jp/bis/${year}/stats/${type==='pitching'?'idp1':'idb1'}_${TEAMS[team]}.html`,cache=globalThis.caches?.default,key=new Request(sourceUrl);
  let upstream=cache?await cache.match(key):null;
  if(!upstream){upstream=await fetch(sourceUrl,{signal:AbortSignal.timeout(15000),headers:{Accept:'text/html'}});if(!upstream.ok)return response({ok:false,error:'指定年度・球団のNPB公式成績を取得できませんでした。',sourceUrl},502);if(cache){const copy=new Response(await upstream.clone().arrayBuffer(),{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}});await cache.put(key,copy)}}
  const html=await upstream.text();if(!html.includes(String(year)+'年度')&&!html.includes(String(year)+'年'))throw new Error('ページの年度を確認できませんでした。');
  const records=type==='pitching'?parsePitching(html):parseBatting(html),aliases={'フランミルレイエス':'レイエス','アリエルマルティネス':'マルティネス'};
  const players=names.map(name=>{const normalized=normalize(name),official=aliases[normalized]||normalized,matches=records.filter(r=>normalize(r.name)===official);return matches.length===1?{requestedName:name,status:'matched',match:aliases[normalized]?'alias':'exact',stats:matches[0]}:{requestedName:name,status:matches.length>1?'ambiguous':'not_found'}});
  return response({ok:true,year,team,type,sourceUrl,retrievedAt:new Date().toISOString(),opsMethod:'NPB公表の出塁率＋長打率（各3桁）',whipMethod:'(被安打＋四球)÷投球回。投球回の.1/.2は1/3・2/3として計算。小数第2位に丸める。投球回0は算出不可。',players});
 }catch(e){return response({ok:false,error:e.message||'成績を取得できませんでした。'},502)}
}};
