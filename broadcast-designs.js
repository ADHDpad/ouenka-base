/* 応援歌BASE / 採用案6・7 / 20261016-broadcast-v1 */
(()=>{'use strict';
 const W=1280,H=720;
 const FAMILY='"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
 const validColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
 const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
 function theme(options={}){return {color:validColor(options.color,'#07549a'),dark:validColor(options.teamDark,'#071d33'),accent:validColor(options.accent,'#1392c6'),line:validColor(options.broadcastLine,'#ffd43b'),frame:validColor(options.frameColor,'#000000'),mode:options.fadeMode||'card',end:validColor(options.fadeEndColor,'#1392c6'),angle:Number.isFinite(+options.gradientAngle)?+options.gradientAngle:110,gradientWidth:Math.max(5,Math.min(100,Number(options.gradientWidth)||100)),photoFrameWidth:options.photoFrameWidth??4}}
 function gradient(ctx,x,y,w,h,colors,angle){const r=angle*Math.PI/180,len=Math.abs(w*Math.sin(r))+Math.abs(h*Math.cos(r)),dx=Math.sin(r)*len/2,dy=-Math.cos(r)*len/2;const g=ctx.createLinearGradient(x+w/2-dx,y+h/2-dy,x+w/2+dx,y+h/2+dy);colors.forEach(([at,color])=>g.addColorStop(at,color));return g}
 function fillBackground(ctx,t,x=0,y=0,w=W,h=H,light=false){
  const rawColors=t.mode==='none'?[[0,t.color],[1,t.color]]:t.mode==='card'?[[0,t.dark],[.7,t.accent],[1,t.color]]:[[0,t.color],[1,t.end]];
  const colors=rawColors.map(([at,color])=>[.5+(at-.5)*t.gradientWidth/100,color]);
  ctx.fillStyle=t.mode==='none'?t.color:gradient(ctx,x,y,w,h,colors,t.angle);ctx.fillRect(x,y,w,h);
  if(light){ctx.fillStyle=t.mode==='none'?mix(t.color,'#ffffff',.94):gradient(ctx,x,y,w,h,colors.map(([at,color])=>[at,mix(color,'#ffffff',at===0?.99:.92)]),t.angle);ctx.fillRect(x,y,w,h)}
 }
 function poly(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
 function rule(ctx,x,y,w,color,height=2){ctx.fillStyle=color;ctx.fillRect(x,y,w,height)}
 function text(ctx,value,x,y,size,color,width,opts={}){
  value=String(value??'');ctx.save();ctx.shadowColor='transparent';ctx.textAlign=opts.align||'left';ctx.textBaseline='alphabetic';
  const family=opts.family||FAMILY,weight=opts.weight||800,italic=opts.italic?'italic ':'';
  ctx.font=`${italic}${weight} ${size}px ${family}`;const measured=ctx.measureText(value).width;
  let actual=measured>width?Math.max(.1,size*width/measured):size;
  if(opts.band){
   ctx.font=`${italic}${weight} ${actual}px ${family}`;const metrics=ctx.measureText(value),ascent=metrics.actualBoundingBoxAscent||actual*.85,descent=metrics.actualBoundingBoxDescent||actual*.2;
   const scale=Math.min(1,(opts.band[1]-opts.band[0]-8)/(ascent+descent));actual*=scale;
   y=Math.max(opts.band[0]+ascent*scale+3,Math.min(y,opts.band[1]-descent*scale-5));
  }
  ctx.font=`${italic}${weight} ${actual}px ${family}`;ctx.fillStyle=color;
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.lineJoin='round';const strokeWidth=opts.adjustable?Math.max(0,(weight-100)/800)*actual*.025:0;
  if(strokeWidth>0)ctx.lineWidth=strokeWidth;
  function paint(tx,ty,ink){ctx.fillStyle=ink;ctx.strokeStyle=ink;if(strokeWidth>0)ctx.strokeText(value,tx,ty);ctx.fillText(value,tx,ty)}
  if(opts.shadow)paint(x+2,y+3,'#000000');paint(x,y,color);ctx.restore();return actual;
 }
 function identity(p){return p.jerseyNumber??p.number??p.uniformNumber??p.backNumber??''}
 function compactPosition(value){return ({SS:"遊撃手",C:"捕手","1B":"一塁手","2B":"二塁手","3B":"三塁手",LF:"左翼手",CF:"中堅手",RF:"右翼手",DH:"指名打者",P:"投手",SP:"先発",RP:"中継ぎ",CP:"抑え"})[value]||String(value||"")}

 function position(p){const n=Number(p.order);return [(n>=1&&n<=9)?n+'番':'',compactPosition(p.position)||''].filter(Boolean).join('  ')}
 function drawPhotoImage(ctx,image,rect,p={}){
  if(!image?.complete||!image.naturalWidth)return;
  const [x,y,w,h]=rect,finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  const zoom=Math.max(.5,Math.min(3,finite(p.photoZoom,1))),px=Math.max(-100,Math.min(100,finite(p.photoX,0))),py=Math.max(-100,Math.min(100,finite(p.photoY,0)));
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom,dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(image,x+(w-dw)/2+px*w/100,y+(h-dh)/2+py*h/100,dw,dh);ctx.restore();
 }
 function drawPhotoBorder(ctx,rect,width,color,diagonal=false){
  const [x,y,w,h]=rect,n=Number(width),line=Math.min(Math.min(w,h)-1,Math.max(0,Math.min(20,Number.isFinite(n)?n:4)));
  if(line<=0)return;const inset=line/2;ctx.save();ctx.strokeStyle=color||'#000000';ctx.lineWidth=line;
  if(diagonal){ctx.beginPath();[[x+inset,y+inset],[x+w-inset,y+inset],[x+w-194-inset,y+h-inset],[x+inset,y+h-inset]].forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.stroke()}
  else ctx.strokeRect(x+inset,y+inset,w-line,h-line);ctx.restore();
 }
 function photo(ctx,p,rect,t,image,credit){
  const [x,y,w,h]=rect;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=t.dark;ctx.fillRect(x,y,w,h);
  if(image?.complete&&image.naturalWidth){drawPhotoImage(ctx,image,rect,p)}
  else{text(ctx,'写真を選択',x+w/2,y+h/2,25,'#dbe8f5',w-30,{align:'center',weight:500})}
  if(credit)credit(ctx,p.photoCredit,rect);ctx.restore();drawPhotoBorder(ctx,rect,t.photoFrameWidth,t.frame);
 }
 function fontStyle(options,group){const font=options.fonts?.[group]||{};return {family:font.family||FAMILY,weight:group==='name'?(options.nameWeight||900):(font.weight||800),adjustable:true,italic:!!font.italic,shadow:!!options.shadows?.[group]}}
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
  const ink=light?'#000000':'#ffffff',accentInk=light?'#000000':mix(t.accent,'#ffffff',.35);
  
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
   const jersey=identity(p);const nameLeft=jersey!==''?left+208:left;
   if(jersey!=='')text(ctx,jersey,left,267,144,accentInk,185,{weight:900,italic:true});
   text(ctx,position(p),nameLeft,138,Math.min(36,Number(options.fontSizes?.order)||36),ink,right-nameLeft,{...fontStyle(options,'order'),shadow:false});
   text(ctx,p.name,nameLeft,256,Number(options.fontSizes?.name)||100,ink,right-nameLeft,{...fontStyle(options,'name'),band:[158,280]});
   
   rule(ctx,left,312,width,t.line,2);rule(ctx,left,347,3,t.line,286);rule(ctx,left+181,347,2,t.line,286);
   const fields=options.fields||[['avg','打率'],['hr','本塁打'],['rbi','打点'],['sb','盗塁'],['ops','OPS']];
   fields.forEach(([key,label],i)=>{const y=380+i*57;text(ctx,label,left+15,y,20,'#d6e7f7',147,fontStyle(options,'stats'));text(ctx,String(p[key]??'').trim()||'—',left+160,y+1,Math.min(31,Number(options.fontSizes?.stats)||31),'#ffffff',95,{...fontStyle(options,'stats'),align:'right'})});
   lyrics(ctx,p,[left+208,352,width-214,280],ink,options);
   ctx.restore();return;
  }
  text(ctx,position(p),right,124,Math.min(40,Number(options.fontSizes?.order)||40),ink,width*.65,{...fontStyle(options,'order'),align:'right',shadow:false});
  const jersey=identity(p);if(jersey!=='')text(ctx,jersey,left,148,64,light?'#000000':accentInk,width*.3,{weight:900});
  text(ctx,p.name,left,252,Number(options.fontSizes?.name)||100,ink,width,{...fontStyle(options,'name'),shadow:options.shadows?.name,band:[158,280]});
  
  rule(ctx,left,302,width,t.line,3);
  statsRows(ctx,p,left,345,width,ink,t,options);
  rule(ctx,left,412,width,light?mix(t.color,'#ffffff',.65):t.line,1);
  if(!light)rule(ctx,left,448,4,t.line,198);
  lyrics(ctx,p,[left+(light?0:22),440,width-(light?4:26),210],ink,options);
  ctx.restore();
 }
 function drawLineup(ctx,rows,options={}){
  const t=theme(options),light=options.variant==='6',ink=light?t.dark:'#ffffff';ctx.save();ctx.globalAlpha=1;ctx.shadowColor='transparent';fillBackground(ctx,t,0,0,W,H,light);
  if(light){poly(ctx,[[1030,0],[1160,0],[920,H],[790,H]],mix(t.color,'#ffffff',.87));poly(ctx,[[1240,0],[1280,0],[1040,H],[1000,H]],t.color)}
  else{poly(ctx,[[770,0],[1030,0],[790,H],[530,H]],mix(t.dark,t.color,.4));poly(ctx,[[1170,0],[1280,0],[1040,H],[930,H]],t.color)}
  text(ctx,'STARTING LINEUP',58,82,54,ink,900,{weight:900,italic:true});
  text(ctx,'1–9',1218,90,64,light?t.color:'#ffffff',250,{weight:900,align:'right'});
  text(ctx,options.title||'1-9 応援歌',60,128,27,light?t.color:mix(t.accent,'#ffffff',.4),1140,{weight:700});rule(ctx,60,151,1160,t.line,3);
  // Nine fixed slots preserve batting-order numbers even when an input is blank.
  const start=174,rowH=51;
  for(let i=0;i<9;i++){
   const p=rows[i]||{},yy=start+i*rowH,active=Number(options.activeIndex)===i;
   if(active){ctx.fillStyle=light?mix(t.color,'#ffffff',.84):mix(t.dark,t.color,.55);ctx.fillRect(54,yy-4,1172,rowH-2);rule(ctx,54,yy-4,5,t.line,rowH-2)}
   text(ctx,String(i+1).padStart(2,'0'),76,yy+33,30,light?t.color:t.line,68,{weight:900,italic:true});
   rule(ctx,163,yy+5,2,t.line,28);
   text(ctx,compactPosition(p.position)||'',184,yy+31,22,light?t.color:mix(t.accent,'#ffffff',.5),180,{weight:700});
   text(ctx,p.name||'—',390,yy+33,33,ink,options.showStats?350:760,{weight:900});if(options.showStats){const pitching=/投|P|SP|RP/i.test(p.position||'')||p.statsType==='pitching';const fields=pitching?[['wins','勝'],['losses','敗'],['era','防御率'],['whip','WHIP'],['strikeouts','奪三振']]:[['avg','打率'],['hr','本'],['rbi','打点'],['ops','OPS']];text(ctx,fields.map(([k,l])=>l+' '+(p[k]===undefined||p[k]===''?'—':p[k])).join('  '),760,yy+31,18,ink,435,{weight:600})}
   rule(ctx,76,yy+44,1120,light?mix(t.color,'#ffffff',.83):mix(t.dark,t.accent,.3),1);
  }
  const extras=rows.slice(9).filter(p=>p.name);
  text(ctx,extras.length?'控え・追加 '+extras.map(p=>[p.position,p.name].filter(Boolean).join(' ')).join(' / '):'',60,690,17,light?t.color:'#c7dced',1160,{weight:600});ctx.restore();
 }

 // 16:9のスタメンボード。表示対象は音源の実際の開始時刻から決定する。
 function boardAt(starts,rowIndices,seconds){
  let song=-1;for(let i=0;i<starts.length;i++){if(seconds>=starts[i])song=i;else break}
  return {activeIndex:song<0?-1:rowIndices[song],revealedIndices:rowIndices.slice(0,song+1),elapsed:song<0?0:Math.max(0,seconds-starts[song])};
 }
 function drawBoard(ctx,rows,options={}){
  const t=theme(options),active=options.activeIndex??-1,shown=new Set(options.revealedIndices??rows.map((_,i)=>i));
  ctx.save();ctx.globalAlpha=1;ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.fillStyle='#06090d';ctx.fillRect(0,0,W,H);
  poly(ctx,[[950,0],[1090,0],[990,98],[850,98]],mix(t.color,'#06090d',.65));
  poly(ctx,[[1110,0],[1280,0],[1180,98],[1010,98]],mix(t.color,'#06090d',.82));
  text(ctx,options.title||'1-9 応援歌',30,66,48,'#ffffff',1220,{weight:900});
  rule(ctx,0,97,W,'#bdc9d1',1);
  const entries=rows.map((p,index)=>({p,index})).filter(({p})=>String(p?.name||'').trim()),required=entries.length;
  if(required>10){text(ctx,'11枠以上ではこのフォーマットは使用できません。',W/2,H/2,32,'#ffffff',1180,{align:'center'});ctx.restore();return}
  if(!required){ctx.restore();return}
  const slots=entries.length,x0=24,y0=112,cw=1232/slots,bottom=680;
  const positions={'投手':'P','捕手':'C','一塁手':'1B','二塁手':'2B','三塁手':'3B','遊撃手':'SS','左翼手':'LF','中堅手':'CF','右翼手':'RF','指名打者':'DH','代打':'PH'};
  for(let i=0;i<slots;i++){
   const entry=entries[i],index=entry?.index??-1,p=entry?.p||{},x=x0+i*cw,visible=shown.has(index)&&!!p.name,isActive=active===index;
   ctx.fillStyle='#090d12';ctx.fillRect(x,y0,cw,bottom-y0);
   // 空欄は打順と仕切りのみ。写真・背番号・名前は各曲の開始後に追加。
   text(ctx,i===9?'P':i+1,x+12,y0+47,43,'#ffffff',49,{weight:900});
   if(visible){
    ctx.save();ctx.beginPath();ctx.rect(x+1,y0+1,cw-2,bottom-y0-2);ctx.clip();
    const progress=isActive&&options.elapsed!==undefined?Math.min(1,Math.max(0,options.elapsed)/.42):1;
    ctx.translate(0,Math.pow(1-progress,3)*24);
    text(ctx,compactPosition(p.position)||'',x+cw-12,y0+42,19,'#ffffff',cw-72,{align:'right'});
    const im=options.images?.[index];
    if(p.photoEnabled!==false&&im?.complete&&im.naturalWidth)photo(ctx,p,[x+5,y0+65,cw-10,300],t,im,options.credit);
    else{ctx.fillStyle=mix(t.color,'#080d13',.78);ctx.fillRect(x+5,y0+65,cw-10,300);text(ctx,identity(p)||String(i+1),x+cw/2,y0+250,80,mix(t.color,'#ffffff',.4),cw-20,{align:'center',weight:900})}
    text(ctx,identity(p),x+12,y0+429,60,'#f3d993',cw-24,{weight:900});
    const parts=String(p.name).trim().split(/[\s　]+/);
    if(parts.length>1){text(ctx,parts[0],x+12,y0+468,24,'#ffffff',cw-24);text(ctx,parts.slice(1).join(' '),x+12,y0+501,24,'#ffffff',cw-24)}
    else text(ctx,p.name,x+12,y0+482,27,'#ffffff',cw-24);
    
    ctx.restore();
   }
   rule(ctx,x,y0,1,'#aebbc7',bottom-y0);
   if(isActive&&visible){ctx.strokeStyle=t.color;ctx.lineWidth=5;ctx.strokeRect(x+3,y0+3,cw-6,bottom-y0-6);rule(ctx,x+3,bottom-8,cw-6,t.color,5)}
  }
  rule(ctx,x0+1232,y0,1,'#aebbc7',bottom-y0);rule(ctx,x0,bottom,1232,'#aebbc7',1);
  ctx.restore();
 }

 function savePng(canvas,filename){return new Promise((resolve,reject)=>canvas.toBlob(async blob=>{
  if(!blob){reject(new Error('画像を作成できませんでした'));return}
  const file=new File([blob],filename,{type:'image/png'});
  try{if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});resolve();return}}catch(e){if(e.name==='AbortError'){resolve();return}}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);resolve();
 },'image/png'))}
 window.OuenkaBroadcast={drawCard,drawLineup,drawBoard,boardAt,drawPhotoImage,drawPhotoBorder,savePng,theme};
})();
