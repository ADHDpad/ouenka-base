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
const CAREER_RULE='打者：300打席以上でOPS最高／投手：50投球回以上で防御率最低。該当年なしは最多打席・最多投球回の年。同値は出場量、次に新しい年度を優先。NPB一軍公式戦・全球団の年度成績。';
async function careerHtml(url){const cache=globalThis.caches?.default,key=new Request(url);let r=cache?await cache.match(key):null;if(!r){r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'text/html'}});if(!r.ok)throw Error('NPB取得失敗 HTTP '+r.status);if(cache)await cache.put(key,new Response(await r.clone().arrayBuffer(),{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=21600'}}))}return r.text()}
function careerLinks(html,name){const target=normalize(name),aliases={'フランミルレイエス':'レイエス','アリエルマルティネス':'マルティネス'};return [...html.matchAll(/<a\b[^>]*href=["']([^"']*\/bis\/players\/\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(m[1],'https://npb.jp').href,name:plain((m[2].match(/<dd\b[^>]*class=["']name["'][^>]*>([\s\S]*?)<\/dd>/i)||[])[1]||m[2])})).filter(p=>normalize(p.name)===(aliases[target]||target))}
function parseCareer(html,type){html=html.replace(/<table\b[^>]*class=["\']table_inning["\'][^>]*>[\s\S]*?<\/table>/gi,part=>plain(part).replace(/\s+/g,''));const result=[];
 for(const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)){
  const rows=[...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>plain(c[1]).replace(/\s+/g,'')));
  const hi=rows.findIndex(r=>r.includes('年度')&&r.includes(type==='pitching'?'防御率':'打率'));if(hi<0)continue;const header=rows[hi];let currentYear=null;
  for(let row of rows.slice(hi+1)){if(/^\d{4}$/.test(row[0]))currentYear=Number(row[0]);else if(currentYear&&row.length===header.length-1&&!/通算/.test(row[0]))row=[String(currentYear),...row];else if(currentYear&&!row[0]&&/合計|^計$/.test(row[1]))row=[String(currentYear),...row.slice(1)];else continue;
   if(row.length!==header.length)continue;const value=k=>row[header.indexOf(k)]||'',year=Number(row[0]);if(year<1936||year>new Date().getFullYear())continue;const raw=Object.fromEntries(header.map((h,i)=>[h,row[i]]));result.push({year,team:value('所属球団'),raw});
  }if(result.length)break;
 }
 const grouped=new Map();for(const r of result){if(!grouped.has(r.year))grouped.set(r.year,[]);grouped.get(r.year).push(r)}
 return [...grouped].map(([year,all])=>{const total=all.find(r=>/合計|^計$/.test(r.team)),records=total?[total]:all;const sum=k=>records.reduce((a,r)=>a+(Number(r.raw[k])||0),0),first=records[0].raw,team=records.length>1?'複数球団合計':records[0].team;
  if(type==='pitching'){const outs=records.reduce((a,r)=>a+(inningsToOuts(r.raw['投球回'])||0),0);if(!outs)return null;return {year,team,wins:String(sum('勝利')),losses:String(sum('敗北')),era:records.length===1?first['防御率']:(sum('自責点')*27/outs).toFixed(2),whip:((sum('安打')+sum('四球'))*3/outs).toFixed(2),strikeouts:String(sum('三振')),innings:String(Math.floor(outs/3))+(outs%3?'.'+outs%3:''),outs,volume:outs}}
  const ab=sum('打数'),pa=sum('打席');if(!ab)return null;let avg=records.length===1?first['打率']:(sum('安打')/ab).toFixed(3),slg=records.length===1?first['長打率']:(sum('塁打')/ab).toFixed(3),den=ab+sum('四球')+sum('死球')+sum('犠飛'),obp=records.length===1?first['出塁率']:den?((sum('安打')+sum('四球')+sum('死球'))/den).toFixed(3):'';if(!/^\d*\.\d+$/.test(slg||'')||!/^\d*\.\d+$/.test(obp||''))return null;return {year,team,avg:avg.replace(/^0\./,'.'),hr:String(sum('本塁打')),rbi:String(sum('打点')),sb:String(sum('盗塁')),ops:(Number(slg)+Number(obp)).toFixed(3).replace(/^0\./,'.'),slg,obp,pa,volume:pa};
 }).filter(Boolean);
}
function chooseCareer(records,type){const valid=records.filter(r=>type==='pitching'?r.outs>0&&/^\d+(?:\.\d+)?$/.test(r.era):r.pa>0&&Number.isFinite(Number(r.ops)));const eligible=valid.filter(r=>type==='pitching'?r.outs>=150:r.pa>=300);const pool=eligible.length?eligible:valid;return pool.slice().sort((a,b)=>{if(!eligible.length)return b.volume-a.volume||b.year-a.year;return (type==='pitching'?Number(a.era)-Number(b.era):Number(b.ops)-Number(a.ops))||b.volume-a.volume||b.year-a.year})[0]||null}
async function careerBatch(body){const {names,type,team}=body;if(!Array.isArray(names)||!names.length||names.length>12||names.some(n=>typeof n!=='string'||n.length>100)||!TEAMS[team])return response({ok:false,error:'球団・選手名を確認してください（キャリアハイは1回12人まで）。'},400);const players=new Array(names.length);let next=0;await Promise.all(Array.from({length:Math.min(3,names.length)},async()=>{while(next<names.length){const i=next++,name=names[i];try{const search='https://npb.jp/bis/players/search/result?search_keyword='+encodeURIComponent(normalize(name)),links=careerLinks(await careerHtml(search),name),unique=[...new Map(links.map(p=>[p.url,p])).values()];if(unique.length!==1){players[i]={requestedName:name,status:unique.length?'ambiguous':'not_found'};continue}const sourceUrl=unique[0].url,stats=chooseCareer(parseCareer(await careerHtml(sourceUrl),type),type);players[i]=stats?{requestedName:name,status:'matched',stats,statsType:type,sourceUrl,selectedYear:stats.year}:{requestedName:name,status:'not_found'}}catch(e){players[i]={requestedName:name,status:'error',error:e.message}}}}));return response({ok:true,year:'career',team,type,players,careerRule:CAREER_RULE,retrievedAt:new Date().toISOString()})}

export default {async fetch(request){
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 const url=new URL(request.url);if(url.pathname==='/')return response({ok:true,service:'OUENKA NPB STATS',build:'20261016-career-r116'});
 if(url.pathname!=='/stats/batch'||request.method!=='POST')return response({ok:false,error:'Not found'},404);
 try{
  const body=await request.json(),year=Number(body.year),team=String(body.team||''),names=body.names,type=body.type||'batting';
  if(!['batting','pitching'].includes(type))return response({ok:false,error:'成績の種類を確認してください。'},400);
  if(body.year==='career')return await careerBatch({...body,type});
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
