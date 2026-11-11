/* Additional 16:9 layouts use the studio's shared text, photo and export renderer. */
(()=>{'use strict';
const designs=[['reference-8','サイドライン','写真左・二重ライン'],['reference-9','ホワイト・エディトリアル','写真右・白い情報パネル'],['reference-10','白地の選手カード','写真左・白地に球団色の罫線'],['reference-11','ナイトゲーム','写真右・濃紺と球団色のアクセント'],['reference-12','スコアシート','写真なし・成績を横一列に配置'],['reference-13','センターフレーム','写真なし・中央揃え'],['reference-14','スタメン一覧','打順・守備位置・選手名を表示'],['reference-15','スコアパネル','写真なし・成績と歌詞のパネル'],['reference-16','ホワイト・プレス','写真なし・白い背景'],['reference-17','ワイド歌詞','写真なし・歌詞を大きく表示']];
const added=window.OuenkaStudioTemplates;
designs.push(...added.designs);
const ids=new Set(designs.map(d=>d[0])),light=new Set(['reference-9','reference-10','reference-12','reference-16']);
function layout(id,noPhoto){if(added.has(id))return added.layout(id,noPhoto);if(!ids.has(id))return null;const l={left:530,right:1218,orderY:85,nameY:220,statsLabelY:292,statsValueY:350,lyricTop:408,lyricBottom:670,align:'left',nameAlign:'left',photo:[40,40,432,640]};
if(id==='reference-9')Object.assign(l,{left:66,right:770,photo:[826,36,414,648],orderY:88,nameY:222});
if(id==='reference-10')Object.assign(l,{left:490,right:1212,orderY:130,nameY:245,statsLabelY:316,statsValueY:373,lyricTop:423,lyricBottom:650,photo:[58,96,386,528]});
if(id==='reference-11')Object.assign(l,{left:64,right:794,orderY:110,nameY:239,statsLabelY:305,statsValueY:361,lyricTop:421,lyricBottom:652,photo:[852,58,362,604]});
if(id==='reference-12')Object.assign(l,{left:84,right:1196,orderY:124,nameY:244,statsLabelY:320,statsValueY:381,lyricTop:451,lyricBottom:663,photo:null});
if(id==='reference-13')Object.assign(l,{left:104,right:1176,orderY:92,nameY:230,statsLabelY:304,statsValueY:362,lyricTop:434,lyricBottom:648,align:'center',nameAlign:'center',photo:null});
if(id==='reference-15')Object.assign(l,{left:78,right:1202,orderY:78,nameY:214,statsLabelY:300,statsValueY:360,lyricTop:440,lyricBottom:658,align:'center',nameAlign:'center',photo:null});
if(id==='reference-16')Object.assign(l,{left:88,right:1192,orderY:100,nameY:248,statsLabelY:328,statsValueY:388,lyricTop:456,lyricBottom:666,photo:null});
if(id==='reference-17')Object.assign(l,{left:90,right:1190,orderY:92,nameY:202,statsLabelY:264,statsValueY:315,lyricTop:366,lyricBottom:662,align:'center',nameAlign:'center',photo:null});
if(noPhoto&&l.photo){l.photo=null;l.left=92;l.right=1188;l.align='center';l.nameAlign='center'}return window.OuenkaBroadcast.fitPlayerPhotoLayout(l)}
function paint(ctx,id,s,helpers,noPhoto=false){if(added.has(id)){added.paint(ctx,id,s,noPhoto);return true}if(!ids.has(id))return false;const dark=s.teamDark||'#062e55',main=s.color||'#07549a',accent=s.accent||'#1392c6',l=layout(id,noPhoto);const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)},stroke=(x,y,w,h,c,n=2)=>{ctx.strokeStyle=c;ctx.lineWidth=n;ctx.strokeRect(x,y,w,h)};
helpers.background();
if(id==='reference-8'){if(l.photo)rect(l.left-20,24,6,672,accent);stroke(20,20,1240,680,accent);rect(l.left,252,l.right-l.left,4,accent);rect(l.left,390,l.right-l.left,2,accent)}
if(id==='reference-9'){rect(0,0,1280,720,'#ffffff');rect(30,22,766,676,'#ffffff');rect(30,22,l.right-30,12,accent);rect(l.left,254,l.right-l.left,3,main);rect(l.left,394,l.right-l.left,2,main);rect(1260,0,20,720,accent)}
if(id==='reference-10'){
 rect(0,0,1280,720,'#f3f6fa');rect(32,32,1216,656,'#fff');rect(32,32,1216,12,main);
 if(l.photo){const [x,y,w,h]=l.photo;rect(x-8,y-8,w+16,h+16,'#dce5ef')}
 rect(l.left,269,l.right-l.left,4,main);rect(l.left,400,l.right-l.left,2,'#ccd7e5');
}
if(id==='reference-11'){
 rect(0,0,1280,720,'#091629');rect(0,0,1280,12,accent);
 rect(l.left-12,271,l.right-l.left+24,116,'#182b44');
 rect(l.left-12,409,l.right-l.left+24,253,'#122138');
 if(l.photo){const [x,y,w,h]=l.photo;rect(x-6,y-6,w+12,h+12,accent)}
}
if(id==='reference-12'){
 rect(0,0,1280,720,'#fff');rect(0,0,24,720,main);
 rect(70,270,1140,139,'#eaf0f6');rect(70,270,1140,5,main);
 for(let i=1;i<5;i++)rect(l.left+(l.right-l.left)*i/5,287,2,105,'#c5d2df');
 rect(70,434,1140,3,accent);
}
if(id==='reference-13'){stroke(30,30,1220,660,accent,4);stroke(44,44,1192,632,accent);rect(434,270,412,4,accent);rect(104,396,1072,2,accent)}
if(id==='reference-15'){rect(34,28,1212,208,dark);rect(46,258,1188,140,dark);rect(46,422,1188,260,dark);stroke(46,258,1188,140,accent);rect(46,422,8,260,accent);for(let i=1;i<5;i++)rect(78+(1124/5)*i,280,2,96,accent)}
if(id==='reference-16'){rect(0,0,1280,720,'#ffffff');rect(0,0,1280,22,main);rect(42,50,1196,6,accent);rect(88,282,1104,6,main);rect(88,420,1104,2,main);rect(0,700,1280,20,accent)}
if(id==='reference-17'){
 rect(0,0,1280,720,'#0a1728');rect(0,0,1280,10,main);
 rect(70,228,1140,104,'#1b2b41');rect(70,355,1140,320,'#102339');
 rect(70,355,1140,5,accent);rect(70,670,1140,5,accent);
}
return true}
window.OuenkaExtraDesigns={designs,has:id=>ids.has(id),isLight:id=>light.has(id)||added.isLight(id),noPhoto:id=>/^reference-1[2-7]$/.test(id)||(added.has(id)&&!added.layout(id,false).photo),layout,paint};
})();
