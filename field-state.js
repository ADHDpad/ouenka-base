/* Give empty and completed entry fields the same appearance on every page. */
(()=>{'use strict';
const excluded=new Set(['hidden','button','submit','reset','image','checkbox','radio','range','color']);
const eligible=e=>e.matches('textarea,select')||e.matches('input')&&!excluded.has(e.type);
const state=e=>e.type==='file'?(e.files?.length?'filled':'empty'):(String(e.value??'').trim()?'filled':'empty');
function paint(e){if(!eligible(e))return;const next=state(e);if(e.dataset.entryState===next)return;e.dataset.entryState=next;e.style.setProperty('background',next==='empty'?'#dff3ff':'#ffffff','important');e.style.setProperty('color','#15384f','important');e.style.setProperty('-webkit-text-fill-color','#15384f','important')}
function scan(){document.querySelectorAll('input,textarea,select').forEach(paint)}
function start(){scan();document.addEventListener('input',e=>paint(e.target),true);document.addEventListener('change',e=>paint(e.target),true);document.addEventListener('reset',()=>setTimeout(scan,0),true);document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()});new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});setInterval(()=>{if(!document.hidden)scan()},800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
