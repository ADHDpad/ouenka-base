(()=>{'use strict';
const defaults={
 '北海道日本ハムファイターズ':['#0095ee','#01e4fa','#0087cb'],
 '福岡ソフトバンクホークス':['#fdff54','#fffb7d','#c9ca42'],
 '東北楽天ゴールデンイーグルス':['#7c1c37','#a00000','#510b24'],
 '埼玉西武ライオンズ':['#032291','#24acf0','#001861'],
 '千葉ロッテマリーンズ':['#202c39','#536477','#0b1017'],
 'オリックス・バファローズ':['#000070','#00015a','#000015'],
 '読売ジャイアンツ':['#a84c05','#ed861c','#5e2803'],
 '阪神タイガース':['#ceca42','#feff73','#9c9b31'],
 '横浜DeNAベイスターズ':['#0000ff','#00cbea','#0000ff'],
 '広島東洋カープ':['#fb2d4f','#ff0019','#8c0d24'],
 '中日ドラゴンズ':['#000bda','#0322ff','#000552'],
 '東京ヤクルトスワローズ':['#00c223','#02f11f','#007600'],
 '大阪近鉄バファローズ':['#b71e3e','#e94666','#520d24'],
 'オリックス・ブルーウェーブ':['#12549a','#e4b936','#062b55'],
 '日本代表':['#001f94','#c81e3a','#00105e'],
 'その他':['#45566d','#90a9c9','#1e2b40']
};
const key='ouenka_team_palettes_v1';
function read(){try{
 const value=JSON.parse(localStorage.getItem(key)),all=value&&typeof value==='object'?value:{};
 // Restore the requested Fighters palette once, including older device overrides.
 if(localStorage.getItem('ouenka_fighters_palette_r148')!=='1'){
  all['北海道日本ハムファイターズ']=[...defaults['北海道日本ハムファイターズ']];
  localStorage.setItem(key,JSON.stringify(all));localStorage.setItem('ouenka_fighters_palette_r148','1');
 }
 // Apply the requested Lions palette once to existing devices as well.
 if(localStorage.getItem('ouenka_lions_palette_r315')!=='1'){
  all['埼玉西武ライオンズ']=[...defaults['埼玉西武ライオンズ']];

  localStorage.setItem(key,JSON.stringify(all));localStorage.setItem('ouenka_lions_palette_r315','1');
 }
 if(localStorage.getItem('ouenka_baystars_palette_r316')!=='1'){
  all['横浜DeNAベイスターズ']=[...defaults['横浜DeNAベイスターズ']];
  localStorage.setItem(key,JSON.stringify(all));localStorage.setItem('ouenka_baystars_palette_r316','1');
 }
 return all;
}catch{return {}}}
function valid(p){return Array.isArray(p)&&p.length===3&&p.every(c=>/^#[0-9a-f]{6}$/i.test(c))}
const widthKey='ouenka_team_gradient_widths_v1';
function widths(){try{return JSON.parse(localStorage.getItem(widthKey))||{}}catch{return {}}}
function getWidth(team){const n=Number(widths()[team]??100);return Number.isFinite(n)?Math.max(5,Math.min(100,n)):100}
function setWidth(team,value){localStorage.setItem(widthKey,JSON.stringify({...widths(),[team]:Math.max(5,Math.min(100,Number(value)||100))}))}
function stops(width=100){const w=Math.max(5,Math.min(100,Number(width)||100))/100;return [.5-.5*w,.5+.2*w,.5+.5*w]}
function css(p,width=100,angle=110){const at=stops(width);return `linear-gradient(${angle}deg,${p[2]} ${at[0]*100}%,${p[1]} ${at[1]*100}%,${p[0]} ${at[2]*100}%)`}
window.OuenkaTeamColors={getWidth,setWidth,stops,css,defaults,get(team){const p=read()[team];return [...(valid(p)?p:defaults[team]||defaults['その他'])]},all(){return Object.fromEntries(Object.keys(defaults).map(t=>[t,this.get(t)]))},set(team,p){if(!defaults[team]||!valid(p))throw Error('色の指定を確認してください');localStorage.setItem(key,JSON.stringify({...read(),[team]:p}))},reset(team){const w=widths();delete w[team];localStorage.setItem(widthKey,JSON.stringify(w));const all=read();delete all[team];localStorage.setItem(key,JSON.stringify(all))}};
// Apply each team's saved gradient stops to cards and inherited page colors.
function syncWidths(){const palettes=window.OuenkaTeamColors.all();document.querySelectorAll('[style]').forEach(el=>{const props=['--candidate-team','--roster-team','--book-team-main','--team-main','--main'];const color=props.map(k=>el.style.getPropertyValue(k).trim()).find(Boolean);if(!color)return;const team=el.dataset.team||Object.keys(palettes).find(k=>palettes[k][0].toLowerCase()===color.toLowerCase());if(!team)return;stops(getWidth(team)).forEach((n,i)=>{const k='--team-gradient-'+i,v=(n*100)+'%';if(el.style.getPropertyValue(k)!==v)el.style.setProperty(k,v)})})}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncWidths()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-team']});
})();