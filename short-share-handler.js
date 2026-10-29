// Embedded in worker.js. Uses the existing DB binding; tables are created automatically.
async function handleShortShare(request,env){
 const url=new URL(request.url),legacy=url.pathname==='/favorites/share'||url.pathname.startsWith('/favorites/share/');
 if(!legacy&&url.pathname!=='/share'&&!url.pathname.startsWith('/share/'))return null;
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const reply=(data,status=200)=>Response.json(data,{status,headers}),fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(!env.DB)fail('共有サービスのデータベースが未設定です。',503);
  if(!['GET','POST'].includes(request.method))fail('GETまたはPOSTで利用してください。',405);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS short_shares (code TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS short_share_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)').run();
  const now=Date.now(),period=Math.floor(now/60000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ouenka-short-share:'+ip))),n=>n.toString(16).padStart(2,'0')).join('');
  const rate=await env.DB.prepare('INSERT INTO short_share_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(hash+':'+request.method+':'+period,(period+2)*60000).first();
  if(rate.attempts>(request.method==='POST'?10:12))fail('短時間に操作が続いています。1分ほど待ってからもう一度お試しください。',429);
  await env.DB.prepare('DELETE FROM short_share_limits WHERE expires_at <= ?').bind(now).run();
  function favorites(items){if(!Array.isArray(items)||items.length>500)fail('お気に入りは500曲まで共有できます。');return items.map(s=>{const name=String(s?.name||'').trim(),productionNumber=String(s?.productionNumber||'').trim(),team=String(s?.team||'').trim(),reading=String(s?.reading||'').trim();if(!name||name.length>120||!/^\d{1,10}$/.test(productionNumber)||team.length>120||reading.length>120)fail('曲の共有情報を確認してください。');return {name,productionNumber,team,reading}})}
  function validate(kind,data){
   if(data?.version!==1)fail('共有データの形式を確認してください。');
   if(kind==='favorites'){const items=favorites(data.items);if(!items.length)fail('お気に入りを登録してから共有してください。');return {version:1,items}}
   if(kind==='songbook'){
    if(!Array.isArray(data.records)||data.records.length>20000)fail('図鑑の記録件数を確認してください。');
    const records=data.records.map(r=>{const name=String(r?.name||'').trim(),productionNumber=String(r?.productionNumber||'').trim();if(!name||name.length>120||!/^\d{1,10}$/.test(productionNumber))fail('図鑑の曲情報を確認してください。');return {name,productionNumber,heard:r.heard===true,quizCorrect:r.quizCorrect===true}});
    const items=favorites(data.favorites||[]);if(!records.length&&!items.length)fail('図鑑の記録またはお気に入りを追加してから共有してください。');return {version:1,records,favorites:items};
   }
   if(kind==='playlist'){
    if(!['lineup','medley'].includes(data.mode)||!Array.isArray(data.rows)||!data.rows.length||data.rows.length>500)fail('共有する曲順を確認してください。');
    const text=(v,n)=>String(v??'').trim().slice(0,n),rows=data.rows.map(r=>{if(!r||typeof r!=='object')fail('曲の情報を確認してください。');const name=text(r.name,120),productionNumber=text(r.productionNumber,10),reuseName=text(r.reuseName,120),reuseProductionNumber=text(r.reuseProductionNumber,10);if(name&&!/^\d{1,10}$/.test(reuseName?reuseProductionNumber:productionNumber))fail('曲の制作番号を確認してください。');return {name,productionNumber,position:text(r.position,30),team:text(r.team,120),lyrics:text(r.lyrics,10000),songId:text(r.songId,80),reuseName,reuseProductionNumber,reuseMode:reuseName?text(r.reuseMode||'reuse',30):''}});
    if(!rows.some(r=>r.name))fail('曲を選択してから共有してください。');return {version:1,mode:data.mode,title:text(data.title,200),color:text(data.color||'theme',120),year:text(data.year,10),team:text(data.team,120),rows};
   }
   fail('共有データの種類を確認してください。');
  }
  if(request.method==='POST'){
   if(Number(request.headers.get('Content-Length'))>1500000)fail('共有データが大きすぎます。',413);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>1500000)fail('共有データが大きすぎます。',413);
   let body;try{body=JSON.parse(raw)}catch{fail('共有データを確認してください。')}
   const kind=legacy?'favorites':body.kind,payload=validate(kind,legacy?body:body.payload),text=JSON.stringify(payload),expires=now+3600000;
   await env.DB.prepare('DELETE FROM short_shares WHERE expires_at <= ?').bind(now).run();
   for(let attempt=0;attempt<64;attempt++){
    let random;do{random=crypto.getRandomValues(new Uint32Array(1))[0]}while(random>=4294960000);
    const code=String(random%10000).padStart(4,'0');
    const result=await env.DB.prepare('INSERT OR IGNORE INTO short_shares (code,kind,payload,created_at,expires_at) VALUES (?,?,?,?,?)').bind(code,kind,text,now,expires).run();
    if(result.meta?.changes)return reply({ok:true,code,kind,expiresAt:new Date(expires).toISOString()},201);
   }
   fail('共有コードが混み合っています。しばらくして再試行してください。',503);
  }
  const code=url.pathname.slice((legacy?'/favorites/share/':'/share/').length);if(!/^\d{4}$/.test(code))fail('共有コードは数字4桁で入力してください。');
  const row=await env.DB.prepare('SELECT kind,payload,expires_at FROM short_shares WHERE code = ?').bind(code).first();
  if(!row||row.expires_at<=now)fail('共有コードが見つからないか、1時間の有効期限が切れています。作成し直してください。',404);
  if(legacy&&row.kind!=='favorites')fail('お気に入りの共有コードを入力してください。');
  const payload=JSON.parse(row.payload);return reply(legacy?{ok:true,...payload,expiresAt:new Date(row.expires_at).toISOString()}:{ok:true,kind:row.kind,payload,expiresAt:new Date(row.expires_at).toISOString()});
 }catch(e){return reply({ok:false,error:e.status?e.message:'共有サービスを利用できません。worker.jsの更新とDB設定を確認してください。'},e.status||503)}
}
