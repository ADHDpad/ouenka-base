(()=>{'use strict';
const storage='ouenkaRandomExcludedV1';
const read=()=>{try{return JSON.parse(localStorage.getItem(storage)||'{}')}catch{return {}}};
window.OuenkaRandomSettings={
 excluded(song){if(song.random_excluded!==undefined&&song.random_excluded!==null)return song.random_excluded===true||song.random_excluded===1||song.random_excluded==='1';return !!read()[String(song.id??song.serverId??'')]},
 save(song,excluded){if(song.id==null)return;try{const map=read();map[String(song.id)]=!!excluded;localStorage.setItem(storage,JSON.stringify(map))}catch{}}
};
})();
