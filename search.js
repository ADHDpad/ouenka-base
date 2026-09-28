alert("新しいsearch.jsが読み込まれました");

// ========================================
// 選手検索
// ========================================

function searchPlayers() {
function searchPlayers() {
function searchPlayers() {

    const keyword = document
        .getElementById("searchInput")
        .value
        .trim()
        .toLowerCase();

    const resultArea =
        document.getElementById("playerButtons");

    resultArea.innerHTML = "";


    // 検索欄が空なら何も表示しない
    if (keyword === "") {
        return;
    }


    // CSVから読み込んだ選手を検索
    Object.keys(players).forEach(function(playerId) {

        const player =
            players[playerId];

        const name =
            player.name.toLowerCase();

        const reading =
            player.reading.toLowerCase();

        const team =
            player.team.toLowerCase();


        // 選手名・読み・球団で検索
        if (
            name.includes(keyword) ||
            reading.includes(keyword) ||
            team.includes(keyword)
        ) {

            createPlayerButton(
                playerId,
                player
            );

        }

    });

}



// ========================================
// 検索結果に選手ボタンを作る
// ========================================

function createPlayerButton(playerId, player) {

    const resultArea =
        document.getElementById("playerButtons");

    const playerBox =
        document.createElement("div");

    playerBox.className =
        "search-player";


    const playerButton =
        document.createElement("button");

    playerButton.textContent =
        player.name;


    playerButton.onclick =
        function() {

            showPlayerMenu(
                playerId,
                player,
                playerBox
            );

        };


    playerBox.appendChild(
        playerButton
    );


    resultArea.appendChild(
        playerBox
    );

}



// ========================================
// 選手名を押した後のメニュー
// ========================================

function showPlayerMenu(
    playerId,
    player,
    playerBox
) {

    const oldMenu =
        playerBox.querySelector(".player-menu");

    if (oldMenu) {
        return;
    }


    const menu =
        document.createElement("div");

    menu.className =
        "player-menu";



    // ====================================
    // ① 曲を再生
    // ====================================

    const playButton =
        document.createElement("button");

    playButton.textContent =
        "▶ 曲を再生";


    playButton.onclick =
        function() {

            selectPlayer(
                playerId
            );

        };


    menu.appendChild(
        playButton
    );



    // ====================================
    // ② MIDI試聴
    // 現在は堂林翔太のみ
    // ====================================

    if (player.name === "堂林翔太") {

        const midiPlayButton =
            document.createElement("button");

        midiPlayButton.textContent =
            "🎹 MIDI試聴";


        midiPlayButton.onclick =
            function() {

                playDobayashiMidi();

            };


        menu.appendChild(
            midiPlayButton
        );

    }



    // ====================================
    // ③ MIDIを出力
    // ====================================

    const midiButton =
        document.createElement("button");

    midiButton.textContent =
        "MIDIを出力";


    midiButton.onclick =
        function() {

            if (!player.midiZip) {

                alert(
                    "MIDIファイルが登録されていません"
                );

                return;
            }


            downloadFile(
                player.midiZip
            );

        };


    menu.appendChild(
        midiButton
    );



    // ====================================
    // ④ GarageBandを出力
    // ====================================

    const garageButton =
        document.createElement("button");

    garageButton.textContent =
        "GarageBandファイル出力（iPhoneのみ）";


    garageButton.onclick =
        function() {

            if (!player.garageBandZip) {

                alert(
                    "GarageBandファイルが登録されていません"
                );

                return;
            }


            downloadFile(
                player.garageBandZip
            );

        };


    menu.appendChild(
        garageButton
    );


    playerBox.appendChild(
        menu
    );

}



// ========================================
// ファイルをダウンロード
// ========================================

function downloadFile(filePath) {

    const link =
        document.createElement("a");

    link.href =
        filePath;

    link.download = "";

    document.body.appendChild(
        link
    );

    link.click();

    document.body.removeChild(
        link
    );

}



// ========================================
// 曲を再生＋歌詞表示
// ========================================

function selectPlayer(playerId) {

    const player =
        players[playerId];


    if (!player) {
        return;
    }


    playSong(
        playerId
    );


    document.getElementById(
        "lyricsTitle"
    ).textContent =
        player.name + " 応援歌";


    document.getElementById(
        "lyrics"
    ).textContent =
        player.lyrics;

}



// ========================================
// CSV読み込み完了時
// ========================================

window.addEventListener(
    "playersLoaded",
    function() {

        document.getElementById(
            "playerButtons"
        ).innerHTML = "";

        console.log(
            "検索機能準備完了"
        );

    }
);