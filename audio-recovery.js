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
 let pendingGestureContext=null;
 let retryButton=null;
 function state(){return [...contexts].map(c=>c.state).join(', ')||'なし'}
 function makeContext(){
   configureSession();
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)throw new Error('このブラウザはWeb Audioに対応していません');
   const ctx=new AC();contexts.add(ctx);
   const close=ctx.close.bind(ctx);
   ctx.close=function(){contexts.delete(ctx);return close()};
   return ctx;
 }
 // iPhone standalone can leave resume() pending for ~60 seconds even after a tap.
 // Kick off unlocking inside the user gesture, but never await its promise before fetching audio.
 function gesturePrepare(){
   // Run directly in a trusted pointer/click event, before any asynchronous lookup.
   if(pendingGestureContext && pendingGestureContext.state!=='closed') return pendingGestureContext;
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
 function create(){const ctx=makeContext();try{return unlock(ctx)}catch(e){try{ctx.close()}catch(_){}throw e}}
 // Explicit second user gesture if standalone WebKit defers resume() indefinitely.
 function showRetry(ctx){
   if(!ctx || ctx.state==='running' || ctx.state==='closed')return;
   if(!retryButton){
     retryButton=document.createElement('button');
     retryButton.type='button';retryButton.textContent='▶ 音声を開始';
     retryButton.style.cssText='position:fixed;bottom:82px;left:50%;transform:translateX(-50%);z-index:2147483645;background:#0b2f55;color:white;border:2px solid white;border-radius:14px;padding:13px 24px;font-size:17px;font-weight:bold;box-shadow:0 3px 15px #0006';
     document.body.appendChild(retryButton);
   }
   retryButton.hidden=false;
   retryButton.onclick=()=>{
     configureSession();
     // Both calls occur inside this trusted tap, not after an await.
     try{unlock(ctx)}catch(e){console.warn('再起動',e)}
     const p=ctx.resume();if(p&&p.catch)p.catch(e=>console.warn('再開失敗',e));
     if(ctx.state==='running')retryButton.hidden=true;
   };
   const onstate=()=>{if(ctx.state==='running'){retryButton.hidden=true;ctx.removeEventListener('statechange',onstate)}};
   ctx.addEventListener('statechange',onstate);
 }
 function hideRetry(){if(retryButton)retryButton.hidden=true}

 async function resumeExisting(){
   const list=[...contexts].filter(c=>c.state==='suspended');
   return Promise.allSettled(list.map(c=>c.resume()));
 }
 async function reset(){
   // Do not close contexts of currently playing songs: reset is explicitly user-invoked.
   try{if(typeof window.stopCurrentSong==='function')window.stopCurrentSong()}catch(_){}
   try{if(typeof window.stopOneNineMedley==='function')window.stopOneNineMedley()}catch(_){}
   try{if(typeof window.stopRowAudio==='function')window.stopRowAudio()}catch(_){}
   try{if(typeof window.stopAudio==='function')window.stopAudio()}catch(_){}
   await Promise.allSettled([...contexts].map(c=>c.close()));contexts.clear();
   const ctx=await create();await ctx.close();lastError='';
   return '音声エンジンを再初期化しました。曲の再生ボタンを押してください。';
 }
 window.ouenkaAudioRecovery={create,unlock,gesturePrepare,consumeGestureContext,showRetry,hideRetry,resumeExisting,reset,diagnostics:()=>({contexts:state(),lastError,visibility:document.visibilityState})};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeExisting()});
 window.addEventListener('pageshow',()=>{resumeExisting()});
})();
