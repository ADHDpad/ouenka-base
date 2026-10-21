/* Diagnostics only: preserve native promises and playback values. */
(()=>{'use strict';
 if(window.__ouenkaDiagnosticInstalled)return;window.__ouenkaDiagnosticInstalled=true;
 const BUILD='20261022-r176',started=performance.now(),logs=[],contexts=new Map(),pending=new Map();
 let button,panel,output,ready=false,wanted=false,loadingTimer=null,lastStatus='';
 const short=e=>String(e?.message||e).slice(0,500),stamp=()=>((performance.now()-started)/1000).toFixed(2)+'s';
 function log(message){logs.push(stamp()+' '+message);if(logs.length>250)logs.shift();if(panel?.open&&document.activeElement!==output)output.value=report()}
 window.__ouenkaDiagnosticLog=log;
 function standalone(){return navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true}
 function safeUrl(input){try{const u=new URL(input,location.href);for(const k of [...u.searchParams.keys()])if(!['q','from','v'].includes(k))u.searchParams.set(k,'[redacted]');return u.origin+u.pathname+u.search}catch{return String(input).slice(0,180)}}
 function report(){
  let recovery='unavailable';try{recovery=JSON.stringify(window.ouenkaAudioRecovery?.diagnostics()||'unavailable')}catch(e){recovery=short(e)}
  const scripts=[...document.scripts].map(s=>s.src).filter(s=>/audio-recovery|pwa-diagnostic|player\.js|active-roster|ouenka-audio-transfer/.test(s)).map(safeUrl);
  return ['OUENKA AUDIO DIAGNOSTIC '+BUILD,'URL='+safeUrl(location.href),'standalone='+standalone(),'UA='+navigator.userAgent,'visibility='+document.visibilityState,'secure='+Boolean(window.isSecureContext),'audioSession='+JSON.stringify({type:navigator.audioSession?.type,state:navigator.audioSession?.state}),'engine='+recovery,'status='+lastStatus,'scripts='+scripts.join(' | '),...Array.from(contexts,([ctx,id])=>'CONTEXT '+id+' state='+ctx.state+' currentTime='+ctx.currentTime+' sampleRate='+ctx.sampleRate),...Array.from(pending,([id,value])=>'PENDING '+id+' '+((performance.now()-value.at)/1000).toFixed(2)+'s '+value.url),'--- LOG ---',...logs].join('\n');
 }
 function playbackHealthy(){const current=window.OuenkaTransport?.state?.();return window.OuenkaTransport?.healthy?.()===true||!!(current?.playing&&current.currentTime>0)}
 function hideAuto(){wanted=false;clearTimeout(loadingTimer);if(button)button.hidden=true}
 function reveal(reason){if(reason!=='手動'&&(playbackHealthy()||window.OuenkaTransport?.paused?.())){hideAuto();return}wanted=true;if(button)button.hidden=false;log('DIAGNOSTIC AVAILABLE '+reason)}
 function track(ctx){if(!contexts.has(ctx)){if(contexts.size>=10)contexts.delete(contexts.keys().next().value);const id='c'+(contexts.size+1);contexts.set(ctx,id);ctx.addEventListener?.('statechange',()=>log('CONTEXT STATE '+id+' '+ctx.state+' time='+ctx.currentTime))}return contexts.get(ctx)}
 function observePromise(p,yes,no){if(p&&typeof p.then==='function')p.then(yes,no)}
 const originalFetch=window.fetch?.bind(window);
 if(originalFetch)window.fetch=function(input,init){
  const url=safeUrl(typeof input==='string'?input:input?.url||String(input)),id=Math.random().toString(36).slice(2,7);log('FETCH START '+id+' '+url);pending.set(id,{url,at:performance.now()});
  let p;try{p=originalFetch(input,init)}catch(e){pending.delete(id);log('FETCH THROW '+id+' '+short(e));throw e}
  observePromise(p,response=>{pending.delete(id);log('FETCH HEADERS '+id+' '+response.status+' '+url);
   for(const method of ['arrayBuffer','json'])if(typeof response[method]==='function'){const original=response[method].bind(response);try{response[method]=function(...args){log('BODY START '+id+' '+method);const result=original(...args);observePromise(result,value=>log('BODY DONE '+id+(method==='arrayBuffer'?' '+value.byteLength+' bytes':'')),e=>log('BODY ERROR '+id+' '+short(e)));return result}}catch(_){}}
  },e=>{pending.delete(id);log('FETCH ERROR '+id+' '+short(e))});return p;
 };
 const wrapped=new WeakSet();for(const Ctor of [window.AudioContext,window.webkitAudioContext]){const proto=Ctor?.prototype;if(!proto||wrapped.has(proto))continue;wrapped.add(proto);
  for(const method of ['resume','decodeAudioData']){const original=proto[method];if(typeof original!=='function')continue;try{proto[method]=function(...args){const id=track(this);log((method==='resume'?'CONTEXT RESUME ':'DECODE START ')+id+' '+this.state+(method==='decodeAudioData'?' '+(args[0]?.byteLength||0)+' bytes':''));let p;try{p=original.apply(this,args)}catch(e){log(method+' THROW '+id+' '+short(e));throw e}let settled=false;observePromise(p,()=>{settled=true;log((method==='resume'?'CONTEXT RESUMED ':'DECODE DONE ')+id+' '+this.state)},e=>{settled=true;log(method+' ERROR '+id+' '+short(e))});if(method==='resume')setTimeout(()=>{if(!settled&&this.state!=='running'&&this.state!=='closed'&&!document.hidden)reveal('音声の起動待ち '+id)},1800);return p}}catch(e){log('HOOK ERROR '+method+' '+short(e))}}
 }
 function inspectStatus(){
  if(playbackHealthy()||window.OuenkaTransport?.paused?.()){hideAuto();return}
  const text=['nowPlaying','status','movieStatus','miniState'].map(id=>document.getElementById(id)?.textContent?.trim()||'').filter(Boolean).join(' / ');if(text===lastStatus)return;lastStatus=text;log('STATUS '+text);clearTimeout(loadingTimer);
  if(/失敗|できません|見つから|起動待ち|エラー|中断/.test(text))reveal('再生状態');
  else if(/検索中|読み込|取得中|準備中|引き継ぎ中/.test(text))loadingTimer=setTimeout(()=>{if(lastStatus===text&&!document.hidden)reveal('読み込みが12秒以上継続')},12000);
 }
 function init(){if(ready)return;ready=true;
  const style=document.createElement('style');style.textContent='.ouenka-diag-trigger{position:fixed;right:12px;bottom:calc(90px + env(safe-area-inset-bottom));z-index:2147483645;background:#0b2f55;color:#fff;border:2px solid #fff;border-radius:10px;padding:11px 16px;font:700 16px system-ui}.ouenka-diag-panel{width:min(850px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:calc(100dvh - 32px);padding:16px;border:2px solid #0b2f55;border-radius:12px;color:#123;background:#fff;overflow:auto}.ouenka-diag-panel::backdrop{background:#071d33aa}.ouenka-diag-panel h2{font:700 19px system-ui}.ouenka-diag-panel button{font:700 16px system-ui;padding:10px;margin:0 8px 8px 0}.ouenka-diag-panel textarea{display:block;width:100%;height:50dvh;min-height:120px;box-sizing:border-box;font:16px monospace;white-space:pre;resize:vertical}.ouenka-diag-panel p{font:14px system-ui}';document.head.append(style);
  button=document.createElement('button');button.type='button';button.id='ouenkaDiagnosticButton';button.className='ouenka-diag-trigger';button.textContent='診断';button.hidden=!wanted;
  panel=document.createElement('dialog');panel.className='ouenka-diag-panel';panel.setAttribute('aria-label','音声再生の診断');
  const title=document.createElement('h2');title.textContent='音声再生の診断';const copy=document.createElement('button');copy.type='button';copy.textContent='診断をコピー';const close=document.createElement('button');close.type='button';close.textContent='閉じる';const hint=document.createElement('p');hint.textContent='コピーした内容をチャットに貼り付けてください。';output=document.createElement('textarea');output.readOnly=true;output.setAttribute('aria-label','診断内容');
  panel.append(title,copy,close,hint,output);document.body.append(button,panel);
  button.onclick=()=>{inspectStatus();output.value=report();if(!panel.open)panel.showModal()};close.onclick=()=>panel.close();
  copy.onclick=async()=>{const value=report();output.value=value;try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(value);hint.textContent='コピーしました。このままチャットに貼り付けてください。'}catch(_){output.focus({preventScroll:true});output.select();output.setSelectionRange(0,output.value.length);let success=false;try{success=document.execCommand('copy')}catch(_){}hint.textContent=success?'コピーしました。このままチャットに貼り付けてください。':'自動コピーできませんでした。選択された診断内容を長押ししてコピーしてください。'}};
  if(window.MutationObserver)new MutationObserver(inspectStatus).observe(document.body,{subtree:true,childList:true,characterData:true});inspectStatus();log('DIAG READY build='+BUILD+' standalone='+standalone());
 }
 window.addEventListener('error',e=>{log('WINDOW ERROR '+short(e.message));reveal('JavaScriptエラー')});window.addEventListener('unhandledrejection',e=>{log('PROMISE ERROR '+short(e.reason));reveal('処理エラー')});document.addEventListener('visibilitychange',()=>log('VISIBILITY '+document.visibilityState));
 setInterval(()=>{if(playbackHealthy()||window.OuenkaTransport?.paused?.())hideAuto()},400);
 window.OuenkaDiagnostics={report,hide:hideAuto,show:()=>{reveal('手動');if(ready)button.click()},inspectStatus};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
