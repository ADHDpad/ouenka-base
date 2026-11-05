// Cloudflare Worker module. Bind R2 bucket as BUCKET. Deploy separately at /api/room-draft/*.
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const reply=(obj,status=200)=>Response.json(obj,{status,headers});
const rand=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){let j=rand(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const id=()=>crypto.randomUUID();
const fail=(s,code=400)=>{throw Object.assign(new Error(s),{code})};
const view=(r,m)=>({code:r.code,revision:r.revision,phase:r.phase,host:r.host,me:m.id,players:r.players.map(({token,...x})=>x),count:r.count,round:r.round,pool:r.pool,claimed:r.claimed,logs:r.logs.slice(-40),revealed:r.revealed||null,finished:r.finished||false});
function cpuChoice(r,player,excluded=[]){let pool=r.pool.filter(s=>!r.claimed.includes(s.key)&&!excluded.includes(s.key));if(!pool.length)return null;pool.sort((a,b)=>(b.points||0)-(a.points||0));const n=pool.length;const roll=rand(100),lo=roll<45?0:roll<80?Math.floor(n*.3):Math.floor(n*.7),hi=roll<45?Math.max(1,Math.ceil(n*.3)):roll<80?Math.max(lo+1,Math.ceil(n*.7)):n;return pool[lo+rand(Math.max(1,hi-lo))]?.key}
function progress(r){
 if(r.phase!=='draft')return;
 for(let attempt=0;attempt<20;attempt++){
  for(const p of r.players)if(p.cpu&&!p.doneRound&&!p.pick)p.pick=cpuChoice(r,p,p.failed||[]);
  const active=r.players.filter(p=>!p.doneRound);
  if(active.some(p=>!p.pick))return;
  const grouped=new Map();for(const p of active){if(!grouped.has(p.pick))grouped.set(p.pick,[]);grouped.get(p.pick).push(p)}
  const reveals=[];
  for(const [key,ps] of grouped){const winner=ps[rand(ps.length)];r.claimed.push(key);winner.roster.push(key);winner.doneRound=true;reveals.push({key,contenders:ps.map(p=>p.id),winner:winner.id});for(const p of ps){p.pick=null;if(p!==winner)p.failed.push(key)}}
  r.revealed=reveals;r.logs.push(`第${r.round}巡：${reveals.length}曲の指名結果`);
  if(r.players.every(p=>p.doneRound)){
   if(r.round>=10||r.pool.every(s=>r.claimed.includes(s.key))){r.phase='done';r.finished=true;return}
   r.round++;for(const p of r.players){p.doneRound=false;p.failed=[];p.pick=null}
  }
 }
}
export default {async fetch(request,env){if(request.method==='OPTIONS')return reply({ok:true});if(request.method!=='POST')return reply({error:'POSTのみ'},405);try{if(!env.BUCKET)fail('R2のBUCKETバインディングが必要です',503);const action=new URL(request.url).pathname.split('/').pop();const raw=await request.text();if(raw.length>120000)fail('送信サイズ超過');const b=JSON.parse(raw),key='room-draft/'+String(b.code||'').toUpperCase();if(action==='create'){const count=Number(b.count||50);if(![30,50,70,100].includes(count))fail('候補数が不正です');const p={id:id(),token:id(),name:String(b.name||'ホスト').slice(0,24),cpu:false,roster:[],pick:null,failed:[],doneRound:false};let code,existing;for(let i=0;i<12;i++){code=String(1000+rand(9000));existing=await env.BUCKET.head('room-draft/'+code);if(!existing)break}if(existing)fail('コード発行に失敗',503);const r={code,revision:1,phase:'lobby',host:p.id,players:[p],count,round:1,pool:[],claimed:[],logs:[],expires:Date.now()+86400000};await env.BUCKET.put('room-draft/'+code,JSON.stringify(r),{onlyIf:{etagDoesNotMatch:'*'}});return reply({...view(r,p),token:p.token})}if(!/^\d{4}$/.test(String(b.code||'')))fail('4桁のコードを入力してください');const obj=await env.BUCKET.get(key);if(!obj)fail('ルームがありません',404);const r=await obj.json();if(Date.now()>r.expires)fail('期限切れのルームです',410);let m;if(action==='join'){if(r.phase!=='lobby'||r.players.length>=4)fail('参加できません',409);m={id:id(),token:id(),name:String(b.name||'参加者').slice(0,24),cpu:false,roster:[],pick:null,failed:[],doneRound:false};r.players.push(m)}else{m=r.players.find(p=>!p.cpu&&p.token===b.token);if(!m)fail('参加認証に失敗しました',403)}if(action==='state')return reply(view(r,m));if(action!=='join'&&b.revision!==r.revision)fail('別端末で更新されました。再試行してください',409);
if(action==='cpu'){if(m.id!==r.host||r.phase!=='lobby')fail('操作不可',403);const n=Number(b.number);if(!Number.isInteger(n)||n<0||n>4-r.players.filter(p=>!p.cpu).length)fail('CPU数が不正です');r.players=r.players.filter(p=>!p.cpu);for(let i=0;i<n;i++)r.players.push({id:id(),name:'CPU '+(i+1),cpu:true,roster:[],pick:null,failed:[],doneRound:false})}
else if(action==='start'){if(m.id!==r.host||r.phase!=='lobby'||r.players.length!==4)fail('4人そろえて開始してください',409);if(!Array.isArray(b.pool))fail('候補がありません');const seen=new Set();r.pool=b.pool.filter(s=>{if(!s||typeof s.key!=='string'||seen.has(s.key))return false;seen.add(s.key);return true}).slice(0,r.count).map(s=>({key:s.key,name:String(s.name||'').slice(0,80),team:String(s.team||'').slice(0,40),points:Math.max(0,Number(s.points)||0)}));if(r.pool.length!==r.count)fail('候補が不足しています');r.phase='draft';progress(r)}
else if(action==='pick'){if(r.phase!=='draft'||m.doneRound||m.pick)fail('現在指名できません',409);if(!r.pool.some(s=>s.key===b.song)||r.claimed.includes(b.song)||m.failed.includes(b.song))fail('この曲は指名できません');m.pick=b.song;progress(r)}
else if(action!=='join')fail('不明な操作',404);
r.revision++;const saved=await env.BUCKET.put(key,JSON.stringify(r),{onlyIf:{etagMatches:obj.etag}});if(!saved)fail('同時更新です。もう一度お試しください',409);return reply({...view(r,m),...(action==='join'?{token:m.token}:{})})}catch(e){return reply({error:e.message||'通信エラー'},e.code||500)}}};
