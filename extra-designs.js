/* Additional 16:9 layouts use the studio's shared text, photo and export renderer. */
(()=>{'use strict';
const designs=[['reference-8','サイドライン','写真左・二重ライン'],['reference-9','ホワイト・エディトリアル','写真右・白い情報パネル'],['reference-10','ワイドヘッドライン','写真左下・横長の名前帯'],['reference-11','フレーム・アリーナ','写真左・独立した成績枠'],['reference-12','エッジ・スポーツ','写真右・斜線アクセント'],['reference-13','センターフレーム','写真なし・中央揃え'],['reference-14','サイドレール','写真なし・左揃え'],['reference-15','スコアパネル','写真なし・成績と歌詞のパネル'],['reference-16','ホワイト・プレス','写真なし・白い背景'],['reference-17','ナンバーブロック','写真なし・大きな打順枠']];
const ids=new Set(designs.map(d=>d[0])),light=new Set(['reference-9','reference-16']);
function layout(id,noPhoto){if(!ids.has(id))return null;const l={left:530,right:1218,orderY:85,nameY:220,statsLabelY:292,statsValueY:350,lyricTop:408,lyricBottom:670,align:'left',nameAlign:'left',photo:[40,40,432,640]};
if(id==='reference-9')Object.assign(l,{left:66,right:770,photo:[826,36,414,648],orderY:88,nameY:222});
if(id==='reference-10')Object.assign(l,{left:510,right:1218,orderY:62,nameY:218,statsLabelY:298,statsValueY:355,lyricTop:422,lyricBottom:674,photo:[38,270,420,410]});
if(id==='reference-11')Object.assign(l,{left:528,right:1206,orderY:94,nameY:224,statsLabelY:304,statsValueY:364,lyricTop:436,lyricBottom:656,photo:[54,88,416,544],align:'center',nameAlign:'center'});
if(id==='reference-12')Object.assign(l,{left:70,right:754,orderY:96,nameY:230,statsLabelY:304,statsValueY:364,lyricTop:430,lyricBottom:668,photo:[814,52,400,616]});
if(id==='reference-13')Object.assign(l,{left:104,right:1176,orderY:92,nameY:230,statsLabelY:304,statsValueY:362,lyricTop:434,lyricBottom:648,align:'center',nameAlign:'center',photo:null});
if(id==='reference-14')Object.assign(l,{left:208,right:1192,orderY:90,nameY:238,statsLabelY:314,statsValueY:374,lyricTop:444,lyricBottom:674,photo:null});
if(id==='reference-15')Object.assign(l,{left:78,right:1202,orderY:78,nameY:214,statsLabelY:300,statsValueY:360,lyricTop:440,lyricBottom:658,align:'center',nameAlign:'center',photo:null});
if(id==='reference-16')Object.assign(l,{left:88,right:1192,orderY:100,nameY:248,statsLabelY:328,statsValueY:388,lyricTop:456,lyricBottom:666,photo:null});
if(id==='reference-17')Object.assign(l,{left:350,right:1204,orderY:100,nameY:238,statsLabelY:310,statsValueY:370,lyricTop:448,lyricBottom:666,photo:null});
if(noPhoto&&l.photo){l.photo=null;l.left=92;l.right=1188;l.align='center';l.nameAlign='center'}return l}
function paint(ctx,id,s,helpers){if(!ids.has(id))return false;const dark=s.teamDark||'#062e55',main=s.color||'#07549a',accent=s.accent||'#1392c6',l=layout(id,false);const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)},stroke=(x,y,w,h,c,n=2)=>{ctx.strokeStyle=c;ctx.lineWidth=n;ctx.strokeRect(x,y,w,h)},poly=(points,c)=>{ctx.fillStyle=c;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()};
helpers.background();
if(id==='reference-8'){rect(496,24,6,672,accent);stroke(20,20,1240,680,accent);rect(522,252,710,4,accent);rect(522,390,710,2,accent)}
if(id==='reference-9'){rect(0,0,1280,720,'#ffffff');rect(30,22,766,676,'#ffffff');rect(30,22,766,12,accent);rect(62,254,708,3,main);rect(62,394,708,2,main);rect(1260,0,20,720,accent)}
if(id==='reference-10'){rect(0,0,1280,248,dark);rect(0,244,1280,8,accent);rect(484,278,4,392,accent);rect(510,396,708,3,accent)}
if(id==='reference-11'){rect(24,28,1232,664,dark);stroke(34,38,1212,644,accent,3);stroke(510,260,714,132,accent);rect(510,414,714,250,main);rect(42,74,440,572,accent)}
if(id==='reference-12'){poly([[788,0],[826,0],[1048,720],[1010,720]],accent);rect(46,44,722,632,dark);rect(60,260,694,5,accent);rect(60,402,694,2,accent)}
if(id==='reference-13'){stroke(30,30,1220,660,accent,4);stroke(44,44,1192,632,accent);rect(434,270,412,4,accent);rect(104,396,1072,2,accent)}
if(id==='reference-14'){rect(0,0,150,720,dark);rect(150,0,14,720,accent);for(let y=48;y<700;y+=74)rect(32,y,86,5,accent);rect(208,270,984,6,accent);rect(208,410,984,2,accent)}
if(id==='reference-15'){rect(34,28,1212,208,dark);rect(46,258,1188,140,dark);rect(46,422,1188,260,dark);stroke(46,258,1188,140,accent);rect(46,422,8,260,accent);for(let i=1;i<5;i++)rect(78+(1124/5)*i,280,2,96,accent)}
if(id==='reference-16'){rect(0,0,1280,720,'#ffffff');rect(0,0,1280,22,main);rect(42,50,1196,6,accent);rect(88,282,1104,6,main);rect(88,420,1104,2,main);rect(0,700,1280,20,accent)}
if(id==='reference-17'){rect(24,38,270,644,dark);stroke(24,38,270,644,accent,4);rect(324,38,4,644,accent);rect(350,272,854,4,accent);rect(350,410,854,2,accent)}
return true}
window.OuenkaExtraDesigns={designs,has:id=>ids.has(id),isLight:id=>light.has(id),noPhoto:id=>/^reference-1[3-7]$/.test(id),layout,paint};
})();
