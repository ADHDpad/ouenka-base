// ========================================
// OUENKA BASE 音楽プレイヤー
// ========================================

let audioPlayer = null;

function stopCurrentSong() {
    if (!audioPlayer) return;
    try {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        audioPlayer.removeAttribute("src");
        audioPlayer.load();
    } catch (error) {
        console.warn("停止処理:", error);
    }
}

function playSongData(player) {
    if (!player || !player.audio) {
        console.error("再生データがありません", player);
        const now = document.getElementById("nowPlaying");
        if (now) now.textContent = "音源データがありません";
        return;
    }

    stopCurrentSong();

    audioPlayer = new Audio();
    audioPlayer.preload = "auto";
    audioPlayer.volume = 1;
    audioPlayer.muted = false;
    audioPlayer.src = player.audio;

    audioPlayer.addEventListener("playing", () => {
        const now = document.getElementById("nowPlaying");
        if (now) now.textContent = "♪ 再生中：" + (player.name || "");
    });

    audioPlayer.addEventListener("error", () => {
        console.error("Audioエラー:", audioPlayer.error, player.audio);
        const now = document.getElementById("nowPlaying");
        if (now) now.textContent = "音源を読み込めませんでした";
    });

    const promise = audioPlayer.play();
    if (promise) {
        promise.catch(error => {
            console.error("再生エラー:", error, player.audio);
            const now = document.getElementById("nowPlaying");
            if (now) now.textContent = "音源を再生できませんでした";
        });
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
