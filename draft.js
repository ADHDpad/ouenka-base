(()=>{'use strict';
const $=id=>document.getElementById(id),audio=window.OuenkaPlayAudio,flags=window.OuenkaSongRegistrationFlags,key='ouenkaDraftV1',positions=['捕手','一塁手','二塁手','三塁手','遊撃手','左翼手','中堅手','右翼手','指名打者'],slots=Array.from({length:9},(_,i)=>(i+1)+'番');let catalog=[],game=null,selected=-1,token=0;
const status=t=>$('draftStatus').textContent=t,identity=s=>s.name.normalize('NFKC').replace(/\s/g,''),shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a},persist=()=>{try{localStorage.setItem(key,JSON.stringify(game));return true}catch{status('途中経過を保存できません。保存容量を確認してください。');return false}};
function valid(g){return g&&Array.isArray(g.roster)&&g.roster.length===slots.length&&g.roster.every(s=>s===null||(s&&typeof s.name==='string'&&typeof s.position==='string'))&&Array.isArray(g.choices)&&g.choices.length<=10&&g.choices.every(s=>typeof s.name==='string')&&Number.isInteger(g.skips)&&g.skips>=0&&g.skips<=3}
try{
 const saved=JSON.parse(localStorage.getItem(key)||'null');
 if(saved&&Array.isArray(saved.roster)){saved.roster=saved.roster.slice(0,slots.length);delete saved.addPitcher}
 if(valid(saved))game=saved;
}catch{}
function complete(){return !!game&&game.roster.every(Boolean)}
function eligible(song,config){return (!config.team||song.team===config.team)&&(!config.activeOnly||song.isActive)}
function stop(){token++;audio.stop()}
function draw(){selected=-1;const started=!!game,done=started&&complete();$('draftSetup').hidden=started||!document.body.dataset.soloMode;$('draftModePicker').hidden=started||!!document.body.dataset.soloMode;$('draftGame').hidden=!started||done;$('draftRoster').hidden=!started;$('draftResult').hidden=!done;$('draftRestart').hidden=!started;$('draftAssign').hidden=true;if(!started)return;const count=game.roster.filter(Boolean).length;$('draftProgress').textContent=Math.min(count+1,9)+'人目を指名（野手 '+count+' / 9）';$('draftSkip').textContent='スキップ（残り'+(3-game.skips)+'回）';$('draftSkip').disabled=game.skips>=3;$('draftTitle').value=game.title||'応援歌ドラフト スタメン';$('draftSlots').replaceChildren(...game.roster.map((song,i)=>{const li=document.createElement('li'),b=document.createElement('b'),span=document.createElement('span');b.textContent=slots[i];span.textContent=song?song.position.slice(0,1)+' '+song.name:'未指名';li.classList.toggle('filled',!!song);li.append(b,span);if(song){const play=document.createElement('button');play.textContent='▶';play.setAttribute('aria-label',song.name+'を聴く');play.onclick=()=>hear(song);li.append(play)}return li}));$('draftChoices').replaceChildren(...game.choices.map((song,i)=>{const box=document.createElement('div');box.className='draft-card';const palette=window.OuenkaTeamColors.get(song.team);box.style.setProperty('--team',palette[0]);box.style.setProperty('--draft-main',palette[0]);box.style.setProperty('--draft-light',palette[1]);box.style.setProperty('--draft-dark',palette[2]);const name=document.createElement('strong'),meta=document.createElement('small'),lyric=document.createElement('p'),pick=document.createElement('button'),play=document.createElement('button');name.textContent=song.name;meta.textContent=song.team+' ／ 制作番号 '+song.productionNumber;lyric.textContent=song.lyrics||'歌詞未登録';pick.textContent='この曲を選択';pick.onclick=()=>choose(i);play.textContent='▶ 聴く';play.className='secondary';play.onclick=()=>hear(song);box.append(name,meta,lyric,pick,play);return box}));if(done)status('スタメン完成！保存できます。')}
function remaining(){const used=new Set(game.roster.filter(Boolean).map(identity));const groups=new Map();for(const song of catalog){if(!eligible(song,game)||used.has(identity(song)))continue;if(!groups.has(identity(song)))groups.set(identity(song),[]);groups.get(identity(song)).push(song)}return [...groups.values()].map(a=>shuffle(a)[0])}
function deal(){const pool=remaining();if(!pool.length){game.choices=[];persist();draw();status('未指名の応援歌が足りません。条件を変えてやり直してください。');return}const prior=new Set(game.choices.map(identity)),fresh=pool.filter(s=>!prior.has(identity(s)));const count=game.choiceCount||4;game.choices=shuffle(fresh.length>=count?fresh:pool).slice(0,count);persist();draw()}
function choose(i){selected=i;[...$('draftChoices').children].forEach((el,n)=>el.classList.toggle('selected',n===i));$('draftAssign').hidden=false;$('draftOrder').replaceChildren(...slots.flatMap((label,index)=>game.roster[index]?[]:[new Option(label,String(index))]));updatePositions()}
function updatePositions(){const used=new Set(game.roster.filter(Boolean).map(s=>s.position));$('draftPosition').replaceChildren(...positions.filter(p=>!used.has(p)).map(p=>new Option(p.slice(0,1),p)))}
async function hear(song){stop();const t=token;status(song.name+'：音源を検索中…');try{const result=await audio.play(song,{onStop:()=>{},onEnded:()=>{if(t===token)status('聴き終わりました。')}});if(t===token&&result)status('再生中：'+song.name)}catch(e){if(t===token)status('音源を読み込めませんでした。もう一度お試しください。')}}
async function load(){
 try{
  const response=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error();
  const data=await response.json();
  if(!Array.isArray(data.songs))throw Error();
  catalog=data.songs.filter(song=>!['1','true'].includes(String(song.is_generic??song.isGeneric??'').trim().toLowerCase())&&!flags.pitcher(song))
   .map(song=>({name:String(song.player_name||song.name||''),team:String(song.team||''),productionNumber:String(song.production_number||song.productionNumber||1),
    lyrics:String(song.lyrics||''),jerseyNumber:String(song.uniform_number??song.uniformNumber??''),isActive:flags.inUse(song)})).filter(song=>song.name);
  $('draftTeam').replaceChildren(new Option('すべての球団',''),...[...new Set(catalog.map(song=>song.team).filter(Boolean))].sort().map(team=>new Option(team,team)));
  $('draftStart').disabled=false;
  $('draftRetry').hidden=true;
  if(game){
   const songKey=song=>JSON.stringify([identity(song),String(song.productionNumber)]);
   const allowed=new Map(catalog.filter(song=>eligible(song,game)).map(song=>[songKey(song),song]));
   const revalidate=song=>song?allowed.get(songKey(song)):null;
   game.roster=game.roster.map(song=>{
    const registered=revalidate(song);
    return registered&&positions.includes(song.position)?{...registered,position:song.position}:null;
   });
   game.choices=game.choices.map(revalidate).filter(Boolean);
   if(complete()||game.choices.length===(game.choiceCount||4)){persist();draw()}
   else deal();
  }else status('球団と対象を選んでドラフトを始めよう。');
 }catch{
  $('draftStart').disabled=true;
  if(game)$('draftSetup').hidden=false;
  $('draftRetry').hidden=false;
  status('応援歌を読み込めませんでした。再試行してください。');
 }
}
$('draftSoloMode').onclick=()=>{document.body.dataset.soloMode='1';draw()};$('draftBackModes').onclick=()=>{delete document.body.dataset.soloMode;draw()};$('draftRetry').onclick=load;$('draftOrder').onchange=updatePositions;$('draftStart').onclick=()=>{const team=$('draftTeam').value,activeOnly=$('draftActive').value==='active',people=new Set(catalog.filter(song=>eligible(song,{team,activeOnly})).map(identity));const choiceCount=Number($('draftChoiceCount').value);if(people.size<slots.length-1+choiceCount){status('候補が足りません。球団・対象を広げるか、選択肢の数を減らしてください。');return}game={version:1,team,activeOnly,choiceCount,roster:Array(slots.length).fill(null),skips:0,choices:[],title:'応援歌ドラフト スタメン'};deal()};$('draftConfirm').onclick=()=>{if(selected<0||!game)return;const index=Number($('draftOrder').value);if(!Number.isInteger(index)||index<0||index>=slots.length||game.roster[index]||!game.choices[selected])return;const position=$('draftPosition').value;if(!positions.includes(position))return;stop();game.roster[index]={...game.choices[selected],position};game.choices=[];if(complete()){persist();draw()}else deal()};$('draftSkip').onclick=()=>{if(!game||game.skips>=3)return;stop();game.skips++;deal()};$('draftStop').onclick=()=>{stop();status('停止しました。')};$('draftRestart').onclick=()=>{if(game&&!complete()&&!confirm('編集中のドラフトをやり直しますか？'))return;stop();game=null;persist();draw();status('新しいドラフトを始められます。')};$('draftTitle').oninput=()=>{game.title=$('draftTitle').value;persist()};
$('draftSave').onclick=()=>{if(!complete())return;try{persist();const saved=JSON.parse(localStorage.getItem('ouenkaBaseSavedLineupsV1')||'[]');if(!Array.isArray(saved))throw Error();const entry={id:'draft-'+Date.now(),title:game.title||'応援歌ドラフト スタメン',rows:game.roster,pitchers:[],savedAt:new Date().toISOString(),year:'',team:game.team};saved.push(entry);localStorage.setItem('ouenkaBaseSavedLineupsV1',JSON.stringify(saved));status('スタメンを保存しました。1-9作成の「保存済みを読み込み」から開けます。')}catch{status('保存できませんでした。JSON保存で書き出せます。')}};$('draftExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(game,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='応援歌ドラフト.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};window.addEventListener('pagehide',stop);load().then(()=>{if(!game)draw()});
})();
