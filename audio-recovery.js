/* OUENKA BASE: iOS audio-session recovery. Does not alter mixing/playback algorithms. */
(function(){
 'use strict';
 let lastError='';
 // iOS Safari: playback audio session may bypass the hardware silent switch.
 // Unsupported browsers safely ignore this setting.
 function configureSession(){
   try { if(navigator.audioSession && 'type' in navigator.audioSession) navigator.audioSession.type='playback'; }
   catch(e){console.warn('audioSession playback not supported',e)}
 }
 configureSession();
 const contexts=new Set();
 const deliberatelyPaused=new WeakSet();
 let pendingGestureContext=null;
 let retryButton=null;
 let recoveryNeeded=false;
 let retryCallback=null;
 let retryContext=null;
 // iPhone Home Screen WebKit can leave the media route inactive after another app.
 // Prime that route with a short silent WAV within the same user gesture; song PCM is untouched.
 const mediaWakes=new Map();
 function isIPhoneHomeApp(){return /iPhone/i.test(navigator.userAgent||'')&&(navigator.standalone===true||window.matchMedia?.('(display-mode: standalone)').matches===true)}
 function wakeMediaRoute(ctx){
   if(!isIPhoneHomeApp()||navigator.userActivation?.isActive===false||mediaWakes.has(ctx)||!window.URL?.createObjectURL)return;
   const rate=8000,length=640,bytes=new ArrayBuffer(44+length*2),v=new DataView(bytes),tag=(offset,text)=>{for(let i=0;i<text.length;i++)v.setUint8(offset+i,text.charCodeAt(i))};
   tag(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,length*2,true);
   const audio=document.createElement('audio'),url=window.URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));
   audio.src=url;audio.preload='auto';audio.playsInline=true;audio.muted=false;audio.volume=1;audio.setAttribute('aria-hidden','true');audio.style.cssText='position:fixed;width:1px;height:1px;left:-10px;bottom:0;pointer-events:none';
   let timer;const cleanup=()=>{clearTimeout(timer);if(mediaWakes.get(ctx)!==cleanup)return;mediaWakes.delete(ctx);try{audio.pause();audio.removeAttribute('src');audio.load();audio.remove()}catch(_){}window.URL.revokeObjectURL(url)};
   const retryResume=()=>{if(ctx.state!=='closed'&&ctx.state!=='running'&&!deliberatelyPaused.has(ctx)){try{ctx.resume().catch(e=>{lastError=String(e)})}catch(e){lastError=String(e)}}};
   mediaWakes.set(ctx,cleanup);audio.addEventListener('ended',()=>{retryResume();cleanup()},{once:true});audio.addEventListener('error',cleanup,{once:true});document.body?.appendChild(audio);timer=setTimeout(cleanup,2000);
   try{const started=audio.play();started?.then(retryResume).catch(e=>{lastError=String(e);cleanup()})}catch(e){lastError=String(e);cleanup()}
 }
 function state(){return [...contexts].map(c=>c.state).join(', ')||'なし'}
 function makeContext(){
   configureSession();
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)throw new Error('このブラウザはWeb Audioに対応していません');
   const ctx=new AC();contexts.add(ctx);
   const suspend=ctx.suspend?.bind(ctx),resume=ctx.resume.bind(ctx);
   if(suspend)ctx.suspend=function(){deliberatelyPaused.add(ctx);try{return suspend().catch(e=>{deliberatelyPaused.delete(ctx);throw e})}catch(e){deliberatelyPaused.delete(ctx);throw e}};
   ctx.resume=function(){deliberatelyPaused.delete(ctx);return resume()};
   const close=ctx.close.bind(ctx);
   ctx.close=function(){mediaWakes.get(ctx)?.();contexts.delete(ctx);return close()};
   return ctx;
 }
 // iPhone standalone can leave resume() pending for ~60 seconds even after a tap.
 // Kick off unlocking inside the user gesture, but never await its promise before fetching audio.
 function gesturePrepare(){
   // Run directly in a trusted pointer/click event, before any asynchronous lookup.
   if(pendingGestureContext && pendingGestureContext.state!=='closed'){unlock(pendingGestureContext);return pendingGestureContext;}
   // Search during playback must not open a competing audio session.
   if([...contexts].some(c=>c.state!=='closed'))return null;
   pendingGestureContext=create();
   return pendingGestureContext;
 }
 function consumeGestureContext(){
   const ctx=pendingGestureContext;
   pendingGestureContext=null;
   return ctx&&ctx.state!=='closed'?ctx:create();
 }
 function unlock(ctx){
   configureSession();
   if(!ctx||ctx.state==='closed')throw new Error('音声エンジンが終了しています');
   try{
     const buffer=ctx.createBuffer(1,Math.max(1,Math.round(ctx.sampleRate*.08)),ctx.sampleRate);
     const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
     source.start(0);
     if(ctx.state!=='running'){
       const pending=ctx.resume();
       if(pending&&typeof pending.catch==='function')pending.catch(e=>{lastError=String(e);console.warn('AudioContext resume:',e)});
     }
   }catch(e){lastError=String(e);throw e}
   return ctx;
 }
 // Deliberately not async: calling create() must not yield before initiating resume().
 function create(){const ctx=makeContext();try{wakeMediaRoute(ctx);return unlock(ctx)}catch(e){try{ctx.close()}catch(_){}throw e}}
 // Only an explicit recovery tap releases a stuck session. Never reset a healthy player.
 function recreate(ctx){
   pendingGestureContext=null;
   try{ctx.close().catch(e=>{lastError=String(e)})}catch(e){lastError=String(e)}
   if(isIPhoneHomeApp()){
     try{if(navigator.audioSession)navigator.audioSession.type='auto'}catch(e){lastError=String(e)}
   }
   return create();
 }
 // Explicit second user gesture if standalone WebKit defers resume() indefinitely.
 function showRetry(ctx, retryPlayback){
   if(!ctx || ctx.state==='running' || ctx.state==='closed'||deliberatelyPaused.has(ctx)||window.OuenkaTransport?.healthy?.()){hideRetry();return;}
   retryContext=ctx;recoveryNeeded=true;retryCallback=typeof retryPlayback==='function'?retryPlayback:null;
   if(!retryButton){
     retryButton=document.createElement('button');
     retryButton.type='button';retryButton.textContent='▶ 音声を再起動';
     retryButton.style.cssText='position:fixed;bottom:82px;left:50%;transform:translateX(-50%);z-index:2147483645;background:#0b2f55;color:white;border:2px solid white;border-radius:14px;padding:13px 24px;font-size:17px;font-weight:bold;box-shadow:0 3px 15px #0006';
     document.body.appendChild(retryButton);
   }
   retryButton.hidden=false;
   retryButton.onclick=()=>{
     // An iOS audio interruption can leave the old context permanently suspended.
     // Retry with a NEW context inside this exact user gesture (not after await).
     if(typeof retryPlayback==='function'){
       try{
         const fresh=recreate(ctx);
         retryButton.hidden=true;recoveryNeeded=false;
         Promise.resolve(retryPlayback(fresh)).catch(e=>{lastError=String(e);showRetry(fresh,retryPlayback)});
       }catch(e){lastError=String(e);retryButton.hidden=false}
     }else{
       try{unlock(ctx)}catch(e){console.warn('再起動',e)}
       const p=ctx.resume();if(p&&p.catch)p.catch(e=>console.warn('再開失敗',e));
       if(ctx.state==='running')retryButton.hidden=true;
     }
   };
   const onstate=()=>{if(ctx.state==='running'||ctx.state==='closed'){if(retryContext===ctx)hideRetry();ctx.removeEventListener('statechange',onstate)}};
   ctx.addEventListener('statechange',onstate);
 }
 function hideRetry(){retryContext=null;recoveryNeeded=false;retryCallback=null;if(retryButton)retryButton.hidden=true}

 // Include WebKit's interrupted state after another app takes the audio session.
 async function resumeExisting(){
   configureSession();
   const list=[...contexts].filter(c=>c.state!=='running'&&c.state!=='closed'&&!deliberatelyPaused.has(c));
   return Promise.allSettled(list.map(c=>{
     try{unlock(c);return Promise.race([c.resume(),new Promise(resolve=>setTimeout(resolve,1200))])}
     catch(e){lastError=String(e);return Promise.reject(e)}
   }));
 }

 async function reset(){
   // Do not close contexts of currently playing songs: reset is explicitly user-invoked.
   try{if(typeof window.stopCurrentSong==='function')window.stopCurrentSong()}catch(_){}
   try{if(typeof window.stopOneNineMedley==='function')window.stopOneNineMedley()}catch(_){}
   try{if(typeof window.stopRowAudio==='function')window.stopRowAudio()}catch(_){}
   try{if(typeof window.stopAudio==='function')window.stopAudio()}catch(_){}
   // Release old contexts and prime the replacement before leaving the reset tap.
   const old=[...contexts];pendingGestureContext=null;
   for(const c of old){try{c.close().catch(e=>{lastError=String(e)})}catch(e){lastError=String(e)}}
   if(isIPhoneHomeApp()){try{if(navigator.audioSession)navigator.audioSession.type='auto'}catch(e){lastError=String(e)}}
   const ctx=create();pendingGestureContext=ctx;
   await Promise.race([ctx.resume().catch(e=>{lastError=String(e)}),new Promise(resolve=>setTimeout(resolve,1200))]);
   if(ctx.state==='running'){lastError='';return '音声エンジンが起動しました。曲の再生ボタンを押してください。'}
   return '音声エンジンはまだ起動待ちです。曲を選んで再生をお試しください。復旧しない場合はSafariで一度再生してください。';
 }
 window.ouenkaAudioRecovery={create,unlock,gesturePrepare,consumeGestureContext,showRetry,hideRetry,resumeExisting,reset,diagnostics:()=>({build:'20261022-r176',contexts:state(),lastError,visibility:document.visibilityState})};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&pendingGestureContext){const stale=pendingGestureContext;pendingGestureContext=null;try{stale.close().catch(()=>{})}catch(_){}}else if(!document.hidden)resumeExisting()});
 window.addEventListener('pageshow',()=>{resumeExisting()});
 // A fresh user tap is required by iOS after some audio interruptions.
 // Do not silently start playback; retain the existing retry control.
 window.addEventListener('focus',()=>{resumeExisting()});
 // Start initialization while the user searches, before selecting a song.
 // Keep one prepared context; no music is scheduled by this handler.
 function prepareFromSearch(event){
   if(!event.isTrusted||!isIPhoneHomeApp())return;
   if(!event.target?.closest?.('#searchInput,#homeLyricsQuery'))return;
   try{gesturePrepare()}catch(e){lastError=String(e)}
 }
 document.addEventListener('pointerup',prepareFromSearch,{capture:true,passive:true});
 document.addEventListener('touchend',prepareFromSearch,{capture:true,passive:true});
 document.addEventListener('keydown',prepareFromSearch,{capture:true});
})();

window.OuenkaMenuReset=async button=>{if(!window.ouenkaAudioRecovery?.reset){location.href='audio-diagnostic.html';return}let status=button.parentElement.querySelector('.menu-audio-status');if(!status){status=document.createElement('p');status.className='menu-audio-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');button.after(status)}button.disabled=true;status.textContent='音声を復旧しています…';try{window.stopCurrentSong?.();status.textContent=await window.ouenkaAudioRecovery.reset()}catch(e){status.textContent='復旧できませんでした：'+e.message}finally{button.disabled=false}};
