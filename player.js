// ========================================
// OUENKA BASE 音楽プレイヤー
// 高速再生・iPhone再生リセット対応版
// ========================================

let audioPlayer = new Audio();
audioPlayer.preload = "auto";
audioPlayer.volume = 1;
audioPlayer.muted = false;

let currentAudioUrl = "";

function setNowPlaying(text) {
    const now = document.getElementById("nowPlaying");
    if (now) now.textContent = text;
}

// 前の応援歌再生を完全に解除する。
// iPhone/PWAで前回のAudio状態が残るケースもここでリセットする。
function stopCurrentSong() {
    try {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;

        if (currentAudioUrl) {
            audioPlayer.removeAttribute("src");
            audioPlayer.load();
            currentAudioUrl = "";
        }
    } catch (error) {
        console.warn("停止処理:", error);
    }
}

// iPhone側に残っている「このサイトの前の音声状態」を解除してから
// 新しい音源を同じAudio要素で再生する。
async function resetAndPlay(url) {
    try {
        audioPlayer.pause();

        try {
            audioPlayer.currentTime = 0;
        } catch (_) {}

        // srcを差し替える前に一度空にしてメディア状態をリセット
        audioPlayer.removeAttribute("src");
        audioPlayer.load();

        currentAudioUrl = url;
        audioPlayer.src = url;
        audioPlayer.preload = "auto";
        audioPlayer.volume = 1;
        audioPlayer.muted = false;

        // load()で即読み込み開始。再生ボタンのタップ中にplay()へ進む。
        audioPlayer.load();

        await audioPlayer.play();
    } catch (error) {
        console.error("再生エラー:", error, url);

        // iPhoneで一時的にメディア状態が競合した場合の1回だけの再試行
        try {
            audioPlayer.pause();
            audioPlayer.removeAttribute("src");
            audioPlayer.load();

            currentAudioUrl = url;
            audioPlayer.src = url;
            audioPlayer.preload = "auto";
            audioPlayer.load();

            await audioPlayer.play();
            return;
        } catch (retryError) {
            console.error("再生再試行エラー:", retryError, url);
            setNowPlaying("音源を再生できませんでした");
            throw retryError;
        }
    }
}

audioPlayer.addEventListener("playing", () => {
    // 曲名はplaySongData側でセット済みなので、ここでは上書きしない。
});

audioPlayer.addEventListener("error", () => {
    console.error("Audioエラー:", audioPlayer.error, currentAudioUrl);
    setNowPlaying("音源を読み込めませんでした");
});

async function playSongData(player) {
    if (!player || !player.audio) {
        console.error("再生データがありません", player);
        setNowPlaying("音源データがありません");
        return;
    }

    setNowPlaying("読み込み中：" + (player.name || ""));

    try {
        await resetAndPlay(player.audio);
        setNowPlaying("♪ 再生中：" + (player.name || ""));
    } catch (_) {
        // 表示はresetAndPlay内で更新済み
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
