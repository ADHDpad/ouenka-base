(()=>{'use strict';
const core=window.OuenkaMedleyCore;if(!core||core.loadingDialogInstalled)return;
// 1-9 already owns the same dialog and its loading lifecycle.
if(/(?:^|\/)1-9\.html$/.test(location.pathname))return;
core.loadingDialogInstalled=true;
let serial=0;
function openLoading(total){
 const token=++serial;let dismissed=false;
 let dialog=document.getElementById('audioLoadingMessage');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='audioLoadingMessage';dialog.style.cssText='width:min(88vw,420px);padding:24px;border:0;border-radius:16px;box-sizing:border-box;text-align:center';dialog.innerHTML='<h2 style="margin:0 0 16px">音源読み込み</h2><p role="status" aria-live="polite"></p><button type="button" style="min-height:44px;padding:8px 24px">閉じる</button>';document.body.append(dialog)}
 const dismiss=()=>{dismissed=true;dialog.close()};
 dialog.querySelector('button').onclick=dismiss;
 const cancel=()=>{dismissed=true};dialog.addEventListener('cancel',cancel);
 function update(loaded,count){if(token!==serial||dismissed)return;dialog.querySelector('p').textContent='音源を読み込み中… '+loaded+' / '+count;if(!dialog.open)dialog.showModal()}
 update(0,total);
 return {update,close(){dialog.removeEventListener('cancel',cancel);if(token===serial)dialog.close()}};
}
const original=core.build;
core.build=async function(ctx,items,options={}){
 if(!items.length)return original.call(this,ctx,items,options);
 const loading=openLoading(items.length);
 try{return await original.call(this,ctx,items,{...options,onProgress(loaded,total){loading.update(loaded,total);options.onProgress?.(loaded,total)}})}
 finally{loading.close()}
};
})();
