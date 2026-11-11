/* Additional 16:9 illustration templates. Coordinates are shared by preview and export. */
(() => {
  'use strict';

  const layouts = {
    left: {left:520,right:1204,photo:[56,58,410,604],orderY:102,nameY:225,statsLabelY:300,statsValueY:356,lyricTop:414,lyricBottom:657},
    right: {left:74,right:762,photo:[814,58,410,604],orderY:102,nameY:225,statsLabelY:300,statsValueY:356,lyricTop:414,lyricBottom:657},
    squareLeft: {left:480,right:1202,photo:[62,171,366,366],orderY:98,nameY:220,statsLabelY:285,statsValueY:337,lyricTop:392,lyricBottom:666},
    squareRight: {left:78,right:800,photo:[852,171,366,366],orderY:98,nameY:220,statsLabelY:285,statsValueY:337,lyricTop:392,lyricBottom:666},
    wide: {left:86,right:1194,photo:null,orderY:89,nameY:200,statsLabelY:263,statsValueY:313,lyricTop:367,lyricBottom:666},
    slimLeft: {left:372,right:1208,photo:[62,91,264,538],orderY:104,nameY:221,statsLabelY:286,statsValueY:340,lyricTop:391,lyricBottom:664},
    slimRight: {left:72,right:908,photo:[954,91,264,538],orderY:104,nameY:221,statsLabelY:286,statsValueY:340,lyricTop:391,lyricBottom:664},
    center: {left:145,right:1135,photo:null,orderY:116,nameY:237,statsLabelY:305,statsValueY:357,lyricTop:416,lyricBottom:648}
  };

  const placements = Object.keys(layouts);
  const placementLabels = ['写真左','写真右','写真左・低めの見出し','写真右・低めの見出し','横長・写真なし','写真左・ワイド歌詞','写真右・ワイド歌詞','中央・写真なし'];
  const styles = [
    ['rules','細罫線'],['stats','成績帯'],['lyrics','歌詞パネル'],['header','見出し帯'],
    ['underline','裾ライン'],['double','二重枠'],['corners','四隅ライン'],['rail','縦ライン'],
    ['cells','成績5枠'],['angles','斜線アクセント']
  ];
  const backgrounds = {white:'白地',team:'球団色',navy:'濃紺'};
  const noStats = new Set([29,37,45,51,52,53,59,64,69,74,79,84,89,94,100]);
  const retained = {
    51:{placement:'left',style:'rules',align:'left'},
    52:{placement:'right',style:'lyrics',align:'left'},
    53:{placement:'center',style:'double',align:'center'}
  };

  // This permutation distributes the layout families across the gallery pages.
  const templates = new Map(Array.from({length:80},(_,index)=>{
    const number=index+21;
    const slot=(index*27)%80;
    const placementIndex=slot%placements.length;
    const [baseStyle,baseLabel]=styles[Math.floor(slot/placements.length)];
    const showStats=!noStats.has(number);
    const [style,styleLabel]=!showStats&&['stats','cells'].includes(baseStyle)
      ?styles[index%2===0?2:9]:[baseStyle,baseLabel];
    const background=retained[number]?'white':index%7===2||index%7===6?'team':index%7===4?'navy':'white';
    const align=['left','center','right'][(Math.imul(number,2654435761)>>>0)%3];
    const settings={placement:placements[placementIndex],style,align,...retained[number],background,showStats};
    const label=retained[number]
      ?'成績なし・'+({'left':'写真左','right':'写真右','center':'写真なし'})[settings.placement]
      :[backgrounds[background],placementLabels[placementIndex],styleLabel,...(showStats?[]:['成績なし'])].join('・');
    return ['reference-'+(number-3),{...settings,label}];
  }));
  const designs=Array.from(templates,([id,{label,placement,showStats}])=>
    [id,label,[layouts[placement].photo?'写真あり・なし対応':'写真なし',showStats?'成績あり':'成績なし'].join('・')]);

  function mix(base,accent,amount){
    if(!/^#[0-9a-f]{6}$/i.test(accent||''))return base;
    return '#'+[1,3,5].map(i=>{
      const from=parseInt(base.slice(i,i+2),16),to=parseInt(accent.slice(i,i+2),16);
      return Math.round(from+(to-from)*amount).toString(16).padStart(2,'0');
    }).join('');
  }

  function layout(id,noPhoto) {
    const {placement,showStats,align}=templates.get(id);
    const original=layouts[placement];
    const selected=noPhoto&&original.photo?layouts.wide:original;
    return window.OuenkaBroadcast.fitPlayerPhotoLayout({...selected,showStats,align,nameAlign:selected===layouts.center?'center':'left',lyricTop:showStats?selected.lyricTop:selected.nameY+48});
  }

  function paint(ctx,id,state,noPhoto) {
    const {style,background}=templates.get(id);
    const {left,right,orderY,nameY,statsLabelY,statsValueY,lyricTop,lyricBottom,photo}=layout(id,noPhoto);
    const width=right-left, statsTop=statsLabelY-43, statsHeight=statsValueY-statsTop+22;
    const light=background==='white';
    const teamColor=state.color||'#1960a1';
    const accent=state.accent||'#168ac0';
    const dark=light?state.teamDark||'#173b60':mix('#67869f',accent,.3);
    const line=light?'#cfdce8':mix('#324861',accent,.17);
    const tint=light?'#eef4fa':mix('#172940',teamColor,.18);
    const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    const frame=(x,y,w,h,color,weight=2)=>{
      ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.strokeRect(x,y,w,h);
    };

    if(background==='team'){
      const gradient=ctx.createLinearGradient(0,720,1280,0);
      gradient.addColorStop(0,mix('#091522',state.teamDark,.45));
      gradient.addColorStop(1,mix('#101c2c',teamColor,.42));
      rect(0,0,1280,720,gradient);
    }else{
      rect(0,0,1280,720,light?'#ffffff':'#0a1528');
    }
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

  window.OuenkaStudioTemplates={designs,has:id=>templates.has(id),isLight:id=>templates.get(id)?.background==='white',layout,paint};
})();
