(function(){
"use strict";
const KEY="ouenkaBaseTeamOrderV1";
const DEFAULT=[
"福岡ソフトバンクホークス",
"北海道日本ハムファイターズ",
"オリックス・バファローズ",
"東北楽天ゴールデンイーグルス",
"埼玉西武ライオンズ",
"千葉ロッテマリーンズ",
"読売ジャイアンツ",
"阪神タイガース",
"横浜DeNAベイスターズ",
"広島東洋カープ",
"東京ヤクルトスワローズ",
"中日ドラゴンズ",
"ブルーウェーブ",
"近鉄",
"日本代表"
];
function get(){
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||"null");
  if(Array.isArray(v)&&v.length===DEFAULT.length&&DEFAULT.every(x=>v.includes(x)))return v;
 }catch(e){}
 return [...DEFAULT];
}
function set(v){localStorage.setItem(KEY,JSON.stringify(v));window.dispatchEvent(new Event("ouenka-team-order-change"))}
function reset(){localStorage.removeItem(KEY);window.dispatchEvent(new Event("ouenka-team-order-change"))}
window.OUENKA_TEAM_ORDER={KEY,DEFAULT:[...DEFAULT],get,set,reset};
})();