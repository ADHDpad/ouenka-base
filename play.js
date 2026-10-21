(()=>{'use strict';const $=id=>document.getElementById(id),audio=window.OuenkaPlayAudio;
const norm=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));const nameKey=value=>norm(value).replace(/[\s・･]/g,'');
const active=s=>['現在使用','現役','1','true'].includes(String(s.player_type??s.active??'').trim());
function normalized(s){return {...s,name:String(s.player_name||s.name||''),productionNumber:String(s.production_number||s.productionNumber||1),team:String(s.team||''),reading:String(s.reading||''),lyrics:String(s.lyrics||''),isActive:active(s)}}
function shuffled(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
function filtered(teamId,activeId,source=catalog){const team=$(teamId).value,kind=$(activeId).value;return source.filter(s=>(!team||s.team===team)&&(kind==='all'||(kind==='active'?s.isActive:!s.isActive)))}
function node(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el}
let catalog=[],loading=false,loadToken=0,mode='',quiz=null,quizToken=0;const modes={quiz:['応援歌クイズ','quizPanel'],lyricsquiz:['歌詞クイズ','quizPanel'],compare:['新旧応援歌の聴き比べ','comparePanel']};
function syncQuizControls(){
 const lyrics=$('quizKind').value==='lyrics',bars=$('quizUnit').value==='bars';
 $('quizLead').textContent=lyrics?'歌詞を読んで、どの選手の応援歌か当てよう。':'応援歌を聴いて、選手を当てよう。';
 $('quizAudioSettings').hidden=lyrics;$('quizLyricsSettings').hidden=!lyrics;
 $('quizSecondsField').hidden=bars;$('quizBarsField').hidden=!bars;$('quizBarsHint').hidden=!bars;$('quizCustomOption').hidden=!bars;
 if(!bars&&$('quizExcerpt').value==='custom')$('quizExcerpt').value='start';
 $('quizStartBarField').hidden=!bars||$('quizExcerpt').value!=='custom';
}
function showMode(value){
 const next=modes[value]?value:'quiz';if(mode===next)return;quizToken++;audio.stop();mode=next;document.body.dataset.mode=mode;
 for(const [, [title,panel]] of Object.entries(modes))$(panel).hidden=panel!==modes[mode][1];
 $('pageTitle').textContent=modes[mode][0];document.querySelectorAll('[data-mode]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-current',b.dataset.mode===mode?'page':'false')});$('audioStatus').textContent='';
 if(mode==='compare')renderCompareCandidates();
 if(mode==='quiz'||mode==='lyricsquiz'){
  const kind=mode==='lyricsquiz'?'lyrics':'audio';$('quizKind').value=kind;syncQuizControls();
  if(quiz&&quiz.kind!==kind){quiz=null;$('quizGame').hidden=true;$('quizResult').hidden=true}
  if(quiz&&!quiz.answered&&kind==='audio'){$('quizReplay').disabled=false;$('quizListenStatus').textContent='「もう一度聴く」で再開できます。'}
  showBest();
 }
 history.replaceState(null,'','#'+mode);
}
document.querySelectorAll('button[data-mode]').forEach(b=>b.onclick=()=>showMode(b.dataset.mode));window.addEventListener('hashchange',()=>showMode(location.hash.slice(1)));
async function loadCatalog(){if(loading)return;loading=true;const token=++loadToken;$('catalogStatus').textContent='登録された応援歌を読み込んでいます…';$('reloadCatalog').hidden=true;
 try{const response=await fetch('https://ouenka-base-data.ninzin5600.workers.dev/songs',{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(data.ok===false||!Array.isArray(data.songs))throw Error('登録データの形式を確認できません。');if(token!==loadToken)return;catalog=data.songs.map(normalized).filter(s=>s.name);const teams=[...new Set(catalog.map(s=>s.team).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));for(const id of ['quizTeam']){const select=$(id),previous=select.value;select.replaceChildren(new Option('すべての球団',''),...teams.map(t=>new Option(t,t)));if(teams.includes(previous))select.value=previous}const urlParams=new URLSearchParams(location.search);if(urlParams.has('team'))for(const id of ['quizTeam'])if(teams.includes(urlParams.get('team')))$(id).value=urlParams.get('team');if(urlParams.get('name'))$('compareQuery').value=urlParams.get('name');$('catalogStatus').textContent=catalog.length+'曲の応援歌から楽しめます。';renderCompareCandidates();showBest();
 }catch(error){$('catalogStatus').textContent='登録データを読み込めませんでした。通信を確認して再度お試しください。';$('reloadCatalog').hidden=false}finally{loading=false}}
$('reloadCatalog').onclick=loadCatalog;
function bestKey(){
 const base=[$('quizTeam').value,$('quizActive').value];
 if($('quizKind').value==='lyrics')return 'ouenka_lyrics_quiz_best_v1:'+base.concat($('quizLyricLines').value).join('|');
 if($('quizUnit').value==='bars')return 'ouenka_quiz_bars_best_v1:'+base.concat($('quizBars').value,$('quizExcerpt').value,$('quizExcerpt').value==='custom'?$('quizStartBar').value:'').join('|');
 return 'ouenka_quiz_best_v1:'+base.concat($('quizSeconds').value,$('quizExcerpt').value).join('|');
}
function showBest(){try{const best=JSON.parse(localStorage.getItem(bestKey())||'null');$('quizBest').textContent=best?'この条件の最高記録：'+best.score+' / '+best.total+'問正解':''}catch{$('quizBest').textContent=''}}
for(const id of ['quizTeam','quizActive','quizSeconds','quizExcerpt','quizUnit','quizBars','quizStartBar','quizLyricLines'])$(id).addEventListener('change',()=>{syncQuizControls();showBest()});
$('quizKind').addEventListener('change',()=>showMode($('quizKind').value==='lyrics'?'lyricsquiz':'quiz'));
$('quizStart').onclick=()=>{
 const kind=$('quizKind').value;
 if(kind==='audio'&&$('quizUnit').value==='bars'&&$('quizExcerpt').value==='custom'&&(!Number.isInteger(Number($('quizStartBar').value))||Number($('quizStartBar').value)<1||Number($('quizStartBar').value)>128)){$('quizBest').textContent='開始小節を1〜128の整数で入力してください。';return}
 audio.stop();quizToken++;
 const eligible=filtered('quizTeam','quizActive').filter(song=>kind!=='lyrics'||song.lyrics.trim()),unique=new Map();
 for(const song of eligible){const id=nameKey(song.name);if(!unique.has(id))unique.set(id,[]);unique.get(id).push(song)}const groups=[...unique.values()];
 if(groups.length<2){$('quizBest').textContent=kind==='lyrics'?'出題には歌詞が登録された応援歌が2人分以上必要です。対象を広げてください。':'出題には異なる選手の応援歌が2人分以上必要です。対象を広げてください。';return}
 let questions=[];
 for(const versions of shuffled(groups)){
  for(const song of shuffled(versions)){
   if(kind==='audio'){questions.push(song);break}
   const problem=window.OuenkaQuizRules.lyricsQuestion(song,eligible,$('quizLyricLines').value);
   if(problem){questions.push({...song,quizPrompt:problem.prompt,quizAlternatives:problem.alternatives});break}
  }
  if(questions.length>=10)break;
 }
 if(!questions.length){$('quizBest').textContent='この条件では選手を区別できる歌詞がありません。表示する歌詞を「全文」にするか、対象を広げてください。';return}
 quiz={questions,kind,pool:groups.map(v=>v[0]),at:0,score:0,answered:false,unit:$('quizUnit').value,bars:Number($('quizBars').value),seconds:Number($('quizSeconds').value),excerpt:$('quizExcerpt').value,startBar:Number($('quizStartBar').value),random:$('quizExcerpt').value==='random',bestKey:bestKey(),start:null};
 $('quizGame').hidden=false;$('quizResult').hidden=true;nextQuestion();
};
async function hearQuestion(){
 if(!quiz||quiz.answered||quiz.kind!=='audio')return;const token=++quizToken;$('quizReplay').disabled=true;$('quizListenStatus').textContent='応援歌を読み込んでいます…';
 try{
  const result=await audio.play(quiz.questions[quiz.at],{mask:true,seconds:quiz.seconds,unit:quiz.unit,bars:quiz.bars,excerpt:quiz.excerpt,startBar:quiz.startBar,random:quiz.random,start:quiz.start});
  if(token!==quizToken||!result)return;quiz.start=result.start;
  $('quizListenStatus').textContent=quiz.unit==='bars'?(result.bars+'小節（第'+result.startBar+'〜'+(result.startBar+result.bars-1)+'小節）。どの選手でしょう？'):(Math.round(result.duration*10)/10+'秒の応援歌。どの選手でしょう？');
 }catch(error){if(token===quizToken)$('quizListenStatus').textContent=/開始小節|1小節分/.test(error.message)?error.message:'音源を読み込めませんでした。もう一度聴くか、この問題をスキップしてください。'}
 finally{if(token===quizToken)$('quizReplay').disabled=false}
}
function nextQuestion(){
 audio.stop();quizToken++;if(quiz.at>=quiz.questions.length){finishQuiz();return}
 quiz.answered=false;quiz.start=null;$('quizAnswer').textContent='';$('quizNext').hidden=true;$('quizAnswerPlay').hidden=true;$('quizReplay').disabled=false;$('quizSkip').disabled=false;$('quizListenStatus').textContent='';$('audioStatus').textContent='';
 $('quizProgress').textContent='第 '+(quiz.at+1)+' 問 / '+quiz.questions.length;$('quizScore').textContent=quiz.score+'問正解';
 const correct=quiz.questions[quiz.at],wrong=quiz.kind==='lyrics'?correct.quizAlternatives:shuffled(quiz.pool.filter(s=>nameKey(s.name)!==nameKey(correct.name))).slice(0,3),options=shuffled([correct,...wrong]);
 $('quizAudioControls').hidden=quiz.kind==='lyrics';$('quizLyricPrompt').hidden=quiz.kind!=='lyrics';$('quizLyricPrompt').textContent=quiz.kind==='lyrics'?correct.quizPrompt:'';
 $('quizChoices').replaceChildren();for(const candidate of options){const button=node('button',candidate.name);button.onclick=()=>answer(candidate,button);button.dataset.answer=nameKey(candidate.name);$('quizChoices').append(button)}
 if(quiz.kind==='audio')hearQuestion();
}
function answer(song,button){
 if(!quiz||quiz.answered)return;const correct=quiz.questions[quiz.at];quiz.answered=true;quizToken++;audio.stop();const good=song&&nameKey(song.name)===nameKey(correct.name);if(good)quiz.score++;
 for(const option of $('quizChoices').querySelectorAll('button')){option.disabled=true;if(option.dataset.answer===nameKey(correct.name))option.classList.add('correct')}
 if(button&&!good)button.classList.add('wrong');$('quizAnswer').textContent=(song?(good?'正解！':'惜しい！'):'スキップしました。')+'\n正解：'+correct.name+' ／ '+correct.team+' ／ 制作番号 '+correct.productionNumber+'\n'+correct.lyrics;
 $('quizListenStatus').textContent='';$('quizScore').textContent=quiz.score+'問正解';$('quizNext').textContent=quiz.at+1===quiz.questions.length?'結果を見る':'次の問題';$('quizNext').hidden=false;$('quizReplay').disabled=true;$('quizSkip').disabled=true;$('quizAnswerPlay').hidden=false;
}
function finishQuiz(){$('quizGame').hidden=true;$('quizResult').hidden=false;$('quizResult').textContent=quiz.questions.length+'問中 '+quiz.score+'問正解！ '+(quiz.score===quiz.questions.length?'全問正解、お見事！':'また挑戦してみよう。');try{const old=JSON.parse(localStorage.getItem(quiz.bestKey)||'null');if(!old||quiz.score/quiz.questions.length>old.score/old.total)localStorage.setItem(quiz.bestKey,JSON.stringify({score:quiz.score,total:quiz.questions.length}));showBest()}catch{}}
$('quizReplay').onclick=hearQuestion;$('quizStop').onclick=()=>{quizToken++;audio.stop();$('quizReplay').disabled=!!quiz?.answered;$('quizListenStatus').textContent='停止しました。'};$('quizSkip').onclick=()=>answer(null);$('quizNext').onclick=()=>{if(quiz?.answered){quiz.at++;nextQuestion()}};
$('quizAnswerPlay').onclick=()=>{if(quiz?.answered)playSong(quiz.questions[quiz.at])};
async function playSong(song){$('audioStatus').textContent=song.name+' の音源を読み込み中…';try{const result=await audio.play(song);if(result)$('audioStatus').textContent='再生中：'+song.name+' ／ '+song.team+' ／ 制作番号 '+song.productionNumber}catch(error){$('audioStatus').textContent=error.message}}
function songCard(song){const card=node('article',undefined,'song'),title=node('h3',song.name),meta=node('small',song.team+' ／ 制作番号 '+song.productionNumber+' ／ '+(song.isActive?'現役':'現在未使用')),lyrics=node('p',song.lyrics||'歌詞の登録がありません。'),toolbar=node('div',undefined,'toolbar'),play=node('button','▶ 再生'),compare=node('button','別バージョンを探す','secondary');play.onclick=()=>playSong(song);compare.onclick=()=>{$('compareQuery').value=song.name;showMode('compare');showVersions(nameKey(song.name))};toolbar.append(play,window.OuenkaFavorites.button(song),compare);card.append(title,meta,lyrics,toolbar);return card}
function renderCompareCandidates(){const query=nameKey($('compareQuery').value),host=$('compareCandidates');host.replaceChildren();$('compareVersions').replaceChildren();if(!query){$('compareStatus').textContent='同じ選手の応援歌を制作番号・球団ごとに並べて比較できます。';return}const groups=new Map();for(const song of catalog)if(nameKey(song.name).includes(query)||nameKey(song.reading).includes(query)){const key=nameKey(song.name);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(song)}for(const [key,versions] of [...groups].slice(0,12)){const button=node('button',versions[0].name+'（'+versions.length+'曲）','secondary');button.onclick=()=>showVersions(key);host.append(button)}$('compareStatus').textContent=groups.size?'選手を選んでください。':'一致する選手が見つかりません。';if(groups.size===1)showVersions([...groups.keys()][0])}
function showVersions(key){const versions=catalog.filter(s=>nameKey(s.name)===key).sort((a,b)=>a.team.localeCompare(b.team,'ja')||Number(a.productionNumber)-Number(b.productionNumber)),host=$('compareVersions');host.replaceChildren();$('compareStatus').textContent=versions.length+'曲。制作番号は表示上の番号です。新旧の年代を示すものではありません。';versions.forEach((song,i)=>{const card=songCard(song);card.querySelector('.toolbar .secondary')?.remove();const badge=node('span',String.fromCharCode(65+i%26)+' ／ '+(song.isActive?'現在使用':'現在未使用'),'badge');card.prepend(badge);const button=card.querySelector('.toolbar button');button.textContent='▶ '+String.fromCharCode(65+i%26)+'を再生';host.append(card)});if(versions.length===1)host.append(node('p','この選手は現在1曲のみ登録されています。別バージョンの登録後に比較できます。','muted'))}
$('compareQuery').addEventListener('input',renderCompareCandidates);
if(location.hash==='#lyrics'){location.replace('index.html#homeLyricsSearch')}else{showMode(location.hash.slice(1));loadCatalog()}
})();
