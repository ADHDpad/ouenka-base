(()=>{'use strict';
const normalized=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)).replace(/[\s　・･]/g,'');
function mount({players,onSubmit,active}){
 const input=document.getElementById('quizAnswerInput'),list=document.getElementById('quizAnswerSuggestions'),button=document.getElementById('quizAnswerSubmit'),status=document.getElementById('quizAnswerInputStatus');let candidates=[],selected=null,index=-1;
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');index=-1}
 function grouped(){const result=new Map();for(const song of players()){const key=normalized(song.name);if(!key)continue;if(!result.has(key))result.set(key,{song,readings:new Set(),teams:new Set()});const group=result.get(key);if(song.reading)group.readings.add(song.reading);if(song.team)group.teams.add(song.team)}return [...result.values()]}
 function choose(candidate){selected=candidate.song;input.value=selected.name;button.disabled=false;status.textContent='選択中：'+selected.name;close();input.focus()}
 function render(){
  selected=null;status.textContent='';button.disabled=!input.value.trim()||!active();list.replaceChildren();index=-1;const term=normalized(input.value);
  if(!term||!active()){close();return}
  candidates=grouped().filter(group=>normalized(group.song.name).includes(term)||[...group.readings].some(r=>normalized(r).includes(term))).sort((a,b)=>Number(normalized(b.song.name).startsWith(term))-Number(normalized(a.song.name).startsWith(term))||a.song.name.localeCompare(b.song.name,'ja')).slice(0,10);
  if(!candidates.length){status.textContent='一致する登録選手がいません。名前やふりがなを変えて検索してください。';close();return}
  candidates.forEach((candidate,i)=>{const option=document.createElement('button');option.type='button';option.className='quiz-answer-option';option.id='quizAnswerOption'+i;option.tabIndex=-1;option.setAttribute('role','option');option.setAttribute('aria-selected','false');const title=document.createElement('strong');title.textContent=candidate.song.name;const detail=document.createElement('small');detail.textContent=[[...candidate.readings].join(' / '),[...candidate.teams].join(' / ')].filter(Boolean).join(' ／ ');option.append(title,detail);option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>choose(candidate));list.append(option)});
  list.hidden=false;input.setAttribute('aria-expanded','true');
 }
 function submit(){if(!active())return;const key=normalized(input.value);const song=selected&&normalized(selected.name)===key?selected:players().find(s=>normalized(s.name)===key);if(!song){status.textContent='登録された選手を検索候補から選んでください。';return}close();onSubmit(song)}
 input.addEventListener('input',render);input.addEventListener('focus',()=>{if(!selected&&input.value.trim())render()});
 input.addEventListener('keydown',event=>{
  if(event.isComposing)return;
  if(event.key==='Escape'){close();return}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   if(list.hidden)render();if(!candidates.length||list.hidden)return;event.preventDefault();index=index<0?(event.key==='ArrowDown'?0:candidates.length-1):(index+(event.key==='ArrowDown'?1:-1)+candidates.length)%candidates.length;
   [...list.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));input.setAttribute('aria-activedescendant','quizAnswerOption'+index);list.children[index]?.scrollIntoView?.({block:'nearest'});
  }else if(event.key==='Enter'){event.preventDefault();if(!list.hidden&&index>=0)choose(candidates[index]);else submit()}
 });button.addEventListener('click',submit);
 document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('#quizAnswerInputPanel'))close()});
 return {reset(){input.value='';selected=null;candidates=[];list.replaceChildren();status.textContent='';input.disabled=false;button.disabled=true;close()},lock(){input.disabled=true;button.disabled=true;close()}};
}
window.OuenkaQuizAnswerSearch={mount};
})();
