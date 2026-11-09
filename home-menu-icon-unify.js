(()=>{'use strict';
const paths={
back:'<path d="m12 5-7 7 7 7M5 12h15"/>',
save:'<path d="M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7"/>',
load:'<path d="M3 7V4h7l3 3h8v13H3zM12 10v6m-3-3 3 3 3-3"/>',
image:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="8" r="1"/>',
share:'<path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4"/>',
random:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h.1m4.9 5h.1m4.9 5h.1"/>',
plus:'<path d="M12 4v16M4 12h16"/>',
home:'<path d="M3 10l9-7 9 7v11H3z"/>',
search:'<path d="m3 10 9-7 9 7v11H3z"/>',
teams:'<path d="m3 10 9-7 9 7v11H3z"/>',
flag:'<path d="M5 3v19M5 4c5-3 8 3 14 0v10c-6 3-9-3-14 0"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 7 9-7"/>',
music:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="19" rx="3" ry="2"/><ellipse cx="18" cy="17" rx="3" ry="2"/>',
book:'<path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1zM12 6v15"/>',
grid:'<rect x="3" y="4" width="18" height="17" rx="1"/><path d="M3 9h18M8 4v17M13 4v17M18 4v17"/>',
reset:'<path d="M4 11a8 8 0 1 1 2 6M4 4v7h7"/>'
};
const solid={
settings:'<path d="M9.5 2h5l.6 2.5 1.5.9 2.5-.7 2.5 4.3-1.9 1.8v2.4l1.9 1.8-2.5 4.3-2.5-.7-1.5.9-.6 2.5h-5l-.6-2.5-1.5-.9-2.5.7-2.5-4.3 1.9-1.8v-2.4L2.4 9l2.5-4.3 2.5.7 1.5-.9zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill-rule="evenodd"/>',
star:'<path d="m12 2 3.1 6.5 7.2 1-5.2 5.1 1.2 7.2L12 18.4l-6.3 3.4 1.2-7.2-5.2-5.1 7.2-1z"/>',
crown:'<path d="M2 6 7 11l5-8 5 8 5-5-2 14H4z"/>'
};
function svg(name){return '<svg viewBox="0 0 24 24" width="20" height="20" fill="'+(solid[name]?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(solid[name]||paths[name])+'</svg>'}
const pageIcons={
 'index.html':'home','favorites.html':'star','stadium.html':'flag',
 'requests.html':'mail','play.html':'music','medley.html':'music',
 'popular.html':'crown','ranking.html':'crown','songbook.html':'book',
 'draft.html':'grid','save.html':'plus','settings.html':'settings'
};
const actionIcons={'◀':'back','▣':'save','▤':'load','▧':'image','＋':'plus','⇄':'share','⚄':'random','⚙':'settings'};
const lineupIcon='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="10">1-9</text></svg>';

function decorate(nav){
 for(const item of nav.querySelectorAll('a,button')){
  if(item.querySelector('.menu-item-label'))continue;
  const href=item.getAttribute('href')||'';
  const path=href.split(/[?#]/)[0];
  const oldIcon=item.querySelector('.menu-action-icon,.lineup-box-icon,svg');
  const oldText=oldIcon?.textContent.trim();
  let label=item.textContent.trim();
  if(oldText&&label.startsWith(oldText))label=label.slice(oldText.length).trim();
  label=label.replace(/^[★☆♪♫♛▦▤＋+⚙︎️⌂⌕⇄↻⚑✉◀▶▣▧⚄]+\s*/u,'');

  const icon=document.createElement('span');
  icon.className='menu-item-icon';
  icon.setAttribute('aria-hidden','true');
  if(path==='1-9.html'){
   icon.innerHTML=lineupIcon;
  }else{
   const kind=href.endsWith('#homePlayerSearch')?'search'
    :href.endsWith('#homeTeams')?'teams'
    :item.matches('#homeMenuAudioReset,#homeMenuUpdate,[data-audio-reset],[data-site-update]')?'reset'
    :pageIcons[path]||actionIcons[oldText?.[0]];
   if(kind)icon.innerHTML=svg(kind);
   else icon.textContent=oldText||'›';
  }
  const text=document.createElement('span');
  text.className='menu-item-label';
  const title=document.createElement('span');
  title.className='menu-item-title';
  title.textContent=label;
  text.append(title);
  item.replaceChildren(icon,text);
 }
}
window.OuenkaMenuIcons={decorate};

function setupHomeMenu(){
 const nav=document.querySelector('#homeMenuDialog nav');
 if(!nav)return;
 if(!nav.querySelector('a[href="index.html"]')){
  const home=document.createElement('a');
  home.href='index.html';
  home.textContent='ホーム';
  nav.prepend(home);
 }
 decorate(nav);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupHomeMenu,{once:true});
else setupHomeMenu();
})();
