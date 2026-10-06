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
    if (!player || !player.audio) {
        console.error("再生データがありません", player);
        setNowPlaying("音源データがありません");
        return;
    }

    stopCurrentSong();
    const attemptId = ++playAttemptId;
    const label = player.name || "";

    // 前奏は2本とも存在するときだけ使用。片方だけなら本編から開始。
    const hasIntroMelody = await urlExists(player.introMelody);
    const hasIntroAccompaniment = await urlExists(player.introAccompaniment);
    if (attemptId !== playAttemptId) return;

    if (hasIntroMelody && hasIntroAccompaniment) {
        const introOK = await playPair(
            player.introMelody,
            player.introAccompaniment,
            attemptId,
            label + "（前奏）"
        );
        if (!introOK || attemptId !== playAttemptId) return;
    }

    // 本編：再生用m4a＋コード進行/ベースm4a。
    // accompaniment が無い既存データは audio.m4a だけで再生できる。
    const hasAccompaniment = await urlExists(player.accompaniment);
    if (attemptId !== playAttemptId) return;

    const ok = await playPair(
        player.audio,
        hasAccompaniment ? player.accompaniment : null,
        attemptId,
        label
    );

    if (ok && attemptId === playAttemptId) {
        setNowPlaying("");
        audioPlayers.forEach(destroyAudio);
        audioPlayers = [];
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
