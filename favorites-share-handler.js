// worker.jsにも同じ処理を組み込み済み。既存Workerに差分追加する場合の独立したハンドラー。
// URL処理の先頭で await handleFavoriteShare(request, env) を呼び、Responseが返ったらreturnする。
async function handleFavoriteShare(request,env){
 const url=new URL(request.url),base='/favorites/share';
 if(url.pathname!==base&&!url.pathname.startsWith(base+'/'))return null;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
 const schema='CREATE TABLE IF NOT EXISTS favorite_shares (code TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)';
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',now=Date.now();
 try{
  if(!env.DB)return reply({ok:false,error:'共有サービスのデータベースが未設定です。'},503);
  if(request.method==='POST'&&url.pathname===base){
   if(Number(request.headers.get('Content-Length'))>131072)return reply({ok:false,error:'共有データが大きすぎます。最大500曲です。'},413);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>131072)return reply({ok:false,error:'共有データが大きすぎます。最大500曲です。'},413);
   let data;try{data=JSON.parse(raw)}catch{return reply({ok:false,error:'共有データの形式が正しくありません。'},400)}
   if(data?.version!==1||!Array.isArray(data.items)||!data.items.length||data.items.length>500)return reply({ok:false,error:'共有できるお気に入りは1〜500曲です。'},400);
   const items=[],seen=new Set();for(const song of data.items){
    if(!song||typeof song!=='object')return reply({ok:false,error:'共有データの形式が正しくありません。'},400);
    const item={name:String(song.name||'').trim(),productionNumber:String(song.productionNumber||'').trim(),team:String(song.team||'').trim(),reading:String(song.reading||'').trim()};
    if(!item.name||item.name.length>120||!/^\d{1,10}$/.test(item.productionNumber)||item.team.length>120||item.reading.length>120)return reply({ok:false,error:'共有データの形式が正しくありません。'},400);
    const key=JSON.stringify([item.name.normalize('NFKC'),item.productionNumber]);if(!seen.has(key)){seen.add(key);items.push(item)}
   }
   const payload=JSON.stringify({version:1,items});if(new TextEncoder().encode(payload).length>131072)return reply({ok:false,error:'共有データが大きすぎます。'},413);
   await env.DB.prepare(schema).run();await env.DB.prepare('DELETE FROM favorite_shares WHERE expires_at <= ?').bind(now).run();
   const expires=now+7*24*60*60*1000;
   for(let attempt=0;attempt<5;attempt++){
    const bytes=crypto.getRandomValues(new Uint8Array(12)),code=Array.from(bytes,b=>alphabet[b&31]).join('');
    const result=await env.DB.prepare('INSERT OR IGNORE INTO favorite_shares (code,payload,created_at,expires_at) VALUES (?,?,?,?)').bind(code,payload,now,expires).run();
    if(result.meta?.changes>0)return reply({ok:true,code:code.match(/.{4}/g).join('-'),count:items.length,expiresAt:new Date(expires).toISOString()},201);
   }
   return reply({ok:false,error:'コードを発行できませんでした。もう一度お試しください。'},503);
  }
  if(request.method==='GET'&&url.pathname.startsWith(base+'/')){
   const code=url.pathname.slice(base.length+1).toUpperCase().replace(/-/g,'');
   if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(code))return reply({ok:false,error:'共有コードを確認してください。'},400);
   await env.DB.prepare(schema).run();
   const row=await env.DB.prepare('SELECT payload,expires_at FROM favorite_shares WHERE code = ?').bind(code).first();
   if(!row)return reply({ok:false,error:'共有コードが見つかりません。有効期限が切れている場合は作成し直してください。'},404);
   if(row.expires_at<=now)return reply({ok:false,error:'共有コードの有効期限が切れています。作成し直してください。'},410);
   const payload=JSON.parse(row.payload);return reply({ok:true,version:payload.version,items:payload.items,expiresAt:new Date(row.expires_at).toISOString()});
  }
  return reply({ok:false,error:'この操作には対応していません。'},405);
 }catch(error){console.error('Favorite share service:',error);return reply({ok:false,error:'共有サービスを利用できません。Workerの更新・DB設定を確認してください。'},503)}
}
