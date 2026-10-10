window.ouenkaMissingAudio=window.ouenkaMissingAudio||new Set();
window.ouenkaAudioBytes=window.ouenkaAudioBytes||new Map();
window.ouenkaResolvedAudio=window.ouenkaResolvedAudio||new Map();
window.ouenkaSpecialPresence=window.ouenkaSpecialPresence||new Map();
// iPhone PWA: stop an unresponsive network candidate from blocking all later candidates.
async function ouenkaTimedFetch(url, options={}, timeoutMs=6500){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try { return await fetch(url,{...options,signal:controller.signal}); }
    finally { clearTimeout(timer); }
}
// ========================================
// OUENKA BASE 音楽プレイヤー
// 個別再生：前奏(任意) → 再生用m4a＋コード進行/ベースm4a
// ========================================

let audioPlayers = [];
let playAttemptId = 0;

// v46: ホームの実再生エンジン状態
let homeAudioContext = null;
let homeAudioSources = [];
let homePlaybackActive = false;
let homePaused = false;
let homeEndTimer = null;

function setNowPlaying(text) {
    const now = document.getElementById("nowPlaying");
    if (now) now.textContent = text;
}

function destroyAudio(audio) {
    if (!audio) return;
    try {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute("src");
        audio.load();
    } catch (error) {
        console.warn("Audio破棄:", error);
    }
}

function stopCurrentSong() {
    playAttemptId++;
    audioPlayers.forEach(destroyAudio);
    audioPlayers = [];

    // AudioContextで鳴っている前奏・メロディー・伴奏を全て停止
    if (homeEndTimer) {
        clearTimeout(homeEndTimer);
        homeEndTimer = null;
    }
    homeAudioSources.forEach(src => {
        try { src.stop(); } catch (_) {}
        try { src.disconnect(); } catch (_) {}
    });
    homeAudioSources = [];
    if (homeAudioContext) {
        try { homeAudioContext.close(); } catch (_) {}
    }
    homeAudioContext = null;
    homePlaybackActive = false;
    homePaused = false;
}

function createAudio(src) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 1;
    audio.muted = false;
    audio.playsInline = true;
    audio.src = src;
    return audio;
}

async function urlExists(url) {
    if (!url) return false;
    try {
        const r = await fetch(url, { method: "HEAD", cache: "no-store" });
        return r.ok;
    } catch (_) {
        return false;
    }
}

function waitEnded(audio, attemptId) {
    return new Promise(resolve => {
        const done = () => resolve();
        audio.addEventListener("ended", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        if (attemptId !== playAttemptId) resolve();
    });
}

async function playPair(primarySrc, accompanimentSrc, attemptId, label) {
    if (attemptId !== playAttemptId) return false;

    const primary = primarySrc ? createAudio(primarySrc) : null;
    const accompaniment = accompanimentSrc ? createAudio(accompanimentSrc) : null;
    const pair = [primary, accompaniment].filter(Boolean);
    if (!pair.length) return false;

    audioPlayers = pair;

    try {
        // 同じユーザー操作内で2本をほぼ同時に開始する。
        await Promise.all(pair.map(a => {
            const p = a.play();
            return p && typeof p.then === "function" ? p : Promise.resolve();
        }));
        if (attemptId !== playAttemptId) return false;
        setNowPlaying("♪ 再生中：" + label);
        await Promise.all(pair.map(a => waitEnded(a, attemptId)));
        return attemptId === playAttemptId;
    } catch (error) {
        console.warn("複数音源の再生に失敗:", error);
        pair.forEach(destroyAudio);
        if (attemptId === playAttemptId) setNowPlaying("音源を再生できませんでした");
        return false;
    }
}

async function playSongData(player) {
    showHomeMiniPlayer();
    homePaused=false;
    if (!player || !player.name || !player.productionNumber) {
        console.error("再生データがありません", player);
        setNowPlaying("音源データがありません");
        return;
    }

    stopCurrentSong();
    const attemptId=++playAttemptId;
    const label=player.name||"";
    let ctx=null;

    // 音源候補を探している間は失敗表示にしない
    setNowPlaying("音源を検索中…");

    try{
        ctx=await window.ouenkaAudioRecovery.create();
        homeAudioContext=ctx;
        homePlaybackActive=true;
        homePaused=false;
        await ctx.resume();

        /* 1-9と同じ公開GitHub Pagesを基準にする。
           トップページ自身の相対URLには依存しない。 */
        const PUBLIC_BASE="https://adhdpad.github.io/ouenka-base/";
        const root=PUBLIC_BASE+"%E3%83%87%E3%83%BC%E3%82%BF/";
        const name=String(player.name||"").trim();
        const no=String(player.productionNumber||"").trim();
        const n=encodeURIComponent(name),pn=encodeURIComponent(no);

        function candidateUrls(fileName,registeredUrl=""){
            const f=encodeURIComponent(fileName);
            const list=[];
            if(registeredUrl)list.push(new URL(registeredUrl,PUBLIC_BASE).href);
            list.push(root+n+"/"+pn+"/"+f);       // データ/選手名/制作番号/
            list.push(root+n+"_"+pn+"/"+f);       // データ/選手名_制作番号/
            list.push(root+n+"/"+f);              // データ/選手名/
            list.push(root+n+"/"+pn+"_"+f);       // データ/選手名/制作番号_file
            return [...new Set(list)];
        }

        // Successful URLs and decoded buffers are reused across individual plays.
        // Failed optional files are remembered to avoid repeated 404 downloads.
        async function fetchFirst(fileName,registeredUrl="",optional=false){
            const key=name+"/"+no+"/"+fileName+"/"+registeredUrl;
            const preferred=window.ouenkaResolvedAudio.get(key);
            const urls=[...new Set([preferred,...candidateUrls(fileName,registeredUrl)].filter(Boolean))];
            let lastError=null;
            for(const url of urls){
                if(window.ouenkaMissingAudio?.has(url))continue;
                try{
                    let bytes=window.ouenkaAudioBytes?.get(url);
                    if(!bytes){
                        const response=await ouenkaTimedFetch(url,{credentials:"omit",cache:"force-cache"},6500);
                        if(!response.ok){
                            if(response.status===404)window.ouenkaMissingAudio.add(url);
                            throw new Error(`HTTP ${response.status}`);
                        }
                        bytes=await response.arrayBuffer();
                        if(bytes.byteLength<12)throw new Error('音源データが空です');
                        if(bytes.byteLength<12*1024*1024){
                            window.ouenkaAudioBytes.set(url,bytes);
                            if(window.ouenkaAudioBytes.size>12){
                                window.ouenkaAudioBytes.delete(window.ouenkaAudioBytes.keys().next().value);
                            }
                        }
                    }
                    const decoded=await ctx.decodeAudioData(bytes.slice(0));
                    window.ouenkaResolvedAudio.set(key,url);
                    return decoded;
                }catch(e){lastError=e;}
            }
            if(optional)return null;
            throw lastError||new Error(fileName+" が見つかりません");
        }

        // Only check the canonical location for optional special audio.
        // Older code downloaded up to four missing files sequentially BEFORE normal playback.
        const specialUrl=root+n+"/"+pn+"/special_audio.m4a";
        const special=await (async()=>{
            if(window.ouenkaMissingAudio.has(specialUrl) || window.ouenkaSpecialPresence.get(specialUrl)===false)return null;
            try{
                // Cache the HEAD result so subsequent plays don't repeat a network round trip.
                if(!window.ouenkaSpecialPresence.has(specialUrl)){
                    const r=await ouenkaTimedFetch(specialUrl,{method:"HEAD",credentials:"omit",cache:"force-cache"},1800);
                    if(r.status===404){window.ouenkaMissingAudio.add(specialUrl);window.ouenkaSpecialPresence.set(specialUrl,false);return null;}
                    if(!r.ok)return null;
                    window.ouenkaSpecialPresence.set(specialUrl,true);
                }
                return await fetchFirst("special_audio.m4a",specialUrl,true);
            }catch(e){console.warn('特別版の確認:',e);return null;}
        })();
        if(special){
            if(attemptId!==playAttemptId){try{await ctx.close()}catch(_){}return;}
            const src=ctx.createBufferSource();src.buffer=special;src.connect(ctx.destination);
            homeAudioSources.push(src);src.start(ctx.currentTime+.04);
            setNowPlaying("♪ 特別版再生中："+label);
            src.addEventListener("ended",()=>{if(attemptId===playAttemptId){homePlaybackActive=false;homeAudioSources=[];homeAudioContext=null;setNowPlaying("");ctx.close().catch(()=>{});}}, {once:true});
            return;
        }
        // 前奏あり伴奏があれば再生用音源と同期。なければ通常伴奏。
        const [audio,normalAccompaniment,openingAccompaniment]=await Promise.all([
            fetchFirst("audio.m4a",player.audio||""),
            fetchFirst("accompaniment.m4a",player.accompaniment||""),
            fetchFirst("intro_accompaniment.m4a",player.introAccompaniment||"",true)
        ]);
        const accompaniment=openingAccompaniment||normalAccompaniment;

        if(attemptId!==playAttemptId){
            try{await ctx.close()}catch(e){}
            return;
        }

        const sources=[];
        function schedule(buffer,when){
            const src=ctx.createBufferSource();
            src.buffer=buffer;src.connect(ctx.destination);src.start(when);
            sources.push(src);
            homeAudioSources.push(src);
        }

        try{
            if(navigator.mediaSession){
                navigator.mediaSession.metadata=new MediaMetadata({title:label,artist:'OUENKA BASE',album:'FIGHT SONG'});
                navigator.mediaSession.setActionHandler('play',()=>resumeHomePlayback());
                navigator.mediaSession.setActionHandler('pause',()=>pauseHomePlayback());
                navigator.mediaSession.setActionHandler('stop',()=>stopHomePlayback());
                navigator.mediaSession.playbackState='playing';
            }
        }catch(e){console.warn('MediaSession',e)}
        const base=ctx.currentTime+.04;
        schedule(audio,base);
        schedule(accompaniment,base);
        setNowPlaying("♪ 再生中："+label);
        const total=Math.max(audio.duration,accompaniment.duration);
        if(homeEndTimer) clearTimeout(homeEndTimer);
        homeEndTimer=setTimeout(async()=>{
            if(attemptId===playAttemptId){
                setNowPlaying("");
                homePlaybackActive=false;
                homePaused=false;
                homeAudioSources=[];
                if(homeAudioContext===ctx) homeAudioContext=null;
                try{await ctx.close()}catch(e){}
            }
        },Math.ceil((total+.15)*1000));

    }catch(error){
        console.error("トップ個人再生エラー:",error);
        if(ctx){try{await ctx.close()}catch(e){}}
        if(attemptId===playAttemptId){
            setNowPlaying("音源が見つからないため再生できませんでした");
        }
    }
}

// 旧players.js用も残す
function playSong(playerId) {
    if (typeof players !== "object" || !players || !players[playerId]) {
        console.error("選手データが見つかりません:", playerId);
        return;
    }
    playSongData(players[playerId]);
}


// ===== v46 下部固定プレイヤー（ホーム） =====
function homeMini(){
    return document.getElementById("homeMiniPlayer");
}
function showHomeMiniPlayer(){
    const p=homeMini(); if(p) p.hidden=false;
}
async function pauseHomePlayback(){
    if(!homeAudioContext || !homePlaybackActive || homePaused) return;
    try{
        await homeAudioContext.suspend();
        homePaused=true;
        setNowPlaying("Ⅱ 一時停止中");
        if(navigator.mediaSession) navigator.mediaSession.playbackState="paused";
    }catch(e){ console.warn("一時停止失敗",e); }
}
async function resumeHomePlayback(){
    if(!homeAudioContext || !homePlaybackActive) return;
    try{
        await homeAudioContext.resume();
        homePaused=false;
        setNowPlaying("♪ 再生中");
        if(navigator.mediaSession) navigator.mediaSession.playbackState="playing";
    }catch(e){ console.warn("再開失敗",e); }
}
function stopHomePlayback(){
    stopCurrentSong();
    setNowPlaying("");
    const p=homeMini(); if(p) p.hidden=true;
    if(navigator.mediaSession) navigator.mediaSession.playbackState="none";
}
document.addEventListener("DOMContentLoaded",()=>{
    const pause=document.getElementById("homePause");
    const play=document.getElementById("homePlay");
    const stop=document.getElementById("homeStop");
    if(pause) pause.addEventListener("click",pauseHomePlayback);
    if(play) play.addEventListener("click",resumeHomePlayback);
    if(stop) stop.addEventListener("click",stopHomePlayback);
});

// 他アプリから戻った後のAudioContext復帰。ユーザー操作が必要な場合は再生ボタンで再試行。
async function recoverHomeAudio(){if(homeAudioContext&&homePlaybackActive&&!homePaused&&homeAudioContext.state==="suspended"){try{await homeAudioContext.resume();}catch(e){console.warn("音声復帰待ち",e);}}}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)recoverHomeAudio();});
window.addEventListener("pageshow",recoverHomeAudio);
window.addEventListener("focus",recoverHomeAudio);
