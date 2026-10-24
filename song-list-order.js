(()=>{'use strict';
const norm=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s　]/g,'');
const kana=(a,b)=>norm(a.reading||a.furigana||a.kana||a.name).localeCompare(norm(b.reading||b.furigana||b.kana||b.name),'ja')||String(a.name).localeCompare(String(b.name),'ja')||Number(a.productionNumber)-Number(b.productionNumber);
function compare(mode){const teams=window.OUENKA_TEAM_ORDER.get();return(a,b)=>{if(mode==='team'){const ai=teams.indexOf(a.team),bi=teams.indexOf(b.team);const result=(ai<0?999:ai)-(bi<0?999:bi)||String(a.team||'').localeCompare(String(b.team||''),'ja');if(result)return result}return kana(a,b)}}
function controls(parent,onChange){let mode='kana';const group=document.createElement('div');group.className='song-sort-controls';group.setAttribute('aria-label','並び順');const buttons=[];for(const [value,label]of [['kana','フリガナ順'],['team','球団順']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-pressed',String(mode===value));button.onclick=()=>{mode=value;buttons.forEach(([v,b])=>b.setAttribute('aria-pressed',String(v===mode)));onChange()};buttons.push([value,button]);group.append(button)}parent.prepend(group);return()=>compare(mode)}
window.OuenkaSongListOrder={compare,controls};
})();
