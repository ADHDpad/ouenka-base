/* 応援歌BASE / 採用案6・7 / 20261016-broadcast-v1 */
(()=>{'use strict';
 const W=1280,H=720;
 const FAMILY='"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
 const validColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
 const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
 function theme(options={}){return {color:validColor(options.color,'#07549a'),dark:validColor(options.teamDark,'#071d33'),accent:validColor(options.accent,'#1392c6'),line:validColor(options.broadcastLine,'#ffd43b'),frame:validColor(options.frameColor,'#000000'),mode:options.fadeMode||'card',end:validColor(options.fadeEndColor,'#1392c6'),angle:Number.isFinite(+options.gradientAngle)?+options.gradientAngle:110}}
 function gradient(ctx,x,y,w,h,colors,angle){const r=angle*Math.PI/180,len=Math.abs(w*Math.sin(r))+Math.abs(h*Math.cos(r)),dx=Math.sin(r)*len/2,dy=-Math.cos(r)*len/2;const g=ctx.createLinearGradient(x+w/2-dx,y+h/2-dy,x+w/2+dx,y+h/2+dy);colors.forEach(([at,color])=>g.addColorStop(at,color));return g}
 function fillBackground(ctx,t,x=0,y=0,w=W,h=H,light=false){
  const colors=t.mode==='none'?[[0,t.color],[1,t.color]]:t.mode==='card'?[[0,t.dark],[.7,t.accent],[1,t.color]]:[[0,t.color],[1,t.end]];
  ctx.fillStyle=t.mode==='none'?t.color:gradient(ctx,x,y,w,h,colors,t.angle);ctx.fillRect(x,y,w,h);
  if(light){ctx.fillStyle=t.mode==='none'?mix(t.color,'#ffffff',.94):gradient(ctx,x,y,w,h,colors.map(([at,color])=>[at,mix(color,'#ffffff',at===0?.99:.92)]),t.angle);ctx.fillRect(x,y,w,h)}
 }
 function poly(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
 function rule(ctx,x,y,w,color,height=2){ctx.fillStyle=color;ctx.fillRect(x,y,w,height)}
 function text(ctx,value,x,y,size,color,width,opts={}){
  value=String(value??'');ctx.save();ctx.shadowColor='transparent';ctx.textAlign=opts.align||'left';ctx.textBaseline='alphabetic';
  const family=opts.family||FAMILY,weight=opts.weight||800,italic=opts.italic?'italic ':'';
  ctx.font=`${italic}${weight} ${size}px ${family}`;const measured=ctx.measureText(value).width;
  const actual=measured>width?Math.max(.1,size*width/measured):size;
  ctx.font=`${italic}${weight} ${actual}px ${family}`;ctx.fillStyle=color;
  if(opts.shadow){ctx.shadowColor='#000000';ctx.shadowOffsetX=1;ctx.shadowOffsetY=2;ctx.shadowBlur=2}
  ctx.fillText(value,x,y);ctx.restore();return actual;
 }
 function identity(p){return p.jerseyNumber??p.number??p.uniformNumber??p.backNumber??''}
 function brand(team){return /日本ハム|ファイターズ/.test(team||'')?'FIGHTERS':team||'OUENKA BASE'}
 function position(p){const n=Number(p.order);return [(n>=1&&n<=9)?n+'番':'',p.position||''].filter(Boolean).join('  ')}
 function photo(ctx,p,rect,t,image,credit){
  const [x,y,w,h]=rect;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=t.dark;ctx.fillRect(x,y,w,h);
  if(image?.complete&&image.naturalWidth){const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),sw=w/scale,sh=h/scale;ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h)}
  else{text(ctx,'写真を選択',x+w/2,y+h/2,25,'#dbe8f5',w-30,{align:'center',weight:500})}
  if(credit)credit(ctx,p.photoCredit,rect);ctx.restore();ctx.strokeStyle=t.frame;ctx.lineWidth=3;ctx.strokeRect(x+1.5,y+1.5,w-3,h-3);
 }
 function fontStyle(options,group){const font=options.fonts?.[group]||{};return {family:font.family||FAMILY,weight:group==='name'?(options.nameWeight||900):(font.weight||800),italic:!!font.italic,shadow:!!options.shadows?.[group]}}
 function statsRows(ctx,p,x,y,w,color,t,options){
  const fields=options.fields||[['avg','打率'],['hr','本塁打'],['rbi','打点'],['sb','盗塁'],['ops','OPS']];
  const fs=Math.min(38,Number(options.fontSizes?.stats)||32),style=fontStyle(options,'stats');
  fields.slice(0,3).forEach(([key,label],i)=>{const cell=w/3,xx=x+i*cell; if(i)rule(ctx,xx-12,y-24,2,t.line,30);text(ctx,label+' '+(String(p[key]??'').trim()||'—'),xx,y,fs*.83,color,cell-24,style)});
  fields.slice(3).forEach(([key,label],i)=>{const xx=x+i*w/2;if(i)rule(ctx,xx-12,y+19,2,t.line,28);text(ctx,label+' '+(String(p[key]??'').trim()||'—'),xx,y+44,fs*.83,color,w/2-24,style)});
 }
 function lyrics(ctx,p,box,color,options,align='left'){
  const [x,y,w,h]=box,style=fontStyle(options,'lyrics');let size=Number(options.fontSizes?.lyrics)||38,lines=[];
  const source=String(p.lyrics||'ここに応援歌の歌詞を表示\n歌詞に合わせて自動調整\n写真と文字は重ねずに表示\n4行分のスペースを確保').replace(/\r\n?/g,'\n');
  for(let tries=0;tries<120;tries++){
   ctx.font=`${style.italic?'italic ':''}${style.weight} ${size}px ${style.family}`;lines=[];
   source.split('\n').forEach(raw=>{let part='';for(const char of raw){if(part&&ctx.measureText(part+char).width>w){lines.push(part);part=char}else part+=char}lines.push(part)});
   if(Math.max(4,lines.length)*size*1.45<=h)break;size*=.93;
  }
  const leading=size*1.45,top=y+(h-Math.max(4,lines.length)*leading)/2;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  lines.forEach((line,i)=>text(ctx,line,align==='center'?x+w/2:x,top+size+i*leading,size,color,w,{...style,align}));ctx.restore();
 }
 function drawCard(ctx,p,design,options={}){
  const t=theme(options),light=design.endsWith('6'),noPhoto=design.startsWith('none-')||p.photoEnabled===false;
  const ink=light?t.dark:'#ffffff',accentInk=light?t.color:mix(t.accent,'#ffffff',.35);
  ctx.save();ctx.globalAlpha=1;ctx.shadowColor='transparent';fillBackground(ctx,t,0,0,W,H,light);
  if(light){
   poly(ctx,[[1040,0],[1110,0],[890,H],[820,H]],t.color);
   poly(ctx,[[1120,0],[1150,0],[930,H],[900,H]],t.accent);
   poly(ctx,[[1160,0],[1169,0],[949,H],[940,H]],t.line);
  }else{
   poly(ctx,[[0,0],[W,0],[W,180],[0,390]],mix(t.dark,t.color,.23));
   poly(ctx,[[860,0],[1000,0],[760,H],[620,H]],mix(t.color,t.dark,.45));
   poly(ctx,[[1220,0],[1280,0],[1040,H],[980,H]],t.color);
   rule(ctx,42,40,1196,t.line,2);
  }
  let left=light?52:560,right=light?744:1220;
  if(noPhoto){left=88;right=1192;if(light){poly(ctx,[[1090,0],[1170,0],[930,H],[850,H]],mix(t.color,'#ffffff',.84))}}
  else photo(ctx,p,light?[810,36,434,648]:[40,72,466,592],t,options.image,options.credit);
  const width=right-left;
  if(!light&&!noPhoto){
   text(ctx,brand(options.team),left,116,28,accentInk,width,{weight:900});
   const jersey=identity(p);const nameLeft=jersey!==''?left+208:left;
   if(jersey!=='')text(ctx,jersey,left,267,144,accentInk,185,{weight:900,italic:true});
   text(ctx,position(p),nameLeft,166,Math.min(36,Number(options.fontSizes?.order)||36),ink,right-nameLeft,{...fontStyle(options,'order'),shadow:false});
   text(ctx,p.name,nameLeft,242,Math.min(80,Number(options.fontSizes?.name)||80),ink,right-nameLeft,fontStyle(options,'name'));
   if(p.romanName)text(ctx,p.romanName,nameLeft,279,16,accentInk,right-nameLeft,{weight:600});
   rule(ctx,left,312,width,t.line,2);rule(ctx,left,347,3,t.line,286);rule(ctx,left+181,347,2,t.line,286);
   const fields=options.fields||[['avg','打率'],['hr','本塁打'],['rbi','打点'],['sb','盗塁'],['ops','OPS']];
   fields.forEach(([key,label],i)=>{const y=380+i*57;text(ctx,label,left+15,y,20,'#d6e7f7',147,fontStyle(options,'stats'));text(ctx,String(p[key]??'').trim()||'—',left+160,y+1,Math.min(31,Number(options.fontSizes?.stats)||31),'#ffffff',95,{...fontStyle(options,'stats'),align:'right'})});
   lyrics(ctx,p,[left+208,352,width-214,280],ink,options);
   text(ctx,'OUENKA BASE  /  PLAYER INTRODUCTION',left,687,12,accentInk,width,{weight:600});
   ctx.restore();return;
  }
  text(ctx,brand(options.team),left,86,28,accentInk,width-150,{weight:900});
  text(ctx,position(p),right,132,Math.min(40,Number(options.fontSizes?.order)||40),ink,width*.65,{...fontStyle(options,'order'),align:'right',shadow:false});
  const jersey=identity(p);if(jersey!=='')text(ctx,jersey,left,148,64,light?t.color:accentInk,width*.3,{weight:900});
  text(ctx,p.name,left,242,Math.min(100,Number(options.fontSizes?.name)||84),ink,width,{...fontStyle(options,'name'),shadow:light?false:options.shadows?.name});
  if(p.romanName)text(ctx,p.romanName,left,280,19,accentInk,width,{weight:600});
  rule(ctx,left,302,width,t.line,3);
  statsRows(ctx,p,left,345,width,ink,t,options);
  rule(ctx,left,412,width,light?mix(t.color,'#ffffff',.65):t.line,1);
  if(!light)rule(ctx,left,448,4,t.line,198);
  lyrics(ctx,p,[left+(light?0:22),440,width-(light?4:26),210],ink,options);
  text(ctx,'OUENKA BASE  /  PLAYER INTRODUCTION',left,687,12,accentInk,width,{weight:600});
  ctx.restore();
 }
 function drawLineup(ctx,rows,options={}){
  const t=theme(options),light=options.variant==='6',ink=light?t.dark:'#ffffff';ctx.save();ctx.globalAlpha=1;ctx.shadowColor='transparent';fillBackground(ctx,t,0,0,W,H,light);
  if(light){poly(ctx,[[1030,0],[1160,0],[920,H],[790,H]],mix(t.color,'#ffffff',.87));poly(ctx,[[1240,0],[1280,0],[1040,H],[1000,H]],t.color)}
  else{poly(ctx,[[770,0],[1030,0],[790,H],[530,H]],mix(t.dark,t.color,.4));poly(ctx,[[1170,0],[1280,0],[1040,H],[930,H]],t.color)}
  text(ctx,'STARTING LINEUP',58,82,54,ink,900,{weight:900,italic:true});
  text(ctx,'1–9',1218,90,64,light?t.color:'#ffffff',250,{weight:900,align:'right'});
  text(ctx,options.title||options.team||'1-9 応援歌',60,128,27,light?t.color:mix(t.accent,'#ffffff',.4),1140,{weight:700});rule(ctx,60,151,1160,t.line,3);
  // Nine fixed slots preserve batting-order numbers even when an input is blank.
  const start=174,rowH=51;
  for(let i=0;i<9;i++){
   const p=rows[i]||{},yy=start+i*rowH,active=Number(options.activeIndex)===i;
   if(active){ctx.fillStyle=light?mix(t.color,'#ffffff',.84):mix(t.dark,t.color,.55);ctx.fillRect(54,yy-4,1172,rowH-2);rule(ctx,54,yy-4,5,t.line,rowH-2)}
   text(ctx,String(i+1).padStart(2,'0'),76,yy+33,30,light?t.color:t.line,68,{weight:900,italic:true});
   rule(ctx,163,yy+5,2,t.line,28);
   text(ctx,p.position||'—',184,yy+31,22,light?t.color:mix(t.accent,'#ffffff',.5),180,{weight:700});
   text(ctx,p.name||'—',390,yy+33,33,ink,760,{weight:900});
   rule(ctx,76,yy+44,1120,light?mix(t.color,'#ffffff',.83):mix(t.dark,t.accent,.3),1);
  }
  const extras=rows.slice(9).filter(p=>p.name);
  text(ctx,extras.length?'控え・追加 '+extras.map(p=>[p.position,p.name].filter(Boolean).join(' ')).join(' / '):'OUENKA BASE  /  FIGHT SONG',60,690,17,light?t.color:'#c7dced',1160,{weight:600});ctx.restore();
 }
 function savePng(canvas,filename){return new Promise((resolve,reject)=>canvas.toBlob(async blob=>{
  if(!blob){reject(new Error('画像を作成できませんでした'));return}
  const file=new File([blob],filename,{type:'image/png'});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});resolve();return}}catch(e){if(e.name==='AbortError'){resolve();return}}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);resolve();
 },'image/png'))}
 window.OuenkaBroadcast={drawCard,drawLineup,savePng,theme};
})();
