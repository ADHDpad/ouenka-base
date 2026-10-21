(()=>{'use strict';
const defaults={
 '北海道日本ハムファイターズ':['#0095ee','#01e4fa','#0087cb'],
 '福岡ソフトバンクホークス':['#eaea00','#f0de02','#897f00'],
 '東北楽天ゴールデンイーグルス':['#7c1c37','#a00000','#510b24'],
 '埼玉西武ライオンズ':['#153e70','#3278ac','#071f41'],
 '千葉ロッテマリーンズ':['#202c39','#536477','#0b1017'],
 'オリックス・バファローズ':['#172c59','#5477a4','#0c1733'],
 '読売ジャイアンツ':['#a84c05','#ed861c','#5e2803'],
 '阪神タイガース':['#c49a00','#e4c738','#3c3500'],
 '横浜DeNAベイスターズ':['#0752a0','#269ad5','#032b60'],
 '広島東洋カープ':['#a9132b','#e34150','#620818'],
 '中日ドラゴンズ':['#000bda','#0322ff','#000552'],
 '東京ヤクルトスワローズ':['#00c223','#02f11f','#007600'],
 '大阪近鉄バファローズ':['#b71e3e','#e94666','#520d24'],
 'オリックス・ブルーウェーブ':['#12549a','#e4b936','#062b55'],
 '日本代表':['#001f94','#c81e3a','#00105e'],
 'その他':['#45566d','#90a9c9','#1e2b40']
};
const key='ouenka_team_palettes_v1';
function read(){try{const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==='object'?value:{}}catch{return {}}}
function valid(p){return Array.isArray(p)&&p.length===3&&p.every(c=>/^#[0-9a-f]{6}$/i.test(c))}
window.OuenkaTeamColors={defaults,get(team){const p=read()[team];return [...(valid(p)?p:defaults[team]||defaults['その他'])]},all(){return Object.fromEntries(Object.keys(defaults).map(t=>[t,this.get(t)]))},set(team,p){if(!defaults[team]||!valid(p))throw Error('色の指定を確認してください');localStorage.setItem(key,JSON.stringify({...read(),[team]:p}))},reset(team){const all=read();delete all[team];localStorage.setItem(key,JSON.stringify(all))}};
})();