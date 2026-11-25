(()=>{'use strict';const $=id=>document.getElementById(id),api='https://ouenka-base-data.ninzin5600.workers.dev',labels=['テンポ設定確認','汎用登録設定確認','投手登録設定確認','個人再生確認','メドレー再生確認'];let drafts=[],catalog=[],order=[],ctx=null,source=null,epoch=0,busy=false;const status=t=>$('status').textContent=t;const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b}async function json(url,opt){const r=await fetch(url,opt),d=await r.json();if(!r.ok||d.ok===false)throw Error(d.error||'通信エラー');return d}
let medleyBuffer = null;
let playbackOffset = 0;
let startedAt = 0;
let progressFrame = 0;
const seek = $('medleySeek');
const pause = $('medleyPause');

function timeLabel(seconds){
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}

function position(){
  return Math.min(medleyBuffer.duration, playbackOffset + (source ? ctx.currentTime - startedAt : 0));
}

function showProgress(seconds){
  seek.value = seconds;
  seek.setAttribute('aria-valuetext', timeLabel(seconds) + ' / ' + timeLabel(medleyBuffer.duration));
  $('medleyTime').textContent = seek.getAttribute('aria-valuetext');
}

function tick(){
  showProgress(position());
  progressFrame = requestAnimationFrame(tick);
}

function stopSource(){
  cancelAnimationFrame(progressFrame);
  if(!source) return;
  source.onended = null;
  source.stop();
  source.disconnect();
  source = null;
}

function finish(){
  stop();
  status('再生完了。確認できた項目にチェックしてください。');
}

function startBuffer(buffer, offset){
  const next = ctx.createBufferSource();
  next.buffer = buffer;
  next.connect(ctx.destination);
  next.onended = () => {
    if(source === next) finish();
  };
  startedAt = ctx.currentTime;
  next.start(0, offset);
  source = next;
  if(medleyBuffer) tick();
}

pause.onclick = () => {
  if(!medleyBuffer) return;
  if(source){
    playbackOffset = position();
    stopSource();
    showProgress(playbackOffset);
    pause.textContent = '再開';
  }else if(playbackOffset >= medleyBuffer.duration){
    finish();
  }else{
    startBuffer(medleyBuffer, playbackOffset);
    pause.textContent = '一時停止';
  }
};

seek.oninput = () => {
  if(!medleyBuffer) return;
  cancelAnimationFrame(progressFrame);
  showProgress(Number(seek.value));
};

seek.onchange = () => {
  if(!medleyBuffer) return;
  const playing = Boolean(source);
  playbackOffset = Number(seek.value);
  stopSource();
  if(playing && playbackOffset >= medleyBuffer.duration){
    finish();
  }else if(playing){
    startBuffer(medleyBuffer, playbackOffset);
  }
};

function addAllDrafts(){
  const added = new Set(order.map(entry => entry.draftKey));
  const missing = drafts.filter(draft => !added.has(draft.key));
  order.push(...missing.map(item));
  renderOrder();
}
function stop(){
  epoch++;
  stopSource();
  if(ctx) ctx.close().catch(()=>{});
  ctx = null;
  medleyBuffer = null;
  playbackOffset = 0;
  seek.disabled = true;
  seek.value = 0;
  seek.removeAttribute('aria-valuetext');
  pause.disabled = true;
  pause.textContent = '一時停止';
  $('medleyTime').textContent = '0:00 / 0:00';
}
async function play(items, isMedley = false){
if(!items.length)return status('曲を選択してください。');stop();const token=epoch;try{ctx=new (window.AudioContext||window.webkitAudioContext)();const c=ctx;await c.resume();status('音源読み込み中…');const result=await OuenkaMedleyCore.build(c,items,{load:async(item,file,optional)=>{let bytes;if(item.files){const blob=item.files[file];if(!blob){if(optional)return null;throw Error(file+' がありません')}bytes=await blob.arrayBuffer()}else{const u=OuenkaMedleyCore.registeredAudioUrls(item);const base=u.melodyUrl.replace(/melody\.m4a$/,'');const r=await fetch(base+file);if(!r.ok){if(optional)return null;throw Error(file+' 読み込み失敗')}bytes=await r.arrayBuffer()}return c.decodeAudioData(bytes)},cancelled:()=>{if(token!==epoch)throw Error('停止')}});if(token!==epoch)return;if(isMedley){
  medleyBuffer = result.buffer;
  seek.max = medleyBuffer.duration;
  seek.disabled = false;
  pause.disabled = false;
}
startBuffer(result.buffer, 0);
status('再生中：'+items.map(x=>x.player_name).join(' → '))}catch(e){if(token===epoch){stop();status(e.message)}}}const item=d=>({...d.meta,files:d.files,draftKey:d.key});function renderOrder(){const added=new Set(order.map(entry=>entry.draftKey));$('addAllDrafts').disabled=!drafts.some(draft=>!added.has(draft.key));const box=$('order');box.replaceChildren();order.forEach((x,i)=>{const row=el('div');row.append(el('span',`${i+1}. ${x.player_name} `),button('↑',()=>{if(i){[order[i-1],order[i]]=[order[i],order[i-1]];renderOrder()}}),button('削除',()=>{order.splice(i,1);renderOrder()}));box.append(row)});if(!order.length)box.textContent='曲を追加してください。'}async function save(d){await OuenkaReview.put(d)}async function zip(d){const next=await json(api+'/songs/next-number?name='+encodeURIComponent(d.meta.player_name),{cache:'no-store'});d.meta.production_number=next.next_production_number;const z=new JSZip(),folder=z.folder(d.meta.player_name.replace(/[\\/:*?"<>|]/g,'_')).folder(String(d.meta.production_number));for(const [name,blob] of Object.entries(d.files))if(blob)folder.file(name,blob);const blob=await z.generateAsync({type:'blob'});const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=d.meta.player_name+'_'+d.meta.production_number+'_PC保存用.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);d.zipReady=true;delete d.zipBatch;await save(d);status('ZIPを展開し、GitHubのデータフォルダへ配置してPushしてください。');render()}async function publish(d,batch=false,nextNumbers=new Map()){if((busy&&!batch)||!d.checks.every(Boolean)||!d.zipReady)return;if(!batch&&!confirm('GitHubへの音源配置・Pushが完了しましたか？'))return;if(!batch){busy=true;render();}try{const name=d.meta.player_name;
const expected=Number(d.meta.production_number);
if(!nextNumbers.has(name)){
  const next=await json(api+'/songs/next-number?name='+encodeURIComponent(name)+'&_='+Date.now(),{cache:'no-store'});
  nextNumbers.set(name, Number(next.next_production_number));
}
if(nextNumbers.get(name)!==expected){
  throw Error('現在の次の制作番号は '+nextNumbers.get(name)+' です。ZIPの内容を確認してください。');
}const u=OuenkaMedleyCore.registeredAudioUrls(d.meta);const base=u.melodyUrl.replace(/melody\.m4a$/,'');for(const f of Object.keys(d.files).filter(f=>d.files[f]&&f.endsWith('.m4a'))){const r=await fetch(base+f,{method:'HEAD',cache:'no-store'});if(!r.ok)throw Error('公開音源が確認できません：'+f)}const result=await json(api+'/songs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d.meta)});if(Number(result.production_number)!==expected){
  await OuenkaReview.remove(d.key);
  drafts=drafts.filter(x=>x.key!==d.key);
  renderOrder();
  throw Error('公開サーバーが制作番号 '+result.production_number+' で登録しました。音源フォルダを確認してください。');
}
nextNumbers.set(name, expected+1);
await OuenkaReview.remove(d.key);drafts=drafts.filter(x=>x.key!==d.key);renderOrder();status('公開登録完了：'+d.meta.player_name+' 制作番号 '+result.production_number+(result.production_number!==d.meta.production_number?'（制作番号が変わりました。音源フォルダを修正してください）':''));}catch(e){status(e.message);if(batch)throw e}finally{if(!batch){busy=false;render()}}}
async function removeDraft(d){
  if(busy || !confirm(d.meta.player_name + ' の未公開データを削除しますか？')) return;
  busy = true;
  render();
  try {
    await OuenkaReview.remove(d.key);
    drafts = drafts.filter(draft => draft.key !== d.key);
    order = order.filter(entry => entry.draftKey !== d.key);
    renderOrder();
    status(d.meta.player_name + ' をチェックリストから削除しました。');
  } catch (error) {
    status('削除に失敗しました：' + error.message);
  } finally {
    busy = false;
    render();
  }
}
function render(){const box=$('list');box.replaceChildren();const ready=drafts.filter(d=>d.checks.every(Boolean));$('summary').textContent=`未公開 ${drafts.length}曲 ／ 確認済み ${ready.length}曲 ／ 公開準備済み ${ready.filter(d=>d.zipReady).length}曲`;$('batchZip').disabled=busy||!ready.length;const publishCount=batchPublishCandidates().length;$('batchPublish').disabled=busy||!publishCount;$('batchPublish').textContent=publishCount?'一括公開（'+publishCount+'曲）':'一括公開';if(!drafts.length)box.textContent='未公開の応援歌はありません。';for(const d of drafts){const a=el('article');a.append(el('h2',d.meta.player_name+' ／ '+d.meta.team),el('p',`${d.meta.tempo} BPM ／ 汎用：${d.meta.is_generic?'はい':'いいえ'} ／ 投手：${d.meta.is_pitcher_song?'はい':'いいえ'}`));const actions=el('div');actions.className='actions';actions.append(button('個人再生',()=>play([item(d)])),button('メドレーに追加',()=>{order.push(item(d));renderOrder()}));a.append(actions);for(const [i,label] of labels.entries()){const l=el('label'),c=el('input');c.type='checkbox';c.checked=d.checks[i];c.disabled=busy;c.onchange=async()=>{d.checks[i]=c.checked;try{await save(d);render()}catch(e){status(e.message)}};l.append(c,document.createTextNode(label));a.append(l)}const footer=el('div');footer.className='actions';const z=button('PC保存用ZIP作成',async()=>{try{await zip(d)}catch(e){status(e.message)}}),p=button('この曲だけ公開',()=>publish(d));z.disabled=busy||!d.checks.every(Boolean);p.disabled=busy||!d.zipReady||!d.checks.every(Boolean);const remove=button('チェックリストから削除',()=>removeDraft(d));remove.disabled=busy;footer.append(z,p,remove);a.append(footer,el('small',d.zipReady?'ZIP作成済み：GitHubへの配置後に公開できます。':'全項目チェック後にZIPを作成できます。'));box.append(a)}}$('gate').querySelector('form').onsubmit=async e=>{e.preventDefault();if(!OuenkaCreatorPassword.matches(e.target.querySelector('input').value))return $('error').textContent='パスワードが違います。';try{drafts=(await OuenkaReview.all()).sort((a,b)=>a.createdAt-b.createdAt);$('gate').hidden=true;$('content').hidden=false;render();renderOrder()}catch(e){$('error').textContent=e.message}};function safeFolderName(name){
  return name.replace(/[\\/:*?"<>|]/g,'_');
}

$('batchZip').onclick = async () => {
  if(busy) return;
  const selected = drafts.filter(draft => draft.checks.every(Boolean));
  if(!selected.length) return;
  busy = true;
  render();
  try {
    const zip = new JSZip();
    const nextNumbers = new Map();
    const prepared = [];
    const batch = Date.now();
    for(const draft of selected){
      const name = draft.meta.player_name;
      if(!nextNumbers.has(name)){
        const next = await json(api + '/songs/next-number?name=' + encodeURIComponent(name), {cache:'no-store'});
        nextNumbers.set(name, next.next_production_number);
      }
      const number = nextNumbers.get(name);
      nextNumbers.set(name, number + 1);
      const folder = zip.folder(safeFolderName(name)).folder(String(number));
      for(const [filename, file] of Object.entries(draft.files)){
        if(file) folder.file(filename, file);
      }
      prepared.push({...draft, meta:{...draft.meta, production_number:number}, zipReady:true, zipBatch:batch});
    }
    const blob = await zip.generateAsync({type:'blob'});
    await OuenkaReview.putAll(prepared);
    prepared.forEach((draft,index) => Object.assign(selected[index], draft));
    const url = URL.createObjectURL(blob);
    const link = el('a');
    link.href = url;
    link.download = '応援歌_一括公開用.zip';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    status(prepared.length + '曲のZIPを作成しました。GitHubに配置・Pushしたら「一括公開」を押してください。');
  }catch(error){
    status('一括ZIP作成に失敗しました：' + error.message);
  }finally{
    busy = false;
    render();
  }
};

function batchPublishCandidates(){
  return drafts.filter(draft => draft.zipReady && draft.checks.every(Boolean))
    .sort((a,b) => a.meta.player_name.localeCompare(b.meta.player_name, 'ja') ||
      a.meta.production_number - b.meta.production_number);
}

$('batchPublish').onclick = async () => {
  if(busy) return;
  const selected = batchPublishCandidates();
  if(!selected.length || !confirm(selected.length + '曲の音源をGitHubに配置・Pushしましたか？')) return;
  busy = true;
  render();
  let count = 0;
  const errors = [];
  const blockedNames = new Set();
  const nextNumbers = new Map();
  try {
    for(const draft of selected){
      const name = draft.meta.player_name;
      const label = name + '（制作番号 ' + draft.meta.production_number + '）';
      if(blockedNames.has(name)){
        errors.push(label + '：同じ選手の先の制作番号が未公開です。');
        continue;
      }
      try {
        status('公開中 ' + (count + errors.length + 1) + ' / ' + selected.length + '曲：' + label);
        await publish(draft, true, nextNumbers);
        count++;
      }catch(error){
        blockedNames.add(name);
        errors.push(label + '：' + error.message);
      }
    }
    status('公開完了：' + count + ' / ' + selected.length + '曲' +
      (errors.length ? '\n未公開のまま：\n' + errors.join('\n') : ''));
  }finally{
    busy = false;
    render();
  }
};
$('addAllDrafts').onclick=addAllDrafts;$('medley').onclick=()=>play([...order],true);$('stop').onclick=()=>{stop();status('停止しました')};$('loadCatalog').onclick=async()=>{try{catalog=(await json(api+'/songs',{cache:'no-store'})).songs;$('catalog').replaceChildren(new Option('曲を選択',''),...catalog.map((s,i)=>new Option(s.player_name+' #'+s.production_number,String(i))))}catch(e){status(e.message)}};$('addCatalog').onclick=()=>{if($('catalog').value==='')return;const s=catalog[Number($('catalog').value)];if(s){order.push(s);renderOrder()}};window.addEventListener('pagehide',stop)})();
