(()=>{'use strict';
const button=document.getElementById('randomSelectButton'),storage='ouenkaMedleyRandomV1';
button.textContent='ランダム再生';
const dialog=document.createElement('dialog');dialog.id='randomMedleyDialog';
dialog.innerHTML='<form method="dialog"><div class="random-heading"><h2>メドレーのランダム再生</h2><button value="cancel" aria-label="閉じる">✕</button></div></form><p>使用する球団にチェックを入れてください。</p><label class="random-check"><input id="randomTeamsAll" type="checkbox">球団を一括チェック</label><div id="randomTeamChecks"></div><label class="random-count">曲数の上限（30〜100曲）<input id="randomSongLimit" type="number" min="30" max="100" step="1" value="30" inputmode="numeric"></label><label class="random-check"><input id="randomInclude140" type="checkbox">テンポ140の曲を含める</label><p id="randomMedleyStatus" role="status" aria-live="polite"></p><button type="button" id="randomMedleyStart">抽選して再生</button><p class="random-note">日本代表は対象外です。同じ曲は重複させず、候補が少ない場合は対象曲をすべて使用します。現在のメドレーは抽選結果に入れ替わります。</p>';
document.body.append(dialog);
const $=id=>document.getElementById(id),japan=team=>/日本代表|侍ジャパン|samurai\s*japan/i.test(String(team).normalize('NFKC'));
let songs=null,saved=null;
try{saved=JSON.parse(localStorage.getItem(storage)||'null')}catch{}
if(saved){$('randomSongLimit').value=Number.isInteger(saved.limit)&&saved.limit>=30&&saved.limit<=100?saved.limit:30;$('randomInclude140').checked=!!saved.include140}
function checks(){return [...$('randomTeamChecks').querySelectorAll('input')]}
function sync(){const items=checks(),n=items.filter(x=>x.checked).length;$('randomTeamsAll').checked=!!items.length&&n===items.length;$('randomTeamsAll').indeterminate=n>0&&n<items.length}
function teamOptions(){
 const order=[...document.querySelectorAll('#teamSelect option')].map(x=>x.value).filter(Boolean);
 const teams=[...new Set([...order,...songs.map(getTeam)].filter(t=>t&&!japan(t)))];
 $('randomTeamChecks').replaceChildren(...teams.map(team=>{const label=document.createElement('label');label.className='random-check';const input=document.createElement('input');input.type='checkbox';input.value=team;input.checked=saved&&Array.isArray(saved.teams)?saved.teams.includes(team):true;input.onchange=sync;label.append(input,document.createTextNode(team));return label}));sync();
}
async function load(){
 $('randomMedleyStart').disabled=true;$('randomMedleyStatus').textContent='球団・応援歌を読み込んでいます…';
 try{const response=await fetch(DATA_API+'/songs',{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('応援歌一覧を読み込めませんでした。');const data=await response.json();if(!Array.isArray(data.songs))throw Error('応援歌一覧を確認できませんでした。');songs=data.songs;teamOptions();$('randomMedleyStatus').textContent='';$('randomMedleyStart').disabled=false}catch(error){songs=null;$('randomMedleyStatus').textContent=error.message+' 閉じて開き直すと再試行できます。'}
}
$('randomTeamsAll').onchange=()=>{for(const input of checks())input.checked=$('randomTeamsAll').checked;sync()};
button.addEventListener('click',()=>{dialog.showModal();if(!songs)load()});
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function choose(source,teams,limit,include140){
 const seen=new Set(),pool=source.filter(song=>{const team=getTeam(song),name=getName(song),no=String(song.production_number??song.productionNumber??'').trim(),id=norm(name)+'#'+no;if(!name||!no||japan(team)||!teams.includes(team)||(!include140&&window.OuenkaLineupTempo.tempo(song)===140)||seen.has(id))return false;seen.add(id);return true});
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}return pool.slice(0,limit)
}
$('randomMedleyStart').onclick=async()=>{
 const limit=Number($('randomSongLimit').value),teams=checks().filter(x=>x.checked).map(x=>x.value),include140=$('randomInclude140').checked;
 if(!Number.isInteger(limit)||limit<30||limit>100){$('randomMedleyStatus').textContent='曲数は30〜100の整数で指定してください。';$('randomSongLimit').focus();return}
 if(!teams.length){$('randomMedleyStatus').textContent='球団を1つ以上選んでください。';return}
 if(!songs)return;
 const selected=choose(songs,teams,limit,include140);
 if(!selected.length){$('randomMedleyStatus').textContent='条件に合う応援歌がありません。球団やテンポの条件を変更してください。';return}
 saved={teams,limit,include140};try{localStorage.setItem(storage,JSON.stringify(saved))}catch{}
 stopOneNineMedley();stopRowAudio();
 const rows=selected.map(song=>{const name=getName(song),productionNumber=String(song.production_number??song.productionNumber),urls=registeredSongUrls(song,name,productionNumber);return {...urls,name,productionNumber,team:getTeam(song),songId:String(song.id??''),lyrics:String(song.lyrics||''),tempo:window.OuenkaLineupTempo.tempo(song),jerseyNumber:String(song.uniform_number??song.uniformNumber??'')}});
 renderRows(rows);document.getElementById('lineupTitle').value='ランダムメドレー（'+rows.length+'曲）';saveDraft();updateAllInputFieldColors();dialog.close();setStatus(rows.length+'曲をランダムに選びました。','ok');await playOneNineMedley();
};
window.OuenkaMedleyRandom={choose};
})();
