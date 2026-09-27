// ========================================
// 音楽プレイヤー
// ========================================

const audioPlayer = new Audio();


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


    // 今流れている曲を停止
    audioPlayer.pause();


    // 新しい曲をセット
    audioPlayer.src =
        player.audio;


    // 最初から再生
    audioPlayer.currentTime = 0;


    audioPlayer.play()

        .then(function() {

            document.getElementById(
                "nowPlaying"
            ).textContent =
                "♪ 再生中：" + player.name;

        })

        .catch(function(error) {

            console.error(error);

            document.getElementById(
                "nowPlaying"
            ).textContent =
                "音源を読み込めませんでした";

        });

}