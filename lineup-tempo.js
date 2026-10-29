/* Song-local bar timing. Audio samples and playback rate remain unchanged. */
(()=>{'use strict';
const tempo=s=>Number(s?.tempo)===140?140:170;
const barSeconds=s=>240/tempo(s);
function joinOffset(song,openingExtraSec=0){
 const bar=barSeconds(song),total=Math.max(song.melody.duration,song.accompaniment.duration),body=Math.max(0,total-openingExtraSec),bars=Math.max(1,Math.round(body/bar)),musicalBars=bars>=13?16:8;
 return openingExtraSec+musicalBars*bar;
}
function starts(songs,openingExtraSec=0){let cursor=0;return songs.map((song,i)=>{const start=cursor;if(i<songs.length-1)cursor+=joinOffset(song,i===0?openingExtraSec:0);return start})}
window.OuenkaLineupTempo={tempo,barSeconds,joinOffset,starts};
})();
