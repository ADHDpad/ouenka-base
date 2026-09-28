// ========================================
// 音楽プレイヤー
// ========================================

// 現在再生しているAudioを保存
let audioPlayer = null;


// ========================================
// 応援歌を再生
// ========================================

function playSong(playerId) {

    const player =
        players[playerId];


    if (!player) {

        console.error(
            "選手データが見つかりません:",
            playerId
        );

        return;

    }


    // ====================================
    // 今までの曲を停止
    // ====================================

    if (audioPlayer) {

        audioPlayer.pause();

        audioPlayer.currentTime = 0;

        audioPlayer.src = "";

        audioPlayer.load();

    }


    // ====================================
    // ボタンを押したタイミングで
    // 新しいAudioを作成
    // ====================================

    audioPlayer =
        new Audio();


    audioPlayer.preload =
        "auto";


    audioPlayer.src =
        player.audio;


    // ====================================
    // 音量
    // ====================================

    audioPlayer.volume =
        1;


    audioPlayer.muted =
        false;


    // ====================================
    // 読み込み
    // ====================================

    audioPlayer.load();


    // ====================================
    // 再生
    // ====================================

    const playPromise =
        audioPlayer.play();


    if (playPromise !== undefined) {

        playPromise

            .then(function() {

                console.log(
                    "再生開始:",
                    player.audio
                );


                document.getElementById(
                    "nowPlaying"
                ).textContent =
                    "♪ 再生中：" +
                    player.name;

            })

            .catch(function(error) {

                console.error(
                    "再生エラー:",
                    error
                );


                document.getElementById(
                    "nowPlaying"
                ).textContent =
                    "音源を再生できませんでした";

            });

    }


    // ====================================
    // 実際に再生が始まったか確認
    // ====================================

    audioPlayer.addEventListener(

        "playing",

        function() {

            console.log(
                "Audio playing"
            );

        }

    );


    // ====================================
    // 音源エラー
    // ====================================

    audioPlayer.addEventListener(

        "error",

        function() {

            console.error(
                "Audioエラー:",
                audioPlayer.error
            );


            document.getElementById(
                "nowPlaying"
            ).textContent =
                "音源を読み込めませんでした";

        }

    );

}