/* エスコン風スタメンボード / 音源の作成・ミックス処理は変更しない。 */
(()=>{'use strict';
 const $=id=>document.getElementById(id),canvas=$('esconCanvas');if(!canvas)return;
 const ctx=canvas.getContext('2d'),images=new Map();let playback=null,raf=0,stage={activeIndex:-1,revealedIndices:[]},lastKey='';
 const norm=s=>String(s||'').normalize('NFKC').replace(/[\s　・･]/g,'');
 function studio(){try{return JSON.parse(localStorage.getItem('ouenka_studio_tabs_v1')||'null')||{}}catch{return {}}}
 let settings=studio();
 function rows(){return currentRows().map((r,i)=>{const p=(settings.players||[]).find(p=>norm(p.registeredName||p.audioSource?.name||p.name)===norm(r.name)&&+p.order===i+1)||{};return {...p,...r,name:p.name||r.name,photo:p.photo||'',photoEnabled:p.photoEnabled!==false}})}
 function image(src){if(!src)return null;if(!images.has(src)){const im=new Image();images.set(src,im);im.onload=()=>{lastKey='';draw()};im.src=src}return images.get(src)}
 function draw(){const list=rows();window.OuenkaBroadcast.drawBoard(ctx,list,{...settings,...stage,title:$('lineupTitle').value,team:settings.team||list.find(p=>p.team)?.team,images:list.map(p=>image(p.photo))})}
 function stop(){playback=null;if(raf)cancelAnimationFrame(raf);raf=0;stage={activeIndex:-1,revealedIndices:[]};lastKey='';draw()}
 function tick(){if(!playback)return;const {ctx:audio,base,starts,rowIndices}=playback;const seconds=audio.currentTime-base;stage=window.OuenkaBroadcast.boardAt(starts,rowIndices,seconds);const animating=stage.activeIndex>=0&&stage.elapsed<.42,key=stage.activeIndex+':'+stage.revealedIndices.join(',');if(animating||key!==lastKey){draw();lastKey=key}raf=requestAnimationFrame(tick)}
 window.addEventListener('ouenka-board-play',e=>{stop();playback=e.detail;tick()});
 window.addEventListener('ouenka-board-stop',stop);
 window.addEventListener('ouenka-board-ended',()=>{playback=null;cancelAnimationFrame(raf);raf=0;stage={...stage,activeIndex:-1,elapsed:1};draw()});
 $('esconFull').onclick=()=>{if(playback)return;stage={activeIndex:-1,revealedIndices:Array.from({length:9},(_,i)=>i)};draw()};
 $('esconEmpty').onclick=()=>{if(!playback)stop()};
 $('esconSettings').onclick=()=>{window.ouenkaOpenBoard=true;$('illustrationButton').click()};
 document.addEventListener('input',e=>{if(e.target.closest('#lineup')||e.target.id==='lineupTitle'){if(!playback){stage={activeIndex:-1,revealedIndices:[]};draw()}}});
 new MutationObserver(()=>{if(!playback)draw()}).observe($('lineup'),{subtree:true,childList:true});
 window.addEventListener('pageshow',()=>{settings=studio();draw()});window.addEventListener('storage',e=>{if(e.key==='ouenka_studio_tabs_v1'){settings=studio();draw()}});
 draw();
})();
