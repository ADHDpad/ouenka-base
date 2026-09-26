const audioPlayer = new Audio();


function playSong(playerId) {

    const player = players[playerId];


    if (!player) {
        return;
    }


    audioPlayer.pause();

    audioPlayer.src =
        player.audio;

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