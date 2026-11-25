(()=>{'use strict';window.addEventListener('load',()=>{
const main=document.querySelector('main'),header=document.querySelector('body>header');if(!main||!header)return;
const user=document.getElementById('user-settings'),admin=document.getElementById('admin-settings'),dialog=document.getElementById('sharedMenuDialog'),general=document.getElementById('sharedGeneralMenu');
const index=document.createElement('section');index.id='settingsIndex';index.className='settings-index';index.innerHTML='<h2>設定項目一覧</h2><p>変更したい項目を選んでください。</p>';
const review=document.createElement('section');review.id='publicationReviewSettings';review.className='card';review.innerHTML='<h2>公開前チェックリスト</h2><p>登録した応援歌の設定・再生を確認して公開します。</p><a class="settings-data-link" href="publication-review.html">チェックリストを開く ›</a>';admin.append(review);
const groups=[];let count=0;for(const [panel,label]of [[user,'ユーザー向け設定'],[admin,'管理者用設定']]){const items=[];for(const section of panel.querySelectorAll(':scope > section,:scope > .card,:scope > .titlebar-settings')){const title=section.querySelector('h2,.cardhead,h3');if(!title)continue;if(!section.id)section.id='settingsItem'+(++count);items.push({id:section.id,title:title.textContent.trim(),panel})}groups.push({label,items})}
const toolbar=document.createElement('div');toolbar.className='settings-detail-toolbar';toolbar.hidden=true;const back=document.createElement('button');back.type='button';back.textContent='‹ 設定項目一覧';toolbar.append(back);const tabs=main.querySelector('.settings-tabs');tabs.hidden=true;tabs.before(index,toolbar);
function showIndex(){user.hidden=true;admin.hidden=true;index.hidden=false;toolbar.hidden=true;main.querySelector('h1').textContent='設定';if(dialog?.open)dialog.close();index.scrollIntoView({block:'start'});index.tabIndex=-1;index.focus({preventScroll:true})}
const gate=document.createElement('dialog');
gate.id='adminPasswordDialog';gate.className='creator-auth-dialog';
gate.setAttribute('aria-labelledby','adminPasswordTitle');
gate.innerHTML='<form class="creator-login"><h2 id="adminPasswordTitle">CREATOR LOGIN</h2><p>応援歌BASE 作成者専用画面</p><input id="adminPassword" type="password" autocomplete="current-password" placeholder="作成者用パスワード" aria-label="作成者用パスワード" required><button type="submit">作成者画面を開く</button><div class="creator-auth-error" id="adminPasswordError" role="alert"></div><button class="creator-back" type="button">◀戻る</button></form>';
document.body.append(gate);
const password=gate.querySelector('input'),error=gate.querySelector('[role="alert"]');
let pendingItem=null;
gate.querySelector('.creator-back').onclick=()=>gate.close();
gate.addEventListener('close',()=>{if(!gate.open)pendingItem=null});
gate.querySelector('form').onsubmit=event=>{
 event.preventDefault();
 if(!window.OuenkaCreatorPassword?.matches(password.value)){
  error.textContent='パスワードが違います。';
  password.select();
  return;
 }
 const item=pendingItem;
 gate.close();
 if(item)openItem(item);
};
function jump(item){
 if(item.panel!==admin||!admin.hidden){openItem(item);return}
 pendingItem=item;
 if(!gate.open){password.value='';error.textContent='';gate.showModal();password.focus()}
}
function openItem(item){index.hidden=true;toolbar.hidden=false;main.querySelector('h1').textContent=item.title;for(const panel of [user,admin]){panel.hidden=panel!==item.panel;for(const node of panel.children){if(node.tagName==='SCRIPT')continue;node.hidden=node!==document.getElementById(item.id)}}
// The team-order save actions are siblings of its card in the original page.
if(document.getElementById(item.id).contains(document.getElementById('teamList')))for(const id of ['reset','save'])document.getElementById(id).hidden=false;
if(dialog?.open)dialog.close();requestAnimationFrame(()=>{toolbar.scrollIntoView({block:'start'});const target=document.getElementById(item.id);target.tabIndex=-1;target.focus({preventScroll:true})})}
back.onclick=showIndex;
function list(destination){for(const group of groups){const h=document.createElement('h3');h.textContent=group.label;destination.append(h);const nav=document.createElement('nav');nav.setAttribute('aria-label',group.label+'の項目');for(const item of group.items){const b=document.createElement('button');b.type='button';const title=document.createElement('span');title.textContent=item.title;const arrow=document.createElement('span');arrow.textContent='›';arrow.setAttribute('aria-hidden','true');b.append(title,arrow);b.onclick=()=>jump(item);nav.append(b)}destination.append(nav)}}
list(index);const data=document.createElement('a');data.className='settings-data-link';data.href='save.html';data.textContent='データ登録・編集を開く ›';index.append(data);
if(dialog&&general){const specific=document.createElement('section');specific.id='sharedSpecificMenu';specific.setAttribute('role','tabpanel');specific.setAttribute('aria-labelledby','settingsMenuTab1');const all=document.createElement('button');all.type='button';all.className='settings-index-all';all.textContent='設定項目一覧';all.onclick=showIndex;specific.append(all);list(specific);dialog.append(specific);general.setAttribute('role','tabpanel');general.setAttribute('aria-labelledby','settingsMenuTab0');const menuTabs=document.createElement('div');menuTabs.className='shared-menu-tabs';menuTabs.setAttribute('role','tablist');menuTabs.setAttribute('aria-label','メニューの種類');function select(n){[general,specific].forEach((panel,i)=>{panel.hidden=i!==n;menuTabs.children[i].setAttribute('aria-selected',String(i===n));menuTabs.children[i].tabIndex=i===n?0:-1})}for(const [n,label]of [[0,'通常メニュー'],[1,'設定メニュー']]){const b=document.createElement('button');b.type='button';b.id='settingsMenuTab'+n;b.textContent=label;b.setAttribute('role','tab');b.setAttribute('aria-controls',n?specific.id:general.id);b.onclick=()=>select(n);menuTabs.append(b)}menuTabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?1:general.hidden?0:1;select(n);menuTabs.children[n].focus()};dialog.querySelector('.lineup-menu-heading').after(menuTabs);select(1)}
// Existing category tabs still drive internal panel setup, but are replaced by the item index.
function hashItem(){
 const id=location.hash.slice(1);
 return id==='admin'?groups[1].items[0]:groups.flatMap(g=>g.items).find(x=>x.id===id);
}
window.addEventListener('hashchange',()=>{
 if(gate.open)gate.close();
 const item=hashItem();
 if(item)jump(item);else showIndex();
});
user.hidden=true;
admin.hidden=true;
const initial=hashItem();
if(initial)jump(initial);
});})();
