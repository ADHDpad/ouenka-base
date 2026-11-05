(()=>{'use strict';
const paths={
home:'<path d="M3 10 12 3l9 7v11H3z"/>',
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
star:'<path d="m12 2 3.1 6.5 7.2 1-5.2 5.1 1.2 7.2L12 18.4l-6.3 3.4 1.2-7.2-5.2-5.1 7.2-1z"/>',
crown:'<path d="M2 6 7 11l5-8 5 8 5-5-2 14H4z"/>'
};
function svg(name){return '<svg viewBox="0 0 24 24" width="20" height="20" fill="'+(solid[name]?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(solid[name]||paths[name])+'</svg>'}
function init(){
const nav=document.querySelector('#homeMenuDialog nav');if(!nav)return;
if(!nav.querySelector('a[data-home-menu-home]')){const a=document.createElement('a');a.href='index.html';a.dataset.homeMenuHome='1';a.textContent='ホーム';nav.prepend(a)}
nav.querySelectorAll('a,button').forEach(item=>{
const href=item.getAttribute('href')||'',path=href.split('#')[0],label=(item.querySelector('.menu-item-label')?.textContent||item.textContent).trim().replace(/^[★☆♪♫♛▦▤＋+⚙︎️⌂⌕⇄↻⚑✉◀▶▣▧⚄]+\s*/u,'');
let kind='music';
if(item.dataset.homeMenuHome)kind='home';
else if(href.includes('homePlayerSearch'))kind='search';
else if(href.includes('homeTeams'))kind='teams';
else if(path==='favorites.html')kind='star';
else if(path==='stadium.html')kind='flag';
else if(path==='requests.html')kind='mail';
else if(path==='popular.html'||path==='ranking.html')kind='crown';
else if(path==='songbook.html')kind='book';
else if(path==='draft.html')kind='grid';
else if(item.tagName==='BUTTON')kind='reset';
const icon=document.createElement('span');icon.className='menu-item-icon';icon.setAttribute('aria-hidden','true');
if(path==='1-9.html')icon.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="10">1-9</text></svg>';
else if(path==='medley.html')icon.innerHTML=svg('music');
else if(path==='play.html'&&href.includes('quiz'))icon.textContent='♪';
else if(path==='1-9.html')icon.textContent='①';
else if(solid[kind]||paths[kind])icon.innerHTML=svg(kind);
else icon.textContent='♪';
const span=document.createElement('span');span.className='menu-item-label';span.textContent=label;
item.replaceChildren(icon,span);
});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();