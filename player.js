// ========================================
// OUENKA BASE 音楽プレイヤー
// 個別再生：前奏(任意) → 再生用m4a＋コード進行/ベースm4a
// ========================================

let audioPlayers = [];
let playAttemptId = 0;

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
        ctx=new (window.AudioContext||window.webkitAudioContext)();
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

        async function fetchFirst(fileName,registeredUrl="",optional=false){
            let lastError=null;
            for(const url of candidateUrls(fileName,registeredUrl)){
                try{
                    const response=await fetch(url,{
                        cache:"no-store",
                        credentials:"omit"
                    });
                    if(!response.ok)throw new Error(`HTTP ${response.status}`);
                    const data=await response.arrayBuffer();
                    return await ctx.decodeAudioData(data.slice(0));
                }catch(e){
                    lastError=e;
                }
            }
            if(optional)return null;
            throw lastError||new Error(fileName+" が見つかりません");
        }

        /* 1-9のNo.再生と同じ4本を取得 */
        const [audio,accompaniment,im,ia]=await Promise.all([
            fetchFirst("audio.m4a",player.audio||""),
            fetchFirst("accompaniment.m4a",player.accompaniment||""),
            fetchFirst("intro_melody.m4a",player.introMelody||"",true),
            fetchFirst("intro_accompaniment.m4a",player.introAccompaniment||"",true)
        ]);

        if(attemptId!==playAttemptId){
            try{await ctx.close()}catch(e){}
            return;
        }

        const intro=(im&&ia)?{melody:im,accompaniment:ia}:null;
        const BAR_SEC=(60/170)*4;

        function audibleEnd(buffer){
            const sr=buffer.sampleRate,block=Math.max(1,Math.floor(sr*.020));
            const threshold=Math.pow(10,-48/20);
            let last=0;
            for(let i=0;i<buffer.length;i+=block){
                const to=Math.min(buffer.length,i+block);
                let peak=0;
                for(let c=0;c<buffer.numberOfChannels;c++){
                    const data=buffer.getChannelData(c);
                    for(let j=i;j<to;j++)peak=Math.max(peak,Math.abs(data[j]));
                }
                if(peak>threshold)last=to;
            }
            return last/sr;
        }
        function joinOffset(pair){
            const end=Math.max(audibleEnd(pair.melody),audibleEnd(pair.accompaniment));
            const bars=Math.max(2,Math.ceil(Math.max(0,end-.035)/BAR_SEC));
            return Math.max(0,(bars-2)*BAR_SEC);
        }

        const sources=[];
        function schedule(buffer,when){
            const src=ctx.createBufferSource();
            src.buffer=buffer;src.connect(ctx.destination);src.start(when);
            sources.push(src);
        }

        const base=ctx.currentTime+.04;
        const mainStart=intro?joinOffset(intro):0;
        if(intro){
            schedule(intro.melody,base);
            schedule(intro.accompaniment,base);
        }
        schedule(audio,base+mainStart);
        schedule(accompaniment,base+mainStart);
        setNowPlaying("♪ 再生中："+label);

        const total=Math.max(
            mainStart+audio.duration,mainStart+accompaniment.duration,
            intro?intro.melody.duration:0,intro?intro.accompaniment.duration:0
        );
        setTimeout(async()=>{
            if(attemptId===playAttemptId){
                setNowPlaying("");
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
