/* White 16:9 illustration templates. Coordinates are shared by preview and export. */
(() => {
  'use strict';

  const layouts = {
    left: {left:520,right:1204,photo:[56,58,410,604],orderY:102,nameY:225,statsLabelY:300,statsValueY:356,lyricTop:414,lyricBottom:657},
    right: {left:74,right:762,photo:[814,58,410,604],orderY:102,nameY:225,statsLabelY:300,statsValueY:356,lyricTop:414,lyricBottom:657},
    squareLeft: {left:480,right:1202,photo:[62,171,366,366],orderY:98,nameY:220,statsLabelY:285,statsValueY:337,lyricTop:392,lyricBottom:666},
    squareRight: {left:78,right:800,photo:[852,171,366,366],orderY:98,nameY:220,statsLabelY:285,statsValueY:337,lyricTop:392,lyricBottom:666},
    wide: {left:86,right:1194,photo:null,orderY:89,nameY:200,statsLabelY:263,statsValueY:313,lyricTop:367,lyricBottom:666},
    center: {left:145,right:1135,photo:null,orderY:116,nameY:237,statsLabelY:305,statsValueY:357,lyricTop:416,lyricBottom:648}
  };

  const entries = [
    ['白地・写真左の細罫線','left','rules'],
    ['白地・写真右のスコア帯','right','stats'],
    ['白地・正方形写真と歌詞ボックス','squareLeft','lyrics'],
    ['白地・右写真と見出し帯','squareRight','header'],
    ['白地・ワイド歌詞と下線','wide','underline'],
    ['白地・中央の二重枠','center','double'],
    ['白地・写真左のコーナーライン','left','corners'],
    ['白地・写真右の縦アクセント','right','rail'],
    ['白地・正方形写真と成績5枠','squareLeft','cells'],
    ['白地・右写真の斜線アクセント','squareRight','angles'],
    ['白地・ワイド歌詞ボックス','wide','lyrics'],
    ['白地・中央の横罫線','center','rules'],
    ['白地・写真左のスコア帯','left','stats'],
    ['白地・写真右の二重枠','right','double'],
    ['白地・正方形写真と下線','squareLeft','underline'],
    ['白地・右写真と歌詞ボックス','squareRight','lyrics'],
    ['白地・ワイド成績5枠','wide','cells'],
    ['白地・中央の見出し帯','center','header'],
    ['白地・写真左の見出し帯','left','header'],
    ['白地・写真右のコーナーライン','right','corners'],
    ['白地・正方形写真と縦アクセント','squareLeft','rail'],
    ['白地・右写真と成績5枠','squareRight','cells'],
    ['白地・ワイド斜線アクセント','wide','angles'],
    ['白地・中央のスコア帯','center','stats'],
    ['白地・写真左の斜線アクセント','left','angles'],
    ['白地・写真右と下線','right','underline'],
    ['白地・正方形写真の二重枠','squareLeft','double'],
    ['白地・右写真のコーナーライン','squareRight','corners'],
    ['白地・ワイド縦アクセント','wide','rail'],
    ['白地・中央の歌詞ボックス','center','lyrics']
  ];
  const templates = new Map(entries.map(([name,placement,style],i) =>
    ['reference-'+(18+i),{name,placement,style}]));
  const designs = Array.from(templates, ([id,{name,placement}]) =>
    [id,name,layouts[placement].photo?'写真あり・なし対応':'写真なし']);

  function layout(id,noPhoto) {
    const {placement}=templates.get(id);
    const original=layouts[placement];
    const selected=noPhoto&&original.photo?layouts.wide:original;
    const align=selected===layouts.center?'center':'left';
    return {...selected,align,nameAlign:align};
  }

  function paint(ctx,id,state,noPhoto) {
    const {style}=templates.get(id);
    const {left,right,orderY,nameY,statsLabelY,statsValueY,lyricTop,lyricBottom,photo}=layout(id,noPhoto);
    const width=right-left, statsTop=statsLabelY-43, statsHeight=statsValueY-statsTop+22;
    const dark=state.teamDark||'#173b60', accent=state.accent||'#168ac0';
    const line='#cfdce8', tint='#eef4fa';
    const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const frame=(x,y,w,h,color,weight=2)=>{
      ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.strokeRect(x,y,w,h);
    };

    rect(0,0,1280,720,'#ffffff');
    switch(style){
      case 'rules':
        rect(left,orderY-58,96,5,accent);
        rect(left,nameY+14,width,2,line);
        rect(left,lyricTop-14,width,2,dark);
        break;
      case 'stats':
        rect(left-10,statsTop,width+20,statsHeight,tint);
        rect(left-10,statsTop,4,statsHeight,accent);
        rect(left,lyricBottom+7,width,2,line);
        break;
      case 'lyrics':
        rect(left-12,lyricTop-7,width+24,lyricBottom-lyricTop+14,tint);
        rect(left-12,lyricTop-7,4,lyricBottom-lyricTop+14,accent);
        break;
      case 'header':
        rect(left-12,orderY-56,width+24,nameY-orderY+73,tint);
        rect(left-12,orderY-56,width+24,5,accent);
        rect(left,lyricTop-13,width,2,line);
        break;
      case 'underline':
        rect(left,lyricBottom+10,width,4,dark);
        rect(left,lyricBottom+10,Math.min(160,width),4,accent);
        break;
      case 'double':
        frame(25,24,1230,672,dark);
        frame(38,37,1204,646,line);
        rect(left,lyricTop-16,width,2,accent);
        break;
      case 'corners':
        for(const [x,y] of [[38,38],[1188,38],[38,676],[1188,676]])rect(x,y,54,4,dark);
        for(const [x,y] of [[38,38],[1238,38],[38,628],[1238,628]])rect(x,y,4,52,accent);
        rect(left,nameY+12,width,2,line);
        break;
      case 'rail':
        rect(left-22,orderY-52,4,lyricBottom-orderY+64,line);
        rect(left-22,orderY-52,4,nameY-orderY+67,accent);
        rect(left,lyricTop-13,width,2,line);
        break;
      case 'cells':
        for(let cell=0;cell<5;cell++){
          const cellWidth=width/5;
          rect(left+cell*cellWidth+3,statsTop,cellWidth-6,statsHeight,tint);
          rect(left+cell*cellWidth+3,statsTop,cellWidth-6,3,accent);
        }
        break;
      case 'angles':
        ctx.fillStyle=accent;ctx.beginPath();
        ctx.moveTo(1002,0);ctx.lineTo(1280,0);ctx.lineTo(1280,17);ctx.lineTo(982,17);
        ctx.closePath();ctx.fill();
        rect(left,lyricTop-14,width,2,dark);
        break;
    }
    if(photo){
      const [x,y,w,h]=photo;
      rect(x-6,y-6,w+12,h+12,tint);
    }
  }

  window.OuenkaWhiteDesigns={designs,has:id=>templates.has(id),layout,paint};
})();
