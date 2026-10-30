(()=>{'use strict';
function setupMenuMotion(dialog){
let pending=null,start=null,replaying=false;
const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function close(){
 if(!dialog.open)return Promise.resolve();
 if(pending)return pending;
 dialog.classList.add('shared-menu-closing');
 pending=new Promise(resolve=>{let done=false,timer;const finish=()=>{if(done)return;done=true;clearTimeout(timer);dialog.removeEventListener('animationend',ended);dialog.close();dialog.classList.remove('shared-menu-closing');pending=null;resolve()};const ended=e=>{if(e.target===dialog&&e.animationName==='shared-menu-exit')finish()};dialog.addEventListener('animationend',ended);timer=setTimeout(finish,reduced()?0:240)});
 return pending;
}
dialog.addEventListener('click',e=>{
 if(replaying)return;
 const closeButton=e.target.closest('[data-close]');
 const rect=dialog.getBoundingClientRect();
 const outside=e.target===dialog&&(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom);
 if(outside||closeButton){e.preventDefault();e.stopImmediatePropagation();close();return}
 const action=e.target.closest('nav a,nav button');
 if(!action||action.matches('[data-audio-reset]')||action.disabled)return;
 e.preventDefault();e.stopImmediatePropagation();
 close().then(()=>{replaying=true;try{action.click()}finally{replaying=false}});
},true);
dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
dialog.addEventListener('touchstart',e=>{if(e.touches.length===1)start={x:e.touches[0].clientX,y:e.touches[0].clientY};else start=null},{passive:true,capture:true});
dialog.addEventListener('touchend',e=>{if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;start=null;if(dx < -65&&Math.abs(dx)>Math.abs(dy)*1.4){e.stopImmediatePropagation();close()}},{passive:true,capture:true});
dialog.addEventListener('touchcancel',()=>{start=null},{passive:true});
return close;
}
function init(){
let themeMeta=document.querySelector('meta[name="theme-color"]');if(!themeMeta){themeMeta=document.createElement('meta');themeMeta.name='theme-color';themeMeta.content=getComputedStyle(document.documentElement).getPropertyValue('--site-main').trim()||'#071d33';document.head.append(themeMeta)}
const rawPage=location.pathname.split('/').pop()||'index.html';const page=rawPage.includes('.')?rawPage:rawPage+'.html';if(page==='index.html')return;
const special=page==='1-9.html'||page==='medley.html';
let header=document.querySelector('body>header,body>.toolbar');if(!header){header=document.createElement('header');document.body.prepend(header)}header.classList.add('shared-titlebar');
const oldBack=[...(header||document.body).querySelectorAll('button,a')].find(b=>/戻る|◀ ホーム/.test(b.textContent));
const bar=document.createElement('div');bar.id='sharedNavigation';bar.setAttribute('role','navigation');bar.setAttribute('aria-label','共通ナビゲーション');bar.innerHTML='<button type="button" id="sharedMenuButton" aria-label="メニューを開く" aria-haspopup="dialog" aria-expanded="false"><span aria-hidden="true"><svg class="home-menu-symbol" viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M4 6h20M4 14h20M4 22h20"/></svg></span></button>';header.prepend(bar);document.body.classList.add('has-shared-navigation');
const trigger=bar.querySelector('#sharedMenuButton'),back=document.createElement('button');back.type='button';back.id='sharedBackButton';back.className='button shared-back-button';back.textContent='◀戻る';const actions=header.querySelector('#lineupTopActions,.top-actions,.team-topline')||header;actions.append(back);
if(oldBack)oldBack.classList.add('shared-original-control');
back.onclick=()=>{if(oldBack){oldBack.click();return}if(document.referrer&&new URL(document.referrer).origin===location.origin&&history.length>1)history.back();else location.href='index.html'};
document.querySelectorAll('.lineup-menu-trigger,#settingsMenuButton').forEach(b=>b.classList.add('shared-original-control'));
let dialog=special?document.querySelector('dialog.lineup-menu'):null;
if(!dialog){dialog=document.createElement('dialog');dialog.className='lineup-menu shared-menu';dialog.innerHTML='<div class="lineup-menu-heading"><b>メニュー</b><button type="button" data-close aria-label="メニューを閉じる">✕</button></div>';document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()})}
dialog.id='sharedMenuDialog';dialog.classList.add('shared-menu');trigger.setAttribute('aria-controls',dialog.id);
const specific=special?dialog.querySelector('nav'):null;
const general=document.createElement('section');general.id='sharedGeneralMenu';general.innerHTML="<nav aria-label=\"サイトメニュー\"><p>探す・聴く</p><a href=\"index.html#homePlayerSearch\">選手名から検索</a><a href=\"index.html#homeTeams\">球団一覧</a><a href=\"favorites.html\">★ お気に入り</a><a href=\"stadium.html\">球場モード</a><a href=\"requests.html\">リクエスト箱</a><a href=\"play.html#compare\">⇄ 聴き比べ</a><p>作る・遊ぶ</p><a href=\"1-9.html\">1-9作成</a><a href=\"medley.html\">メドレー作成</a><a href=\"popular.html\"><svg viewBox=\"0 0 24 24\" width=\"1em\" height=\"1em\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M3 6l5 4 4-7 4 7 5-4-2 12H5L3 6zm2 14h14v2H5z\"/></svg> 人気ランキング</a><a href=\"play.html#quiz\">♪ 応援歌クイズ</a><a href=\"play.html#lyricsquiz\">▤ 歌詞クイズ</a><a href=\"draft.html\">応援歌ドラフト</a><a href=\"ranking.html\"><svg viewBox=\"0 0 24 24\" width=\"1em\" height=\"1em\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\" style=\"vertical-align:-.15em\"><path d=\"M3 6l5 4 4-7 4 7 5-4-2 12H5L3 6zm2 14h14v2H5z\"/></svg> 応援歌 即興ランキング</a><a href=\"songbook.html\">応援歌図鑑</a><p>管理</p><button data-audio-reset type=\"button\">iPhone音声復旧リセット</button><a href=\"save.html\">データ登録</a><a href=\"settings.html\">設定・端末間共有</a><button data-site-update type=\"button\">↻ サイトを更新</button></nav>";
const home=document.createElement('a');home.href='index.html';home.textContent='⌂ ホーム';general.querySelector('nav').prepend(home);dialog.append(general);
if(specific){const homeAction=home.cloneNode(true);specific.prepend(homeAction);specific.id='sharedSpecificMenu';specific.setAttribute('role','tabpanel');general.setAttribute('role','tabpanel');const tabs=document.createElement('div');tabs.className='shared-menu-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','メニューの種類');for(const [i,label,panel]of [[0,'通常メニュー',general],[1,page==='1-9.html'?'1-9メニュー':'メドレーメニュー',specific]]){const b=document.createElement('button');b.type='button';b.id='sharedMenuTab'+i;b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',b.id);b.onclick=()=>select(i);tabs.append(b)}function select(i){[general,specific].forEach((p,k)=>{p.hidden=i!==k;tabs.children[k].setAttribute('aria-selected',String(i===k));tabs.children[k].tabIndex=i===k?0:-1})}tabs.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const n=tabs.children[0].getAttribute('aria-selected')==='true'?1:0;select(n);tabs.children[n].focus()}};dialog.querySelector('.lineup-menu-heading').after(tabs);select(0)}
general.querySelector('a[href="1-9.html"]').innerHTML='<span class="lineup-box-icon" aria-hidden="true"><svg class="lineup-symbol" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l2-2v10M2.5 17h5M10 12h3M20.5 12h-3a2.5 2.5 0 0 1 0-5h.5a2.5 2.5 0 0 1 2.5 2.5V14a3 3 0 0 1-3 3H16"/></svg></span> 1-9作成';
setupMenuMotion(dialog);
trigger.onclick=()=>{dialog.showModal();trigger.setAttribute('aria-expanded','true')};dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus()});
general.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>dialog.close()));
general.querySelector('[data-site-update]').onclick=()=>{dialog.close();if(window.updateApp)window.updateApp();else location.reload()};
general.querySelector('[data-audio-reset]').onclick=e=>window.OuenkaMenuReset(e.currentTarget);
}
if(document.readyState!=='complete')window.addEventListener('load',init,{once:true});else init();
})();
/* Keep dedicated menu tabs, with one icon and bilingual labels per action. */
window.addEventListener('load',()=>{
const icons={'favorites.html':'★','medley.html':'♫','popular.html':'♛','ranking.html':'♛','draft.html':'▦','songbook.html':'▤','stadium.html':'⚑','requests.html':'✉','save.html':'＋','settings.html':'⚙','play.html':'♪','index.html':'⌂'};
document.querySelectorAll('#homeMenuDialog nav,#sharedMenuDialog nav').forEach(nav=>{
nav.querySelectorAll('a,button').forEach(item=>{
let label=item.querySelector('.menu-item-label')?.textContent;
if(label)return;
const oldIcon=item.querySelector('.menu-action-icon,.lineup-box-icon,svg');
let text=item.textContent.trim();
if(oldIcon?.textContent.trim())text=text.replace(oldIcon.textContent.trim(),'').trim();
text=text.replace(/^[★☆♪♫♛▦▤＋+⚙︎️⌂⌕⇄↻⚑✉◀▶▣▧⚄]+\s*/u,'');
const href=item.getAttribute('href')||'',path=href.split('#')[0];
const icon=document.createElement('span');icon.className='menu-item-icon';icon.setAttribute('aria-hidden','true');
if(path==='1-9.html'){icon.classList.add('lineup-box-icon');icon.innerHTML='<svg class="lineup-symbol" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l2-2v10M2.5 17h5M10 12h3M20.5 12h-3a2.5 2.5 0 0 1 0-5h.5a2.5 2.5 0 0 1 2.5 2.5V14a3 3 0 0 1-3 3H16"/></svg>'}
else if(oldIcon?.tagName.toLowerCase()==='svg')icon.append(oldIcon.cloneNode(true));
else icon.textContent=oldIcon?.textContent.trim()||icons[path]||(href.includes('#home')?'⌕':item.matches('[data-audio-reset],#homeMenuAudioReset')?'↻':'↻');
const span=document.createElement('span');span.className='menu-item-label';
const title=document.createElement('span');title.className='menu-item-title';title.textContent=text;
span.append(title);
item.replaceChildren(icon,span);
});
});
},{once:true});

/* Prefer text glyphs for button symbols on iOS, including dynamically added controls. */
(()=>{const symbols=/[\u2190-\u21ff\u2300-\u23ff\u2600-\u27bf\u2b00-\u2bff\u{1f300}-\u{1faff}]/gu;
function scan(){document.querySelectorAll('button,a.button,.top-menu-button,.custom-titlebar-link').forEach(button=>{const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.parentElement.closest('svg,style,script'))continue;const old=node.nodeValue;const next=old.replace(/\ufe0f/g,'').replace(symbols,'$&\ufe0e').replace(/\ufe0e+/g,'\ufe0e');if(next!==old)node.nodeValue=next}})}
let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;scan()})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true})},{once:true});else{scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true})}})();

(()=>{const gear='<svg class="settings-gear-icon" aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="m9.5 2-.6 2.4-1.4.8-2.4-.7-2.5 4.3 1.8 1.7v1.6l-1.8 1.7 2.5 4.3 2.4-.7 1.4.8.6 2.4h5l.6-2.4 1.4-.8 2.4.7 2.5-4.3-1.8-1.7v-1.6l1.8-1.7-2.5-4.3-2.4.7-1.4-.8L14.5 2zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8" fill-rule="evenodd"/></svg>';
function scan(){document.querySelectorAll('button,a').forEach(button=>{const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);const nodes=[];let n;while(n=walker.nextNode())if(!n.parentElement.closest('svg,script,style')&&n.nodeValue.includes('⚙'))nodes.push(n);for(const node of nodes){const parts=node.nodeValue.split(/⚙[\ufe0e\ufe0f]*/u),fragment=document.createDocumentFragment();parts.forEach((part,i)=>{if(i){const span=document.createElement('span');span.className='settings-gear-wrap';span.innerHTML=gear;fragment.append(span)}fragment.append(document.createTextNode(part))});node.replaceWith(fragment)}})}let pending=false;function schedule(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;scan()})}window.addEventListener('load',()=>{scan();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true})},{once:true})})();
