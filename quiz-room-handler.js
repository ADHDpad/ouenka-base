// worker.jsにも組み込み済み。既存のDBバインディングを使います。
async function handleQuizRoom(request,env){
 const url=new URL(request.url),base='/quiz/rooms';if(url.pathname!==base&&!url.pathname.startsWith(base+'/'))return null;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS_HEADERS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 try{
  if(request.method!=='POST')return reply({ok:false,error:'POSTで操作してください。'},405);
  if(!env.DB)return reply({ok:false,error:'DBが設定されていません。'},503);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>1000000)fail('送信データが大きすぎます。',413);
  let body;try{body=JSON.parse(raw)}catch{fail('データ形式を確認してください。')}
  if(!body||typeof body!=='object')fail('データ形式を確認してください。');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS quiz_rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL, expires INTEGER NOT NULL)').run();
  const now=Date.now(),name=String(body.name||'').trim().slice(0,20);
  const cleanSong=s=>({name:String(s?.name||'').slice(0,120),team:String(s?.team||'').slice(0,120),productionNumber:String(s?.productionNumber||'1').slice(0,10)});
  const view=(room,token)=>{
   const me=room.members.find(m=>m.token===token);if(!me)fail('参加情報が無効です。もう一度参加してください。',403);
   const q=room.questions[room.at],revealed=room.stage==='reveal'||room.stage==='finished';
   return {ok:true,code:room.code,stage:room.stage,at:room.at,total:room.questions.length,expires:room.expires,host:me.id===room.host,me:me.id,settings:room.settings,endedEarly:!!room.endedEarly,
    members:room.members.map(m=>({id:m.id,name:m.name,score:m.score,answered:!!room.answers[m.id],choice:revealed?room.answers[m.id]?.choice:undefined})),
    question:room.stage!=='lobby'&&q?{song:q.song,prompt:q.prompt,choices:q.choices,randomValue:q.randomValue,correct:revealed?q.correct:undefined}:null};
  };
  if(url.pathname===base){
   if(!name)fail('参加名を入力してください。');
   if(!Array.isArray(body.questions)||!body.questions.length||body.questions.length>100)fail('問題数は1〜100問です。');
   const questions=body.questions.map(q=>{if(!q||!Array.isArray(q.choices)||q.choices.length<4||q.choices.length>10||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.choices.length)fail('問題の形式を確認してください。');const choices=q.choices.map(n=>String(n).slice(0,120));if(choices.some(n=>!n)||new Set(choices).size!==choices.length)fail('選択肢を確認してください。');return {song:cleanSong(q.song),prompt:String(q.prompt||'').slice(0,8000),choices,correct:q.correct,randomValue:Math.random()}});
   const input=body.settings||{},settings={kind:input.kind==='lyrics'?'lyrics':'audio',unit:input.unit==='bars'?'bars':'seconds',bars:[1,2,4,8,16].includes(Number(input.bars))?Number(input.bars):1,seconds:[5,10,20].includes(Number(input.seconds))?Number(input.seconds):10,excerpt:input.excerpt==='start'?'start':'random'};
   await env.DB.prepare('DELETE FROM quiz_rooms WHERE expires <= ?').bind(now).run();
   for(let i=0;i<5;i++){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(8)),code=Array.from(bytes,b=>alphabet[b&31]).join(''),token=crypto.randomUUID(),id=crypto.randomUUID(),expires=now+7200000;
    const room={code,host:id,expires,stage:'lobby',at:0,settings,questions,members:[{id,token,name,score:0}],answers:{}};
    const result=await env.DB.prepare('INSERT OR IGNORE INTO quiz_rooms (code,data,revision,expires) VALUES (?,?,0,?)').bind(code,JSON.stringify(room),expires).run();
    if(result.meta?.changes)return reply({...view(room,token),token},201);
   }fail('ルームを作成できませんでした。もう一度お試しください。',503);
  }
  const match=url.pathname.match(/^\/quiz\/rooms\/([A-Z2-9]{8})\/(join|state|start|answer|reveal|next|leave)$/);if(!match)fail('参加コードを確認してください。',404);
  const [,code,action]=match;
  for(let attempt=0;attempt<8;attempt++){
   const row=await env.DB.prepare('SELECT data,revision,expires FROM quiz_rooms WHERE code = ?').bind(code).first();if(!row||row.expires<=now)fail('ルームが見つかりません。有効期限は作成から2時間です。',404);
   const room=JSON.parse(row.data);let token=String(body.token||''),me=room.members.find(m=>m.token===token);
   if(action==='join'){
    if(!me){if(room.stage!=='lobby')fail('開始後は新しく参加できません。',409);if(room.members.length>=12)fail('参加できるのは12人までです。',409);if(!name)fail('参加名を入力してください。');token=crypto.randomUUID();me={id:crypto.randomUUID(),token,name,score:0};room.members.push(me)}
   }else if(!me)fail('参加情報が無効です。もう一度参加してください。',403);
   if(action==='state')return reply(view(room,token));
   if(['start','reveal','next'].includes(action)&&me.id!==room.host)fail('ホストだけが操作できます。',403);
   // 操作した問題番号を照合し、再送・連打で次の問題を飛ばさない。
   if(['answer','reveal','next'].includes(action)&&body.at!==room.at)fail('問題が進みました。画面を更新します。',409);
   const reveal=()=>{if(room.stage!=='question')return;const correct=room.questions[room.at].correct;for(const m of room.members)if(room.answers[m.id]?.choice===correct)m.score++;room.stage='reveal'};
   if(action==='start'){if(room.stage!=='lobby')return reply(view(room,token));if(room.members.length<2)fail('2人以上集まってから開始してください。');room.stage='question'}
   if(action==='answer'){
    if(room.stage==='question'&&!room.answers[me.id]){const choice=body.choice;if(!Number.isInteger(choice)||choice< -1||choice>=room.questions[room.at].choices.length)fail('回答を確認してください。');room.answers[me.id]={choice};if(room.members.every(m=>room.answers[m.id]))reveal()}
   }
   if(action==='reveal')reveal();
   if(action==='next'&&room.stage==='reveal'){if(room.at+1===room.questions.length)room.stage='finished';else{room.at++;room.answers={};room.stage='question'}}
   if(action==='leave'){
    if(me.id===room.host){room.endedEarly=room.stage!=='finished';room.stage='finished'}else{room.members=room.members.filter(m=>m.id!==me.id);delete room.answers[me.id];if(room.stage==='question'&&room.members.every(m=>room.answers[m.id]))reveal()}
   }
   const result=await env.DB.prepare('UPDATE quiz_rooms SET data = ?, revision = revision + 1 WHERE code = ? AND revision = ?').bind(JSON.stringify(room),code,row.revision).run();
   if(result.meta?.changes)return action==='leave'?reply({ok:true}):reply({...view(room,token),...(action==='join'?{token}:{})});
  }
  return reply({ok:false,error:'回答が集中しています。もう一度お試しください。'},409);
 }catch(error){return reply({ok:false,error:error.status?error.message:'ルームを利用できません。Workerの更新とDB設定を確認してください。'},error.status||503)}
}
