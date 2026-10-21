(()=>{'use strict';
const key=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s・･。、，,.!！?？「」『』()（）]/g,'');
function shuffled(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function excerpt(duration,options={},barSeconds=(60/170)*4){
 if(!(duration>0))throw Error('音源の長さを確認できません。');
 if(options.unit==='bars'){
  const available=Math.floor((duration+.001)/barSeconds);if(available<1)throw Error('1小節分の長さがない音源です。');
  const count=Math.min(Math.max(1,Math.floor(Number(options.bars)||1)),available);
  let startBar=0;
  if(Number.isFinite(options.start))startBar=Math.max(0,Math.round(options.start/barSeconds));
  else if(options.excerpt==='custom')startBar=Math.max(0,Math.floor(Number(options.startBar)||1)-1);
  else if(options.random)startBar=Math.floor(Math.random()*(available-count+1));
  if(startBar>=available)throw Error('指定した開始小節が音源の長さを超えています。');
  const bars=Math.min(count,available-startBar),start=startBar*barSeconds,seconds=Math.min(bars*barSeconds,duration-start);
  return {start,duration:seconds,bars,startBar:startBar+1};
 }
 const clip=Math.min(Math.max(.001,Number(options.seconds)||duration),duration),start=Number.isFinite(options.start)?Math.min(Math.max(0,options.start),Math.max(0,duration-clip)):(options.random?Math.random()*Math.max(0,duration-clip):0);
 return {start,duration:clip};
}
function maskName(text,name){
 const pieces=[String(name||'').replace(/\s/g,''),...String(name||'').split(/[\s　・･]+/)].filter(s=>s.length>=2).sort((a,b)=>b.length-a.length);
 let result=String(text);
 for(const part of new Set(pieces)){
  const pattern=Array.from(part).map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s　]*');
  result=result.replace(new RegExp(pattern,'gi'),'■■');
 }
 return result;
}
const lyricCatalogs=new WeakMap();
function lyricGroups(allSongs){
 if(lyricCatalogs.has(allSongs))return lyricCatalogs.get(allSongs);
 const groups=new Map();for(const song of allSongs){const id=key(song.name);if(!groups.has(id))groups.set(id,{id,song,lyrics:[]});groups.get(id).lyrics.push(key(song.lyrics))}
 const result=[...groups.values()];lyricCatalogs.set(allSongs,result);return result;
}
function lyricsQuestion(song,allSongs,lineCount='2'){
 const lines=String(song.lyrics||'').replace(/\r\n?/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean);
 if(!lines.length)return null;
 const count=lineCount==='all'?lines.length:Math.min(lines.length,Math.max(1,Number(lineCount)||2));
 const offsets=shuffled(Array.from({length:lines.length-count+1},(_,i)=>i));
 for(const offset of offsets){
  const raw=lines.slice(offset,offset+count).join('\n'),prompt=maskName(raw,song.name);
  if(key(prompt).replace(/■/g,'').length<2)continue;
  const fragment=key(raw),wrong=new Map();
  for(const group of shuffled(lyricGroups(allSongs))){
   if(group.id===key(song.name)||group.lyrics.some(lyrics=>lyrics.includes(fragment)))continue;
   wrong.set(group.id,group.song);if(wrong.size>=3)break;
  }
  if(wrong.size)return {prompt,alternatives:[...wrong.values()].slice(0,3)};
 }
 return null;
}
window.OuenkaQuizRules={excerpt,maskName,lyricsQuestion,key};
})();
