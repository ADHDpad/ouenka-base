(()=>{'use strict';
 const $=id=>document.getElementById(id),audio=window.OuenkaPlayAudio,storage='ouenka_blind_ranking_v1',key=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s・･]/g,''),shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 let catalog=null,loading=null,game=null,audioToken=0,playingRank=-1,downloadUrl='',starting=false;
 const status=text=>{$('rankingStatus').textContent=text};
 function persist(){try{if(game)localStorage.setItem(storage,JSON.stringify(game));else localStorage.removeItem(storage)}catch{status('この端末に途中経過を保存できません。画面を開いたまま続けてください。')}}
 function valid(saved){if(!saved||!Array.isArray(saved.songs)||saved.songs.length!==10||!Array.isArray(saved.slots)||saved.slots.length!==10)return false;if(!saved.songs.every(s=>s&&typeof s.name==='string'&&s.name&&typeof s.team==='string'&&typeof s.productionNumber==='string')||new Set(saved.songs.map(s=>key(s.name))).size!==10)return false;const filled=saved.slots.filter(i=>i!==null);return filled.every(i=>Number.isInteger(i)&&i>=0&&i<10)&&new Set(filled).size===filled.length&&filled.every((_,i)=>filled.includes(i))}
 try{const saved=JSON.parse(localStorage.getItem(storage)||'null');if(valid(saved))game=saved}catch{}
 const step=()=>game.slots.filter(i=>i!==null).length;
 function stop(){audioToken++;audio.stop();playingRank=-1;$('rankingAudioStatus').textContent='';markPlaying()}
 function markPlaying(){Array.from($('rankingBoard').children).forEach((row,i)=>row.classList.toggle('is-playing',i===playingRank))}
 function lyricsText(lyrics){
  return String(lyrics||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/\\n/g,' ').replace(/\s+/g,' ').trim()||'歌詞未登録';
 }
 function renderQuestionColor(team){
  const colors=window.OuenkaTeamColors;
  const [main]=colors.get(team);
  const card=$('rankingNow');
  card.style.setProperty('--ranking-question-bg',main);
  card.style.setProperty('--ranking-question-ink',window.OuenkaSiteTheme.ink(main));
 }
 function render(){const done=game&&step()===10;$('rankingSetup').hidden=!!game;$('rankingGame').hidden=!game;if(!game)return;const at=step();$('rankingProgress').textContent=done?'RANKING COMPLETE':(at+1)+' / 10 曲目';$('rankingPhase').textContent=done?'完成！':(10-at)+'枠 あとから変更できません';$('rankingNow').hidden=done;$('rankingResult').hidden=!done;$('rankingPlaceHint').hidden=done;$('rankingBoardLabel').textContent=done?'あなたのランキング':'この曲を何位にする？';
  if(!done){const song=game.songs[at];renderQuestionColor(song.team);$('rankingSongName').textContent=song.name;$('rankingSongLyrics').textContent=lyricsText(song.lyrics);$('rankingSongMeta').textContent=song.team}else $('rankingTitle').value=game.title||'私の応援歌ランキング';
  $('rankingBoard').replaceChildren(...game.slots.map((index,rank)=>{const row=document.createElement('li'),number=document.createElement('span');number.className='rank-number';number.textContent=String(rank+1);row.append(number);if(index===null){const button=document.createElement('button');button.className='rank-place';button.textContent=(rank+1)+'位に入れる';button.onclick=()=>place(rank);row.append(button)}else{const song=game.songs[index],info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');info.className='rank-info';name.textContent=song.name;meta.textContent=done?lyricsText(song.lyrics):song.team;info.append(name,meta);row.append(info);if(done){const play=document.createElement('button');play.className='rank-play';play.textContent='▶';play.setAttribute('aria-label',(rank+1)+'位 '+song.name+' を再生');play.onclick=()=>playRank(rank,false);row.append(play)}}return row}));markPlaying();
 }
 async function loadCatalog(){if(catalog)return catalog;if(loading)return loading;loading=(async()=>{const r=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('応援歌の一覧を読み込めませんでした。');const data=await r.json();if(!Array.isArray(data.songs))throw Error('登録データを確認できませんでした。');catalog=data.songs.map(s=>({name:String(s.player_name||s.name||''),team:String(s.team||''),productionNumber:String(s.production_number||s.productionNumber||1),lyrics:String(s.lyrics||''),tempo:Number(s.tempo)===140?140:170,isActive:['現在使用','現役','1','true'].includes(String(s.player_type??s.active??'').trim())})).filter(s=>s.name);for(const team of [...new Set(catalog.map(s=>s.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')))$('rankingTeam').append(new Option(team,team));return catalog})().finally(()=>{loading=null});return loading}
 async function start(){if(starting)return;starting=true;$('rankingStart').disabled=true;status('ランダムに10曲を選んでいます…');try{await loadCatalog();const groups=new Map();for(const song of catalog){if($('rankingTeam').value&&song.team!==$('rankingTeam').value)continue;const active=$('rankingActive').value;if(active!=='all'&&(active==='active'?!song.isActive:song.isActive))continue;const id=key(song.name);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(song)}if(groups.size<10)throw Error('この条件は'+groups.size+'人分です。10人以上になるように球団・対象を広げてください。');stop();game={version:1,songs:shuffle([...groups.values()]).slice(0,10).map(versions=>shuffle(versions)[0]),slots:Array(10).fill(null),title:'私の応援歌ランキング'};persist();render();status('再生ボタンを押すと、この曲を聴けます。')}catch(error){status(error.message)}finally{starting=false;$('rankingStart').disabled=false}}
 function place(rank){if(!game||step()>=10||game.slots[rank]!==null)return;stop();game.slots[rank]=step();persist();render();if(step()<10)status('再生ボタンを押すと、次の曲を聴けます。');else status('ランキング完成！画像の保存と、1位からの再生ができます。')}
 async function hearCurrent(){if(!game||step()>=10)return;stop();const token=audioToken,song=game.songs[step()];$('rankingAudioStatus').textContent='音源を読み込んでいます…';try{const result=await audio.play(song,{onStop:stop,onEnded:()=>{if(token===audioToken)$('rankingAudioStatus').textContent='聴き終わりました。空いている順位を選んでください。'}});if(token===audioToken&&result)$('rankingAudioStatus').textContent='再生中。空いている順位を選んでください。'}catch{if(token===audioToken)$('rankingAudioStatus').textContent='音源を読み込めませんでした。「この曲を聴く」で再試行できます。'}}
 async function playRank(rank,all){if(!game||step()!==10)return;stop();const token=audioToken;if(all){const queue=game.slots.slice(rank).map(i=>game.songs[i]);try{await audio.playMedley(queue,{title:'応援歌 即興ランキング',onStop:stop,onSong:(song,i)=>{if(token!==audioToken)return;playingRank=rank+i;markPlaying();status('再生中：'+(playingRank+1)+'位 '+song.name)},onEnded:()=>{if(token!==audioToken)return;playingRank=-1;markPlaying();status('ランキングの再生が終わりました。')}})}catch(error){if(token===audioToken){playingRank=-1;markPlaying();status(error.message||'ランキングの音源を読み込めませんでした。')}}return}async function next(at){if(token!==audioToken||at>=10){if(token===audioToken){playingRank=-1;markPlaying();status('ランキングの再生が終わりました。')}return}playingRank=at;markPlaying();const song=game.songs[game.slots[at]];status((at+1)+'位：'+song.name+' を読み込み中…');try{const result=await audio.play(song,{onStop:stop,onEnded:()=>{if(token!==audioToken)return;if(all)next(at+1);else{playingRank=-1;markPlaying();status('再生が終わりました。')}}});if(token===audioToken&&result)status('再生中：'+(at+1)+'位 '+song.name)}catch{if(token===audioToken){playingRank=-1;markPlaying();status((at+1)+'位 '+song.name+' の音源を読み込めませんでした。▶で再試行できます。')}}}await next(rank)}
 function fit(ctx,text,maxWidth,size,min=22){ctx.font='800 '+size+'px system-ui, sans-serif';while(size>min&&ctx.measureText(text).width>maxWidth){size--;ctx.font='800 '+size+'px system-ui, sans-serif'}if(ctx.measureText(text).width>maxWidth){while(text.length&&ctx.measureText(text+'…').width>maxWidth)text=text.slice(0,-1);text+='…'}return text}
 function paintImageTheme(ctx,width,height){
  const themes=window.OuenkaSiteTheme;
  const theme=themes.read()||themes.defaults;
  const useGradient=theme.gradient&&/^#[0-9a-f]{6}$/i.test(theme.end||'');
  let fill=theme.main;
  if(useGradient){
   const gradientCSS=themes.gradientCSS(theme);
   const angle=Number(gradientCSS.match(/\((\d+)deg/)[1])*Math.PI/180;
   const dx=Math.sin(angle),dy=-Math.cos(angle);
   const distance=(Math.abs(dx)*width+Math.abs(dy)*height)/2;
   const gradient=ctx.createLinearGradient(width/2-dx*distance,height/2-dy*distance,width/2+dx*distance,height/2+dy*distance);
   for(const [,color,position] of gradientCSS.matchAll(/(#[0-9a-f]{6}) ([\d.]+)%/gi)){
    gradient.addColorStop(Number(position)/100,color);
   }
   fill=gradient;
  }
  ctx.fillStyle=fill;
  ctx.fillRect(0,0,width,height);
  return useGradient?themes.gradientInk(theme):themes.ink(theme.main);
 }
 async function ensureLyrics(){
  const savedGame=game;
  if(!savedGame?.songs.some(song=>typeof song.lyrics!=='string'))return false;
  await loadCatalog();
  if(game!==savedGame)return false;
  for(const song of savedGame.songs){
   if(typeof song.lyrics==='string')continue;
   const match=catalog.find(s=>key(s.name)===key(song.name)&&s.team===song.team&&s.productionNumber===song.productionNumber);
   song.lyrics=match?.lyrics||'';
  }
  persist();
  return true;
 }
 async function saveImage(){
  if(!game||step()!==10)return;
  const savedGame=game,button=$('rankingSaveImage');
  button.disabled=true;
  try{
   if(await ensureLyrics())render();
   await document.fonts?.ready;
   if(game!==savedGame)return;
   const canvas=document.createElement('canvas');
   canvas.width=2560;
   canvas.height=1920;
   const ctx=canvas.getContext('2d');
   const ink=paintImageTheme(ctx,canvas.width,canvas.height);
   const left=64,cardWidth=canvas.width-2*left,textX=left+150,textWidth=cardWidth-200;
   ctx.fillStyle=ink;
   ctx.font='700 29px system-ui, sans-serif';
   ctx.fillText('OUENKA BASE  /  BLIND RANKING',left,76);
   ctx.fillText(fit(ctx,savedGame.title||'私の応援歌ランキング',cardWidth,70,30),left,164);
   for(const [rank,index] of savedGame.slots.entries()){
    const song=savedGame.songs[index],y=214+rank*156;
    ctx.fillStyle=rank===0?'#fff4d2':'#ffffff';
    ctx.fillRect(left,y,cardWidth,138);
    ctx.fillStyle=window.OuenkaTeamColors.get(song.team)[0];
    ctx.fillRect(left,y,12,138);
    ctx.fillStyle=rank===0?'#a2740a':'#54758d';
    ctx.font='900 55px system-ui, sans-serif';
    ctx.fillText(String(rank+1).padStart(2,'0'),left+34,y+88);
    ctx.fillStyle='#113650';
    ctx.fillText(fit(ctx,song.name,textWidth,49,30),textX,y+55);
    ctx.fillStyle='#53738a';
    ctx.fillText(fit(ctx,lyricsText(song.lyrics),textWidth,36,30),textX,y+105);
   }
   ctx.fillStyle=ink;
   ctx.font='700 28px system-ui, sans-serif';
   ctx.fillText('応援歌BASE',left,1850);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('画像を作成できませんでした。')),'image/png'));const file=new File([blob],'応援歌_即興ランキング.png',{type:'image/png'});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file]});status('共有画面から画像を保存できます。');return}catch(error){if(error.name==='AbortError')return}}
  if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=URL.createObjectURL(blob);const link=document.createElement('a');link.href=downloadUrl;link.download=file.name;link.textContent='ランキング画像をダウンロード';$('rankingDownload').replaceChildren(link);link.click();status('画像を作成しました。表示されたリンクからも保存できます。');
 }catch(error){status(error.message||'画像を保存できませんでした。')}finally{button.disabled=false}}
 $('rankingStart').onclick=start;$('rankingReplay').onclick=hearCurrent;$('rankingStop').onclick=stop;$('rankingNew').onclick=()=>{if(!game||step()!==10)return;stop();game=null;persist();if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=''}$('rankingDownload').replaceChildren();render();status('球団・対象を選んで、新しいランキングを作れます。');$('rankingSetup').scrollIntoView?.({behavior:'smooth',block:'start'})};$('rankingTitle').oninput=()=>{if(game){game.title=$('rankingTitle').value.slice(0,60);persist()}};$('rankingSaveImage').onclick=saveImage;$('rankingPlayAll').onclick=()=>playRank(0,true);$('rankingStopAll').onclick=()=>{stop();status('停止しました。各順位の▶から再生できます。')};window.addEventListener('pagehide',stop);render();loadCatalog().then(async()=>{if(await ensureLyrics())render()}).catch(error=>status(error.message));
})();
