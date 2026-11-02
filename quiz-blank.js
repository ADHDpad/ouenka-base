(()=>{'use strict';
const rules=window.OuenkaQuizRules;
const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'word'}):null;
function words(text){
 if(segmenter)return [...segmenter.segment(text)].filter(p=>p.isWordLike&&/^[\p{L}ー]{2,12}$/u.test(p.segment)&&!/[〇○]/.test(p.segment)).map(p=>({word:p.segment,index:p.index}));
 return [...text.matchAll(/[\p{L}ー]{2,12}/gu)].filter(p=>!/[〇○]/.test(p[0])).map(p=>({word:p[0],index:p.index}));
}
function shuffle(items){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
function lines(song){return rules.mainLyrics(song)}
function pool(songs){const entries=songs.flatMap(lines);return {lines:new Set(entries.map(rules.key)),words:[...new Set(entries.flatMap(line=>words(line).map(p=>p.word)))]}}
function question(song,source,count=4){
 const full=String(song.lyrics||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/\\n/g,'\n');
 for(const line of shuffle(lines(song))){
  for(const part of shuffle(words(line))){
   const before=line.slice(0,part.index),after=line.slice(part.index+part.word.length);
   // Keep enough context and avoid leaving the answer elsewhere in the prompt.
   if(rules.key(before+after).replace(/〇/g,'').length<4||(before+after).includes(part.word))continue;
   const candidates=shuffle(source.words).filter(word=>rules.key(word)!==rules.key(part.word)&&!source.lines.has(rules.key(before+word+after)));
   candidates.sort((a,b)=>Math.abs(a.length-part.word.length)-Math.abs(b.length-part.word.length));
   const seen=new Set([rules.key(part.word)]),alternatives=[];
   for(const word of candidates){if(seen.has(rules.key(word)))continue;seen.add(rules.key(word));alternatives.push({name:word});if(alternatives.length===count-1)break}
   if(alternatives.length===count-1)return {prompt:full.replace(line,before+'【 ？ 】'+after),answer:part.word,alternatives};
  }
 }
 return null;
}
window.OuenkaBlankQuiz={pool,question};
})();
