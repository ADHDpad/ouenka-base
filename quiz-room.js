(()=>{'use strict';
 const $=id=>document.getElementById(id),api='https://ouenka-base-data.ninzin5600.workers.dev/quiz/rooms',audio=window.OuenkaPlayAudio;
 const key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s・･]/g,''),shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 let catalog=null,catalogLoading=null,session=null,current=null,busy=false,polling=false,seq=0,applied=0,lastQuestion='',audioEpoch=0,leaving=false,hearing=false,played=null;
 const status=text=>{$('roomStatus').textContent=text};
 try{session=JSON.parse(sessionStorage.getItem('ouenka_quiz_room_v1')||'null');if(!/^[A-Z2-9]{8}$/.test(session?.code)||!session?.token)session=null}catch{}
 function persist(){try{if(session)sessionStorage.setItem('ouenka_quiz_room_v1',JSON.stringify(session));else sessionStorage.removeItem('ouenka_quiz_room_v1')}catch{}}
 async function request(path,body){const response=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});let data;try{data=await response.json()}catch{throw Error('対戦サービスを確認できません。更新版のworker.jsを公開してください。')}if(!response.ok||!data.ok)throw Object.assign(Error(data.error||'通信できませんでした。'),{status:response.status});return data}
 async function loadCatalog(){if(catalog)return catalog;if(catalogLoading)return catalogLoading;catalogLoading=fetchCatalog();try{return await catalogLoading}finally{catalogLoading=null}}
 async function fetchCatalog(){const r=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('応援歌の一覧を読み込めませんでした。');const d=await r.json();if(!Array.isArray(d.songs))throw Error('応援歌の一覧を確認できませんでした。');catalog=d.songs.filter(s=>!['1','true'].includes(String(s.is_generic??s.isGeneric??'').trim().toLowerCase())).map(raw=>{const s=window.OuenkaQuizMetadata?.merge(raw)||raw;return {...s,name:String(s.player_name||s.name||''),productionNumber:String(s.production_number||s.productionNumber||1),team:String(s.team||''),lyrics:String(s.lyrics||''),isActive:['現在使用','現役','1','true'].includes(String(s.player_type??s.active??'').trim())}}).filter(s=>s.name);const old=$('roomTeam').value;for(const t of [...new Set(catalog.map(s=>s.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')))$('roomTeam').append(new Option(t,t));$('roomTeam').value=old;return catalog}
 function settings(){
  const value=id=>$(id).value,startBar=Number(value('roomStartBar'));
  if(value('roomKind')==='audio'&&value('roomExcerpt')==='custom'&&(!Number.isInteger(startBar)||startBar<1||startBar>128))throw Error('開始小節を1〜128の整数で入力してください。');
  return {version:2,kind:value('roomKind'),answerMode:value('roomAnswerMode'),unit:'bars',bars:1,
   excerpt:value('roomExcerpt'),startBar,lyricLines:Number(value('roomLyricLines')),team:value('roomTeam'),active:value('roomActive'),excludePitchers:$('roomExcludePitchers').checked};
 }
 function lyricHints(song,problem,pool){
  const rules=window.OuenkaQuizRules,hints=[];let offset=problem.offset;
  for(let count=problem.count;count<=Math.min(4,problem.lines.length);count++){
   if(offset+count>problem.lines.length)offset=problem.lines.length-count;
   const prompt=rules.maskName(problem.lines.slice(offset,offset+count).join('\n'),song);
   hints.push({prompt,accepted:[...new Set(pool.filter(other=>rules.lyricsMatch(other,prompt)).map(other=>other.name))]});
  }
  return hints;
 }
 function buildQuestions(config){
  const rules=window.OuenkaQuizRules,count=Number($('roomQuestionCount').value),needed=config.answerMode==='search'?0:Number($('roomChoiceCount').value)-1;
  const pool=catalog.filter(s=>(!config.team||s.team===config.team)&&(config.active==='all'||(config.active==='active'?s.isActive:!s.isActive))&&
   (!config.excludePitchers||!rules.isPitcherSong(s))&&(config.kind!=='lyrics'||rules.validLyrics(s)));
  const groups=new Map();
  for(const song of pool){const id=key(song.name);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(song)}
  const questions=[];
  for(const versions of shuffle([...groups.values()])){
   for(const song of shuffle(versions)){
    const lyric=config.kind==='lyrics'?rules.lyricsQuestion(song,pool,config.lyricLines,{minAlternatives:needed}):null;
    if(config.kind==='lyrics'&&!lyric)continue;
    const wrong=lyric?lyric.alternatives:needed?rules.audioAlternatives(song,pool,needed):[];
    if(wrong.length!==needed)continue;
    const options=shuffle([song,...wrong]);
    questions.push({song:{name:song.name,team:song.team,productionNumber:song.productionNumber},prompt:lyric?.prompt||'',
     lyricLines:lyric?.count,hints:lyric?lyricHints(song,lyric,config.answerMode==='search'?catalog:pool):[],
     accepted:config.kind==='audio'&&config.answerMode==='search'?[...new Set(catalog.filter(other=>rules.sameBody(song,other)).map(other=>other.name))]:[],
     choices:options.map(s=>s.name),correct:options.indexOf(song)});
    break;
   }
   if(questions.length===count)break;
  }
  if(!questions.length)throw Error('この条件で出題できる問題がありません。球団・対象を広げるか、選択肢を減らしてください。');
  return questions;
 }
 function stop(){audioEpoch++;hearing=false;audio.stop();$('roomAudioStatus').textContent=''}
 function submitAnswer(extra){
  if(current?.stage!=='question')return;
  if(extra.choice!==-1&&current.settings.version===2&&current.settings.kind!=='lyrics'&&(!played||hearing||current.settings.kind==='audio'&&played.bars>current.hintLevel)){
   $('roomAudioStatus').textContent='音源を聴いてから回答してください。';return;
  }
  return act('answer',extra);
 }
 function renderSearch(){
  const query=key($('roomAnswerQuery').value),seen=new Set();
  const matches=query?(catalog||[]).filter(song=>{const id=key(song.name);if(seen.has(id)||!key(song.name+' '+(song.reading||'')).includes(query))return false;seen.add(id);return true}).slice(0,20):[];
  $('roomAnswerCandidates').replaceChildren(...matches.map(song=>{const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=song.name+' ／ '+song.team;b.onclick=()=>submitAnswer({answer:song.name});return b}));
 }
 function render(data){current=data;$('roomSetup').hidden=true;$('roomBattle').hidden=false;$('roomDisplayCode').textContent=data.code;$('roomHostActions').hidden=!data.host;
  $('roomLeave').textContent=data.host?'ルームを終了して退出':'ルームから退出';$('roomStart').hidden=data.stage!=='lobby';$('roomStart').disabled=data.members.length<2;$('roomReveal').hidden=data.stage!=='question';$('roomNext').hidden=data.stage!=='reveal';$('roomNext').textContent=data.at+1===data.total?'最終結果を見る':'次の問題へ';
  $('roomPhase').textContent=data.stage==='lobby'?(data.host?'参加者が集まったら「対戦を開始」を押してください。':'ホストの開始を待っています。'):data.stage==='question'?'回答済み '+data.members.filter(m=>m.answered).length+' / '+data.members.length+'人':data.stage==='reveal'?'正解発表！ ホストの操作で次へ進みます。':(data.endedEarly?'ホストが退出したため、対戦を終了しました。':'対戦終了！');
  $('roomQuestion').hidden=data.stage==='lobby'||data.stage==='finished';$('roomRankingTitle').textContent=data.stage==='lobby'?'参加メンバー':data.stage==='finished'?'最終ランキング':'現在の順位';
  const sorted=[...data.members].sort((a,b)=>b.score-a.score);let rank=0,previous=-1;$('roomMembers').replaceChildren(...sorted.map((m,i)=>{if(m.score!==previous){rank=i+1;previous=m.score}const li=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=(data.stage==='lobby'?'':rank+'位 ')+m.name+(m.id===data.me?'（あなた）':'');score.textContent=data.stage==='lobby'?'参加中':m.score+'点'+(data.stage==='question'?(m.answered?' ✓':' 回答中'):'');li.append(name,score);if(m.id===data.me)li.classList.add('mine');return li}));
  const qkey=data.code+':'+data.at+':'+data.stage;if(lastQuestion!==qkey){stop();played=null;lastQuestion=qkey;$('roomFeedback').textContent='';$('roomAnswerQuery').value='';$('roomAnswerCandidates').replaceChildren()}
  if(data.stage==='lobby'||data.stage==='finished')return;
  const q=data.question,me=data.members.find(m=>m.id===data.me),revealed=data.stage==='reveal';
  const blocked=busy||me.answered||revealed,kind=data.settings.kind,search=data.settings.answerMode==='search',modern=data.settings.version===2;
  $('roomProgress').textContent='第 '+(data.at+1)+' 問 / '+data.total+'問';
  $('roomPrompt').hidden=kind!=='lyrics';$('roomPrompt').textContent=q.prompt;
  $('roomListen').hidden=$('roomStop').hidden=kind==='lyrics';$('roomListen').disabled=blocked||hearing;
  $('roomListen').textContent=kind==='chord'?'▶ コード進行を聴く':'▶ 応援歌を聴く';
  $('roomMoreAudio').hidden=!modern||kind!=='audio'||blocked;
  $('roomMoreAudio').disabled=hearing||!played||data.hintLevel>=played.maxBars;
  $('roomMoreAudio').textContent='＋ 1小節追加して再生（正解で'+Math.max(0,4-data.hintLevel)+'点）';
  $('roomMoreLyrics').hidden=!modern||kind!=='lyrics'||!q.canExtendLyrics||blocked;
  $('roomSkip').hidden=blocked;
  $('roomSearch').hidden=!search||blocked;$('roomAnswerQuery').disabled=blocked;
  $('roomAnswers').hidden=search;
  $('roomAnswers').replaceChildren(...q.choices.map((name,i)=>{const b=document.createElement('button');b.textContent=String.fromCharCode(65+i)+'　'+name;b.disabled=blocked;if(revealed&&i===q.correct)b.classList.add('correct');if(revealed&&me.choice===i&&i!==q.correct)b.classList.add('wrong');b.onclick=()=>submitAnswer({choice:i});return b}));
  if(kind==='lyrics'&&modern&&!blocked)$('roomAudioStatus').textContent=(q.lyricLines+data.hintLevel-1)+'フレーズ表示：正解で'+Math.max(1,6-q.lyricLines-data.hintLevel)+'点';
  const correct=me.correct??(me.answered&&me.choice===q.correct);
  if(revealed&&me.answered)window.OuenkaStats?.quiz(q.song,kind,correct,'room:'+data.code+':'+data.expires+':'+data.at+':'+data.me);
  if(revealed&&correct){try{if(!window.OuenkaSongbook?.get(q.song).quizCorrect)window.OuenkaSongbook?.set(q.song,'quizCorrect',true)}catch(e){console.warn('クイズの記録を保存できませんでした',e)}}
  if(revealed)$('roomFeedback').textContent=(correct?'正解！':!me.answered||me.choice===-1?'未回答でした。':'今回は不正解。')+'\n正解：'+(q.answerName||q.choices[q.correct]);else if(me.answered)$('roomFeedback').textContent='回答を送信しました。ほかの参加者を待っています。';
 }
 async function act(action,extra={}){if(busy||!session)return;busy=true;if(action==='answer')stop();const id=++seq;try{const data=await request('/'+session.code+'/'+action,{token:session.token,at:current?.at,...extra});if(id>=applied){applied=id;render(data)}status('')}catch(error){status(error.message);if(error.status===409)refresh()}finally{busy=false;if(current)render(current)}}
 async function refresh(){if(!session||polling||busy||leaving||document.hidden)return;polling=true;const id=++seq;try{const data=await request('/'+session.code+'/state',{token:session.token});if(id>=applied&&!leaving){applied=id;render(data);status('')}}catch(error){status(error.message+' 再接続を試みています。');if(error.status===403||error.status===404){session=null;persist();current=null;stop();$('roomSetup').hidden=false;$('roomBattle').hidden=true}}finally{polling=false}}
 async function enter(create){if(busy)return;const name=$('roomName').value.trim();if(!name){status('参加名を入力してください。');$('roomName').focus();return}busy=true;$('roomJoin').disabled=$('roomCreate').disabled=true;status(create?'問題を準備しています…':'ルームに参加しています…');const id=++seq;
  try{let data;if(create){await loadCatalog();const config=settings();const directory=await window.OuenkaNpbDirectory?.load().catch(()=>[])||[];window.OuenkaQuizRules.setPlayerNames([...catalog,...directory]);data=await request('',{name,questions:buildQuestions(config),settings:config});if(data.settings.version!==2)throw Error('対戦サービスの更新が必要です。新しいworker.jsを公開してください。')}else{const code=$('roomCode').value.normalize('NFKC').toUpperCase().replace(/[\s-]/g,'');if(!/^[A-Z2-9]{8}$/.test(code))throw Error('参加コードは8文字で入力してください。');data=await request('/'+code+'/join',{name,...(session?.code===code?{token:session.token}:{})})}session={code:data.code,token:data.token};persist();applied=id;render(data);status('')}
  catch(error){status(error.message)}finally{busy=false;$('roomJoin').disabled=$('roomCreate').disabled=false;if(current)render(current)}
 }
 function syncSettings(){
  const kind=$('roomKind').value;
  $('roomAudioSettings').hidden=kind!=='audio';$('roomLyricsSettings').hidden=kind!=='lyrics';$('roomChordSettings').hidden=kind!=='chord';
  $('roomStartBarField').hidden=$('roomExcerpt').value!=='custom';$('roomRandomHint').hidden=$('roomExcerpt').value!=='random';
  $('roomChoiceCount').closest('label').hidden=$('roomAnswerMode').value==='search';
 }
 const soloMode=new URLSearchParams(location.search).get('kind');
 if(['audio','lyrics','chord'].includes(soloMode))$('roomKind').value=soloMode;
 for(const id of ['roomKind','roomExcerpt','roomAnswerMode'])$(id).onchange=syncSettings;
 syncSettings();
 $('roomAnswerQuery').oninput=renderSearch;
 $('roomSkip').onclick=()=>submitAnswer({choice:-1});
 $('roomMoreLyrics').onclick=()=>act('hint',{level:current.hintLevel+1});
 $('roomJoin').onclick=()=>enter(false);$('roomCreate').onclick=()=>enter(true);$('roomStart').onclick=()=>act('start');$('roomReveal').onclick=()=>act('reveal');$('roomNext').onclick=()=>act('next');
 $('roomCopy').onclick=async()=>{try{await navigator.clipboard.writeText(session.code);status('参加コードをコピーしました。')}catch{status('参加コード：'+session.code+' を伝えてください。')}};
 async function listen(extend=false){
  if(!current||current.stage!=='question'||hearing||busy||current.members.find(m=>m.id===current.me)?.answered)return;
  const token=++audioEpoch,question=current.question,settings=current.settings;
  const level=(current.hintLevel||1)+(extend?1:0);
  const options=settings.kind==='chord'?{mask:true,chordOnly:true,full:true}:{...settings,
   bars:settings.version===2?level:settings.bars,random:settings.excerpt==='random',randomValue:question.randomValue,fixedRandomStart:settings.version===2,mask:true,start:played?.start};
  hearing=true;render(current);$('roomAudioStatus').textContent='音源を読み込んでいます…';
  try{
   const result=await audio.play(question.song,options);
   if(token!==audioEpoch||!result)return;
   played=result;
   if(extend&&result.bars>=level)await act('hint',{level});
   if(token!==audioEpoch)return;
   $('roomAudioStatus').textContent=settings.kind==='chord'?'コード進行を全編再生。正解で4点。':settings.version===2?
    result.bars+'小節：正解で'+Math.max(0,5-current.hintLevel)+'点':'再生中。同じ区間を何度でも聴けます。';
  }catch(error){if(token===audioEpoch)$('roomAudioStatus').textContent=error.message||'再生できませんでした。'}
  finally{if(token===audioEpoch){hearing=false;if(current)render(current)}}
 }
 $('roomListen').onclick=()=>listen();
 $('roomMoreAudio').onclick=()=>listen(true);
 $('roomStop').onclick=stop;
 $('roomLeave').onclick=async()=>{if(busy||!session)return;busy=true;leaving=true;try{await request('/'+session.code+'/leave',{token:session.token});session=null;persist();current=null;lastQuestion='';stop();$('roomBattle').hidden=true;$('roomSetup').hidden=false;status('退出しました。')}catch(error){status(error.message)}finally{busy=false;leaving=false}};
 window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});setInterval(refresh,2500);
 if(session){$('roomSetup').hidden=true;status('ルームに再接続しています…');refresh()}loadCatalog().catch(error=>status(error.message));
})();
