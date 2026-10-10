/* OUENKA BASE v57: diagnostics only. No playback algorithm changes. */
(()=>{
  if(window.__ouenkaDiagnosticInstalled)return;
  window.__ouenkaDiagnosticInstalled=true;
  const started=performance.now(), logs=[];
  const stamp=()=>((performance.now()-started)/1000).toFixed(2)+'s';
  function log(message){
    const line=stamp()+' '+message;
    logs.push(line); if(logs.length>250)logs.shift();
    if(window.__ouenkaDiagnosticRefresh)window.__ouenkaDiagnosticRefresh();
  }
  window.__ouenkaDiagnosticLog=log;
  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||String(input);
    const path=url.replace(/^https?:\/\/[^/]+/,'').slice(0,150);
    const id=Math.random().toString(36).slice(2,6);
    log('FETCH START '+id+' '+path);
    let result;
    try{result=originalFetch(input,init)}catch(e){log('FETCH THROW '+id+' '+e);throw e;}
    return Promise.resolve(result).then(r=>{
      log('FETCH HEADERS '+id+' '+r.status+' '+path);
      if(r&&typeof r.arrayBuffer==='function'){
        const orig=r.arrayBuffer.bind(r);
        try{r.arrayBuffer=function(){log('BODY START '+id);return orig().then(b=>{log('BODY DONE '+id+' '+b.byteLength+' bytes');return b;},e=>{log('BODY ERROR '+id+' '+e);throw e;});};}catch(_){}
      }
      return r;
    },e=>{log('FETCH ERROR '+id+' '+e);throw e;});
  };
  function wrapContext(Cls){
    if(!Cls||!Cls.prototype||Cls.prototype.__ouenkaDiagWrapped)return;
    const p=Cls.prototype;
    try{
      const oldDecode=p.decodeAudioData;
      if(oldDecode)p.decodeAudioData=function(data,...rest){
        const id=Math.random().toString(36).slice(2,6);
        log('DECODE START '+id+' '+(data?.byteLength||'?')+' bytes');
        const success=rest[0],failure=rest[1];
        if(typeof success==='function')rest[0]=function(v){log('DECODE DONE '+id);return success(v);};
        if(typeof failure==='function')rest[1]=function(e){log('DECODE ERROR '+id+' '+e);return failure(e);};
        let p;
        try{p=oldDecode.call(this,data,...rest)}catch(e){log('DECODE THROW '+id+' '+e);throw e;}
        if(p&&typeof p.then==='function')return p.then(v=>{log('DECODE DONE '+id);return v;},e=>{log('DECODE ERROR '+id+' '+e);throw e;});
        return p;
      };
      const oldResume=p.resume;
      if(oldResume)p.resume=function(){log('CONTEXT RESUME '+this.state);return oldResume.call(this).then(v=>{log('CONTEXT RUNNING '+this.state);return v;},e=>{log('CONTEXT ERROR '+e);throw e;});};
      p.__ouenkaDiagWrapped=true;
    }catch(e){log('INSTRUMENT ERROR '+e);}
  }
  wrapContext(window.AudioContext);wrapContext(window.webkitAudioContext);
  window.addEventListener('error',e=>log('WINDOW ERROR '+e.message));
  window.addEventListener('unhandledrejection',e=>log('PROMISE ERROR '+String(e.reason)));
  document.addEventListener('DOMContentLoaded',()=>{
    const b=document.createElement('button');b.textContent='診断';
    b.setAttribute('aria-label','音源読み込み診断を表示');
    Object.assign(b.style,{position:'fixed',right:'8px',bottom:'85px',zIndex:'2147483646',background:'#0b2f55',color:'white',border:'1px solid white',borderRadius:'10px',padding:'9px 13px',fontSize:'13px'});
    const panel=document.createElement('div');
    Object.assign(panel.style,{display:'none',position:'fixed',inset:'12% 3% 7%',zIndex:'2147483647',background:'#fff',color:'#111',padding:'12px',border:'2px solid #0b2f55',borderRadius:'12px',overflow:'auto',fontSize:'12px'});
    const title=document.createElement('div');title.textContent='iPhone 音源読み込み診断';title.style.fontWeight='bold';
    const copy=document.createElement('button');copy.textContent='ログをコピー';copy.style.margin='8px';
    const close=document.createElement('button');close.textContent='閉じる';close.style.margin='8px';
    const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;word-break:break-all;font-size:11px;';
    panel.append(title,copy,close,pre);document.body.append(b,panel);
    window.__ouenkaDiagnosticRefresh=()=>{if(panel.style.display!=='none')pre.textContent=logs.join('\n');};
    b.onclick=()=>{panel.style.display='block';window.__ouenkaDiagnosticRefresh();};
    close.onclick=()=>panel.style.display='none';
    copy.onclick=async()=>{const s=['URL='+location.href,'standalone='+Boolean(navigator.standalone),'UA='+navigator.userAgent,...logs].join('\n');try{await navigator.clipboard.writeText(s);copy.textContent='コピー完了';}catch(_){const t=document.createElement('textarea');t.value=s;panel.append(t);t.select();document.execCommand('copy');t.remove();copy.textContent='コピーを試行';}};
    log('DIAG READY standalone='+Boolean(navigator.standalone));
  });
})();
