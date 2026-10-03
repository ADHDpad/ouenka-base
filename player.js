// ========================================
// OUENKA BASE 音楽プレイヤー
// iPhone 他アプリ再生後の復帰対策版
// ========================================

let audioPlayer = null;
let currentAudioUrl = "";
let currentPlayerName = "";
let needsAudioReset = true;

function setNowPlaying(text) {
    const now = document.getElementById("nowPlaying");
    if (now) now.textContent = text;
}

function destroyAudioPlayer() {
    if (!audioPlayer) {
        currentAudioUrl = "";
        return;
    }

    try {
        audioPlayer.pause();
        try { audioPlayer.currentTime = 0; } catch (_) {}
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
    } catch (error) {
        console.warn("Audio破棄処理:", error);
    }

    audioPlayer = null;
    currentAudioUrl = "";
}

function createFreshAudio() {
    destroyAudioPlayer();

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = 1;
    audio.muted = false;
    audio.setAttribute("playsinline", "");

    audio.addEventListener("playing", function () {
        if (currentPlayerName) {
            setNowPlaying("♪ 再生中：" + currentPlayerName);
        }
    });

    audio.addEventListener("error", function () {
        console.error("Audioエラー:", audio.error, currentAudioUrl);
        needsAudioReset = true;
        setNowPlaying("音源を読み込めませんでした");
    });

    audio.addEventListener("abort", function () {
        needsAudioReset = true;
    });

    audioPlayer = audio;
    needsAudioReset = false;
    return audioPlayer;
}

function stopCurrentSong() {
    if (!audioPlayer) return;

    try {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    } catch (error) {
        console.warn("停止処理:", error);
    }
}

// 他アプリへ移動したら、iOSに中断されたAudioを残さない。
function resetAudioForAppSwitch() {
    needsAudioReset = true;
    destroyAudioPlayer();
}

document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
        resetAudioForAppSwitch();
    } else {
        needsAudioReset = true;
    }
});

window.addEventListener("pageshow", function () {
    resetAudioForAppSwitch();
});

window.addEventListener("focus", function () {
    if (document.visibilityState === "visible") {
        needsAudioReset = true;
    }
});

async function playSongData(player) {
    if (!player || !player.audio) {
        console.error("再生データがありません", player);
        setNowPlaying("音源データがありません");
        return;
    }

    currentPlayerName = player.name || "";
    setNowPlaying("読み込み中：" + currentPlayerName);

    // 曲を押すたびに新品Audioへ交換。
    // 他アプリによって中断されたAudioを再利用しない。
    createFreshAudio();

    currentAudioUrl = player.audio;
    audioPlayer.src = currentAudioUrl;
    audioPlayer.preload = "auto";
    audioPlayer.volume = 1;
    audioPlayer.muted = false;

    try {
        const playPromise = audioPlayer.play();
        if (playPromise) await playPromise;
        needsAudioReset = false;
    } catch (error) {
        console.error("再生エラー:", error, currentAudioUrl);

        // 1回だけ新品Audioで再試行
        try {
            createFreshAudio();

            currentAudioUrl = player.audio;
            audioPlayer.src = currentAudioUrl;
            audioPlayer.preload = "auto";
            audioPlayer.volume = 1;
            audioPlayer.muted = false;

            const retryPromise = audioPlayer.play();
            if (retryPromise) await retryPromise;

            needsAudioReset = false;
            setNowPlaying("♪ 再生中：" + currentPlayerName);
        } catch (retryError) {
            console.error("再生再試行エラー:", retryError, currentAudioUrl);

            needsAudioReset = true;
            destroyAudioPlayer();
            setNowPlaying("音源を再生できませんでした");
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

console.log("OUENKA BASE iPhone音声復帰対策 準備完了");
