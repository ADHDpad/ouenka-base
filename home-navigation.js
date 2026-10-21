(()=>{'use strict';const button=document.getElementById('homeMenuButton'),dialog=document.getElementById('homeMenuDialog');if(!button||!dialog)return;
function close(){dialog.close()}
button.addEventListener('click',()=>{if(dialog.open){close();return}dialog.showModal();button.setAttribute('aria-expanded','true');document.body.classList.add('home-menu-open')});
dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');document.body.classList.remove('home-menu-open')});
document.getElementById('homeMenuClose').addEventListener('click',close);
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();return}if(event.target.closest('a'))close()});
document.getElementById('homeMenuUpdate').addEventListener('click',()=>{close();window.updateApp?.()});
})();
