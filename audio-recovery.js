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
 function unlock(ctx){
   configureSession();
   if(!ctx||ctx.state==='closed')throw new Error('音声エンジンが終了しています');
   try{
     const buffer=ctx.createBuffer(1,1,ctx.sampleRate);
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
 window.ouenkaAudioRecovery={create,unlock,resumeExisting,reset,diagnostics:()=>({contexts:state(),lastError,visibility:document.visibilityState})};
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeExisting()});
 window.addEventListener('pageshow',()=>{resumeExisting()});
})();
