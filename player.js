// ========================================
// OUENKA BASE 音楽プレイヤー
// 通常再生 → 失敗時だけ iPhone 音声復帰処理
// ========================================

let audioPlayer = null;
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
    if (!audioPlayer) return;
    destroyAudio(audioPlayer);
    audioPlayer = null;
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

async function tryNormalPlayback(player, attemptId) {
    // 通常状態では余計なリセットを挟まず、そのまま再生する。
    const oldAudio = audioPlayer;
    const nextAudio = createAudio(player.audio);
    audioPlayer = nextAudio;

    let started = false;

    nextAudio.addEventListener("playing", () => {
        if (attemptId !== playAttemptId || audioPlayer !== nextAudio) return;
        started = true;
        // 新しい音が実際に鳴ってから、前のAudioを破棄する。
        if (oldAudio && oldAudio !== nextAudio) destroyAudio(oldAudio);
        setNowPlaying("♪ 再生中：" + (player.name || ""));
    }, { once: true });

    nextAudio.addEventListener("ended", () => {
        if (audioPlayer === nextAudio) {
            setNowPlaying("");
        }
    }, { once: true });

    try {
        const promise = nextAudio.play();
        if (promise) await promise;
    } catch (error) {
        console.warn("通常再生に失敗。復帰処理へ:", error);
        if (audioPlayer === nextAudio) destroyAudio(nextAudio);
        return false;
    }

    // iPhoneでは play() が成功扱いでも playing が来ず無音になる場合があるため確認。
    await new Promise(resolve => setTimeout(resolve, 900));

    if (attemptId !== playAttemptId) return true;
    if (started || (!nextAudio.paused && nextAudio.currentTime > 0)) return true;

    console.warn("通常再生が開始されませんでした。復帰処理へ");
    if (audioPlayer === nextAudio) destroyAudio(nextAudio);
    return false;
}

async function recoverAndPlayback(player, attemptId) {
    // X / TikTok / YouTube / Apple Music 等から戻った後だけ使う復旧ルート。
    if (audioPlayer) {
        destroyAudio(audioPlayer);
        audioPlayer = null;
    }

    // iOS側に古い音声状態を解放する時間を少し与える。
    await new Promise(resolve => setTimeout(resolve, 120));

    if (attemptId !== playAttemptId) return false;

    const recoveryAudio = createAudio(player.audio);
    // 同じURLでもキャッシュされた壊れたMedia状態を避けるため再load。
    recoveryAudio.load();
    audioPlayer = recoveryAudio;

    recoveryAudio.addEventListener("playing", () => {
        if (attemptId !== playAttemptId || audioPlayer !== recoveryAudio) return;
        setNowPlaying("♪ 再生中：" + (player.name || ""));
    });

    recoveryAudio.addEventListener("ended", () => {
        if (audioPlayer === recoveryAudio) setNowPlaying("");
    }, { once: true });

    recoveryAudio.addEventListener("error", () => {
        if (attemptId !== playAttemptId || audioPlayer !== recoveryAudio) return;
        console.error("復旧後Audioエラー:", recoveryAudio.error, player.audio);
        setNowPlaying("音源を読み込めませんでした");
    }, { once: true });

    try {
        const promise = recoveryAudio.play();
        if (promise) await promise;
        return true;
    } catch (error) {
        console.error("復旧後も再生できません:", error, player.audio);
        if (attemptId === playAttemptId) {
            setNowPlaying("音源を再生できませんでした");
        }
        return false;
    }
}

async function playSongData(player) {
    if (!player || !player.audio) {
        console.error("再生データがありません", player);
        setNowPlaying("音源データがありません");
        return;
    }

    const attemptId = ++playAttemptId;

    // ① 何も競合していない通常状態を最優先
    const normalOK = await tryNormalPlayback(player, attemptId);
    if (attemptId !== playAttemptId || normalOK) return;

    // ② 通常再生できなかった時だけ、iPhone向け復帰処理を実行
    setNowPlaying("音声を復旧しています…");
    await recoverAndPlayback(player, attemptId);
}

// 旧players.js用も残す
function playSong(playerId) {
    if (typeof players !== "object" || !players || !players[playerId]) {
        console.error("選手データが見つかりません:", playerId);
        return;
    }
    playSongData(players[playerId]);
}
