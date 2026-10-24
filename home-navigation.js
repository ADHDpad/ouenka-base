(()=>{'use strict';const button=document.getElementById('homeMenuButton'),dialog=document.getElementById('homeMenuDialog');if(!button||!dialog)return;
let closing=null;
function close(){
 if(!dialog.open)return Promise.resolve();
 if(closing)return closing;
 dialog.classList.add('menu-closing');
 closing=new Promise(resolve=>{let done=false,timer;const finish=()=>{if(done)return;done=true;clearTimeout(timer);dialog.removeEventListener('animationend',ended);dialog.close();dialog.classList.remove('menu-closing');closing=null;resolve()};const ended=e=>{if(e.target===dialog&&e.animationName==='menu-exit')finish()};dialog.addEventListener('animationend',ended);timer=setTimeout(finish,matchMedia('(prefers-reduced-motion: reduce)').matches?0:240)});
 return closing;
}
let replaying=false;
dialog.addEventListener('click',e=>{
 if(replaying)return;
 const rect=dialog.getBoundingClientRect();
 const outside=e.target===dialog&&(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom);
 const action=e.target.closest('a,#homeMenuUpdate');
 if(outside||e.target.closest('#homeMenuClose')||action){e.preventDefault();e.stopImmediatePropagation();close().then(()=>{if(action){replaying=true;try{action.click()}finally{replaying=false}}})}
},true);
dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
button.addEventListener('click',()=>{if(dialog.open){close();return}dialog.showModal();button.setAttribute('aria-expanded','true');document.body.classList.add('home-menu-open')});
dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');document.body.classList.remove('home-menu-open')});
document.getElementById('homeMenuClose').addEventListener('click',close);
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();return}if(event.target.closest('a'))close()});
document.getElementById('homeMenuUpdate').addEventListener('click',()=>{close();window.updateApp?.()});
})();
