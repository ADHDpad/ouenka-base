(()=>{'use strict';
const KEY='ouenkaTitlebarV1';
const items=[['favorites','お気に入り','favorites.html','★'],['lineup','1-9','1-9.html','1-9'],['medley','メドレー','medley.html','♫'],['popular','人気ランキング','popular.html','♛'],['quiz','応援歌クイズ','play.html#quiz','♪'],['lyricsquiz','歌詞クイズ','play.html#lyricsquiz','▤'],['draft','応援歌ドラフト','draft.html','▦'],['ranking','即興ランキング','ranking.html','♛'],['songbook','応援歌図鑑','songbook.html','▤'],['phrases','歌詞フレーズ検索','phrases.html','⌕'],['stadium','球場モード','stadium.html','⚑'],['requests','リクエスト箱','requests.html','✉'],['save','データ登録','save.html','＋'],['settings','設定','settings.html','⚙']];
const defaults=items.filter(i=>i[0]!=='lyricsquiz').map(i=>i[0]);
function read(){try{const a=JSON.parse(localStorage.getItem(KEY));return Array.isArray(a)?[...new Set(a.filter(id=>items.some(i=>i[0]===id)))]:null}catch{return null}}
function link(id){const item=items.find(i=>i[0]===id),a=document.createElement('a');a.className='custom-titlebar-link';a.href=item[2];const icon=document.createElement('span');icon.className='custom-titlebar-icon';icon.textContent=item[3];icon.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent=item[1];a.append(icon,label);return a}
function apply(){const ids=read(),home=document.getElementById('homeMenuButton'),header=document.querySelector('body>header,body>.toolbar');if(!header||header.dataset.titlebarCustom==='off')return;
let nav=header.querySelector('.custom-titlebar-links');if(nav)nav.remove();
const homeActions=home?header.querySelector('.top-actions'):null;if(homeActions)homeActions.hidden=ids!==null;
if(ids===null||ids.length===0)return;nav=document.createElement('nav');nav.className='custom-titlebar-links';nav.setAttribute('aria-label','選択したタイトルバー項目');for(const id of ids)nav.append(link(id));header.append(nav);
}
function setupSettings(){const main=document.querySelector('main'),h1=main.querySelector('h1');
const tabs=document.createElement('div');tabs.className='settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','設定の種類');
const user=document.createElement('section'),admin=document.createElement('section');user.id='user-settings';admin.id='admin-settings';user.setAttribute('role','tabpanel');admin.setAttribute('role','tabpanel');user.setAttribute('aria-labelledby','user-settings-tab');admin.setAttribute('aria-labelledby','admin-settings-tab');
for(const node of [...main.children])if(node!==h1&&!node.matches('.desc,script'))user.append(node);
for(const id of ['audioResetButton']){const node=document.getElementById(id);if(node)user.append(node.closest('section'))}
for(const id of ['adminQuizSettings','adminCommunitySettings']){const node=document.getElementById(id);if(node)admin.append(node)}
const adminIntro=document.createElement('p');adminIntro.textContent='応援歌データやクイズの出題情報、オンライン機能の接続先を管理します。';admin.prepend(adminIntro);
const data=document.createElement('a');data.className='settings-data-link';data.href='save.html';data.textContent='データ登録・編集を開く';adminIntro.after(data);
for(const [key,label,panel] of [['user','ユーザー向け設定',user],['admin','管理者用設定',admin]]){const b=document.createElement('button');b.type='button';b.id=key+'-settings-tab';b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.onclick=()=>{location.hash=key;show()};tabs.append(b)}
function show(){const isAdmin=location.hash==='#admin';user.hidden=isAdmin;admin.hidden=!isAdmin;[...tabs.children].forEach((b,i)=>{const selected=i===(isAdmin?1:0);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1})}
tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:location.hash==='#admin'?0:1;tabs.children[next].click();tabs.children[next].focus()};
main.append(tabs,user,admin);window.addEventListener('hashchange',show);show();
const card=document.createElement('section');card.className='card titlebar-settings';card.innerHTML='<div class="cardhead">メニューバーに表示するボタン</div><div class="share-body"><p>使う項目にチェックを付け、↑↓で表示順を変更できます。ホームでは選んだ項目だけを表示し、各画面にも同じショートカットを表示します。</p><p>各画面の操作ボタンと戻るボタンは、そのまま使えます。</p><ul id="titlebarChoices"></ul><div class="actions"><button type="button" class="reset" id="titlebarReset">標準に戻す</button><button type="button" class="save" id="titlebarSave">表示項目を保存</button></div><p id="titlebarStatus" role="status" aria-live="polite"></p></div>';
user.prepend(card);const list=card.querySelector('ul'),status=card.querySelector('#titlebarStatus');let chosen=read()||[...defaults],order=[...chosen,...items.map(i=>i[0]).filter(id=>!chosen.includes(id))];
function render(){list.replaceChildren();for(const [index,id] of order.entries()){const item=items.find(i=>i[0]===id),row=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=chosen.includes(id);check.onchange=()=>{chosen=check.checked?[...chosen,id]:chosen.filter(x=>x!==id);status.textContent='未保存の変更があります。'};label.append(check,document.createTextNode(item[1]));row.append(label);for(const [dir,text] of [[-1,'↑'],[1,'↓']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=index+dir<0||index+dir>=order.length;b.setAttribute('aria-label',item[1]+'を'+(dir<0?'上':'下')+'へ移動');b.onclick=()=>{[order[index],order[index+dir]]=[order[index+dir],order[index]];render();list.children[index+dir].querySelectorAll('button')[dir<0?0:1].focus();status.textContent='未保存の変更があります。'};row.append(b)}list.append(row)}}
card.querySelector('#titlebarSave').onclick=()=>{try{localStorage.setItem(KEY,JSON.stringify(order.filter(id=>chosen.includes(id))));apply();status.textContent='表示項目と順番を保存しました。この端末の各画面に反映します。'}catch{status.textContent='保存できませんでした。'}};
card.querySelector('#titlebarReset').onclick=()=>{try{localStorage.removeItem(KEY);chosen=[...defaults];order=items.map(i=>i[0]);render();apply();status.textContent='標準の表示項目に戻しました。'}catch{status.textContent='設定を戻せませんでした。'}};render();
}
function init(){if(document.getElementById('siteThemeSettings')&&document.getElementById('teamList'))setupSettings();apply()}
window.addEventListener('storage',e=>{if(e.key===KEY)apply()});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
