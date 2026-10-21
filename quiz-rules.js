(()=>{'use strict';
const key=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s・･。、，,.!！?？「」『』()（）]/g,'');
function shuffled(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function excerpt(duration,options={},barSeconds=(60/170)*4){
 if(!(duration>0))throw Error('音源の長さを確認できません。');
 const available=Math.floor((duration+.001)/barSeconds);
 if(options.unit==='bars'){
  if(available<1)throw Error('1小節分の長さがない音源です。');
  const room=options.random?available-2:available;
  if(room<1)throw Error('先頭・最終小節を除いて出題できる区間がありません。');
  const count=Math.min(Math.max(1,Math.floor(Number(options.bars)||1)),room);
  let startBar=0;
  if(options.random){
   const last=available-count-1;
   startBar=Number.isFinite(options.start)?Math.max(1,Math.min(last,Math.round(options.start/barSeconds))):1+Math.floor((Number.isFinite(options.randomValue)?Math.max(0,Math.min(.999999999,options.randomValue)):Math.random())*(last));
  }else if(Number.isFinite(options.start))startBar=Math.max(0,Math.round(options.start/barSeconds));
  else if(options.excerpt==='custom')startBar=Math.max(0,Math.floor(Number(options.startBar)||1)-1);
  if(startBar>=available)throw Error('指定した開始小節が音源の長さを超えています。');
  const bars=Math.min(count,available-startBar),start=startBar*barSeconds,seconds=Math.min(bars*barSeconds,duration-start);
  return {start,duration:seconds,bars,startBar:startBar+1};
 }
 const requested=Math.max(.001,Number(options.seconds)||duration);
 if(options.random){
  const from=barSeconds,to=(available-1)*barSeconds;
  if(to<=from)throw Error('先頭・最終小節を除いて出題できる区間がありません。');
  const clip=Math.min(requested,to-from),last=to-clip;
  const start=Number.isFinite(options.start)?Math.max(from,Math.min(last,options.start)):from+(Number.isFinite(options.randomValue)?Math.max(0,Math.min(.999999999,options.randomValue)):Math.random())*Math.max(0,last-from);
  return {start,duration:clip};
 }
 const clip=Math.min(requested,duration),start=Number.isFinite(options.start)?Math.min(Math.max(0,options.start),Math.max(0,duration-clip)):0;
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
function lyricsQuestion(song,allSongs,lineCount='2',options={}){
 const needed=Math.max(1,Math.min(9,Number(options.minAlternatives)||3));
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
   wrong.set(group.id,group.song);if(wrong.size>=needed)break;
  }
  if(wrong.size>=needed)return {prompt,fragment,acceptedNames:lyricGroups(allSongs).filter(group=>group.lyrics.some(lyrics=>lyrics.includes(fragment))).map(group=>group.song.name),alternatives:[...wrong.values()].slice(0,needed)};
 }
 return null;
}
function soundKeys(song){
 const result=new Set(),source=song.audioSource||{},reuseName=song.reuseName||song.reuse_name||source.reuseName,reuseNumber=song.reuseProductionNumber||song.reuse_production_number||source.reuseProductionNumber;
 const name=reuseName||source.name||song.name,number=reuseNumber||source.productionNumber||song.productionNumber||song.production_number||1;
 result.add('song:'+key(name)+'#'+String(number));
 for(const field of ['melodyUrl','melody_url','melody_filename','audioUrl','audio_url','audio_filename']){
  const value=String(song[field]||'').trim();if(!value.includes('/'))continue;
  try{const url=new URL(value,'https://adhdpad.github.io/ouenka-base/');url.search='';url.hash='';result.add('path:'+url.href);
   const parts=decodeURIComponent(url.pathname).split('/'),at=parts.indexOf('データ');if(at>=0&&parts[at+1]&&/^\d+$/.test(parts[at+2]||''))result.add('song:'+key(parts[at+1])+'#'+parts[at+2]);
  }catch{}
 }
 return result;
}
function audioAlternatives(song,allSongs,needed){
 const own=soundKeys(song),groups=new Map();for(const other of allSongs){const id=key(other.name);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(other)}
 const result=[];
 for(const versions of shuffled([...groups.values()])){
  if(key(versions[0].name)===key(song.name)||versions.some(other=>[...soundKeys(other)].some(id=>own.has(id))))continue;
  result.push(versions[0]);if(result.length>=needed)break;
 }
 return result;
}
window.OuenkaQuizRules={excerpt,maskName,lyricsQuestion,audioAlternatives,key};
})();
