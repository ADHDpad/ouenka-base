(()=>{'use strict';
const key=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s・･。、，,.!！?？「」『』()（）]/g,'');
function shuffled(items){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function excerpt(duration,options={},barSeconds=(60/170)*4){
 if(!(duration>0))throw Error('音源の長さを確認できません。');
 const available=Math.floor((duration+.001)/barSeconds);
 if(options.unit==='bars'){
  if(available<1)throw Error('1小節分の長さがない音源です。');
  const room=options.random?available-3:available;
  if(room<1)throw Error('最初の1小節・最後の2小節を除いて出題できる区間がありません。');
  const count=Math.min(Math.max(1,Math.floor(Number(options.bars)||1)),room);
  let startBar=0;
  if(options.random){
   const last=available-count-2;
   startBar=Number.isFinite(options.start)?Math.max(1,Math.min(last,Math.round(options.start/barSeconds))):1+Math.floor((Number.isFinite(options.randomValue)?Math.max(0,Math.min(.999999999,options.randomValue)):Math.random())*(last));
  }else if(Number.isFinite(options.start))startBar=Math.max(0,Math.round(options.start/barSeconds));
  else if(options.excerpt==='custom')startBar=Math.max(0,Math.floor(Number(options.startBar)||1)-1);
  if(startBar>=available)throw Error('指定した開始小節が音源の長さを超えています。');
  const bars=Math.min(count,available-startBar),start=startBar*barSeconds,seconds=Math.min(bars*barSeconds,duration-start);
  return {start,duration:seconds,bars,startBar:startBar+1};
 }
 const requested=Math.max(.001,Number(options.seconds)||duration);
 if(options.random){
  const from=barSeconds,to=(available-2)*barSeconds;
  if(to<=from)throw Error('最初の1小節・最後の2小節を除いて出題できる区間がありません。');
  const clip=Math.min(requested,to-from),last=to-clip;
  const start=Number.isFinite(options.start)?Math.max(from,Math.min(last,options.start)):from+(Number.isFinite(options.randomValue)?Math.max(0,Math.min(.999999999,options.randomValue)):Math.random())*Math.max(0,last-from);
  return {start,duration:clip};
 }
 const clip=Math.min(requested,duration),start=Number.isFinite(options.start)?Math.min(Math.max(0,options.start),Math.max(0,duration-clip)):0;
 return {start,duration:clip};
}
let knownNames=[],knownPattern=null,nameAliases=new Map(),lyricCatalogs=new WeakMap();
const namePattern=part=>Array.from(String(part).normalize('NFKC').replace(/[\s　・･]/g,'')).map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[\\s　・･]*');
function setPlayerNames(players=[]){
 knownNames=[];nameAliases=new Map();
 for(const p of players){const full=String(p.name||p.player_name||'').replace(/[（(][^）)]*[）)]/g,'').trim();if(!full)continue;knownNames.push(full);const aliases=[...(Array.isArray(p.aliases)?p.aliases:[]),...full.split(/[\s　・･]+/)];nameAliases.set(key(full),[...(nameAliases.get(key(full))||[]),...aliases])}
 knownNames=[...new Set(knownNames)].filter(n=>Array.from(n).length>=2).sort((a,b)=>b.length-a.length);knownPattern=knownNames.length?new RegExp(knownNames.map(namePattern).join('|'),'gi'):null;lyricCatalogs=new WeakMap();
}
function maskName(text,song){
 const name=typeof song==='string'?song:String(song?.name||song?.player_name||''),plain=name.replace(/[（(][^）)]*[）)]/g,'');
 let own=nameAliases.get(key(plain))||[];
 if(!own.length){const related=knownNames.find(n=>key(n).length>=3&&(key(plain).endsWith(key(n))||key(n).endsWith(key(plain))));if(related)own=nameAliases.get(key(related))||[]}
 const pieces=[plain,...plain.split(/[\s　・･]+/),...own,...(typeof song==='object'&&Array.isArray(song.aliases)?song.aliases:[])].filter(Boolean).sort((a,b)=>b.length-a.length);
 const hide=match=>match.replace(/[^\s　]/gu,'〇');let result=String(text).normalize('NFKC');if(knownPattern)result=result.replace(knownPattern,hide);
 for(const part of new Set(pieces)){const pattern=namePattern(part);if(pattern)result=result.replace(new RegExp(pattern,'gi'),hide)}
 return result;
}
function lyricGroups(allSongs){
 if(lyricCatalogs.has(allSongs))return lyricCatalogs.get(allSongs);
 const groups=new Map();for(const song of allSongs){const id=key(song.name);if(!groups.has(id))groups.set(id,{id,song,lyrics:[]});groups.get(id).lyrics.push(key(maskName(mainLyrics(song).join("\n"),song)))}
 const result=[...groups.values()];lyricCatalogs.set(allSongs,result);return result;
}
function lyricsQuestion(song,allSongs,lineCount='2',options={}){
 const needed=options.minAlternatives===0?0:Math.max(1,Math.min(9,Number(options.minAlternatives)||3));
 const lines=mainLyrics(song);
 if(!lines.length)return null;
 const count=Math.min(4,lines.length,Math.max(1,Number(lineCount)||1));
 const offsets=shuffled(Array.from({length:Math.max(1,lines.length-count+1)},(_,i)=>i));
 for(const offset of offsets){
  const raw=lines.slice(offset,offset+count).join('\n'),prompt=maskName(raw,song);
  if(key(prompt).replace(/〇/g,'').length<2)continue;
  const fragment=key(prompt),wrong=new Map();
  for(const group of shuffled(lyricGroups(allSongs))){
   if(group.id===key(song.name)||group.lyrics.some(lyrics=>lyrics.includes(fragment)))continue;
   wrong.set(group.id,group.song);if(wrong.size>=needed)break;
  }
  if(wrong.size>=needed)return {prompt,fragment,lines,offset,count,acceptedNames:lyricGroups(allSongs).filter(group=>group.lyrics.some(lyrics=>lyrics.includes(fragment))).map(group=>group.song.name),alternatives:[...wrong.values()].slice(0,needed)};
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
function mainLyrics(song){
 const unknown=line=>/^(?:[（(【\[]\s*)?(?:歌詞\s*)?(?:不明|なし|無し|未登録|未設定|準備中|調査中)(?:\s*[）)】\]])?[。.!！]*$/.test(line)||/^[—－ー\-\s]+$/.test(line);
 const text=String(song.lyrics||'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/\\n/g,'\n').replace(/(【(?:前奏|本編|歌詞|メイン)】|\[(?:前奏|本編|歌詞|メイン)\])/g,'\n$1\n');
 let intro=false;const lines=[];
 for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(/^[【\[]?前奏[】\]:：]?$/.test(line)){intro=true;continue}if(/^[【\[]?(?:本編|歌詞|メイン)[】\]:：]?$/.test(line)){intro=false;continue}if(!intro&&line&&!unknown(line))lines.push(line)}
 return lines.slice(Math.max(0,Number(song.lyricsIntroLines||song.lyrics_intro_lines)||0));
}
function validLyrics(song){return mainLyrics(song).length>0}
function sameBody(a,b){const group=s=>s.mainMelodyGroup||s.main_melody_group||s.body_group_id;if(group(a)&&group(b))return String(group(a))===String(group(b));const source=s=>{const r=s.audioSource||{};return key(s.reuseName||s.reuse_name||r.reuseName||r.name||s.name)+'#'+String(s.reuseProductionNumber||s.reuse_production_number||r.reuseProductionNumber||r.productionNumber||s.productionNumber||s.production_number||1)};if(source(a)===source(b))return true;const melody=s=>String(s.melodyUrl||s.melody_url||s.melody_filename||'');return !!melody(a)&&melody(a).includes('/')&&melody(a)===melody(b)}

function lyricsMatch(song,prompt){const body=key(maskName(mainLyrics(song).join('\n'),song)),asked=key(prompt);return !!asked&&body.includes(asked)}
window.OuenkaQuizRules={excerpt,maskName,setPlayerNames,lyricsQuestion,audioAlternatives,key,mainLyrics,validLyrics,sameBody,lyricsMatch};
})();
