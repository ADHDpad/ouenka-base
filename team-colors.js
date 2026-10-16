(()=>{'use strict';
const defaults={
 '北海道日本ハムファイターズ':['#07549a','#1392c6','#062e55'],
 '福岡ソフトバンクホークス':['#d6a500','#f3c930','#665000'],
 '東北楽天ゴールデンイーグルス':['#8d1538','#bf3157','#510c24'],
 '埼玉西武ライオンズ':['#153e70','#3278ac','#071f41'],
 '千葉ロッテマリーンズ':['#202c39','#536477','#0b1017'],
 'オリックス・バファローズ':['#172c59','#5477a4','#0c1733'],
 '読売ジャイアンツ':['#a84c05','#ed861c','#5e2803'],
 '阪神タイガース':['#c49a00','#e4c738','#3c3500'],
 '横浜DeNAベイスターズ':['#0752a0','#269ad5','#032b60'],
 '広島東洋カープ':['#a9132b','#e34150','#620818'],
 '中日ドラゴンズ':['#0753a2','#2d90d2','#032f61'],
 '東京ヤクルトスワローズ':['#087c69','#30a895','#06463e'],
 '大阪近鉄バファローズ':['#b71e3e','#e94666','#520d24'],
 'オリックス・ブルーウェーブ':['#12549a','#e4b936','#062b55'],
 '日本代表':['#132947','#c91f3a','#080f20'],
 'その他':['#45566d','#90a9c9','#1e2b40']
};
const key='ouenka_team_palettes_v1';
function read(){try{const value=JSON.parse(localStorage.getItem(key));return value&&typeof value==='object'?value:{}}catch{return {}}}
function valid(p){return Array.isArray(p)&&p.length===3&&p.every(c=>/^#[0-9a-f]{6}$/i.test(c))}
window.OuenkaTeamColors={defaults,get(team){const p=read()[team];return [...(valid(p)?p:defaults[team]||defaults['その他'])]},all(){return Object.fromEntries(Object.keys(defaults).map(t=>[t,this.get(t)]))},set(team,p){if(!defaults[team]||!valid(p))throw Error('色の指定を確認してください');localStorage.setItem(key,JSON.stringify({...read(),[team]:p}))},reset(team){const all=read();delete all[team];localStorage.setItem(key,JSON.stringify(all))}};
})();