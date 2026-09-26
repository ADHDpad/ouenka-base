// ========================================
// 選手検索
// ========================================

function searchPlayers() {

    const keyword = document
        .getElementById("searchInput")
        .value
        .trim()
        .toLowerCase();

    const resultArea =
        document.getElementById("playerButtons");


    // 前の検索結果を消す
    resultArea.innerHTML = "";


    // 検索欄が空なら何も表示しない
    if (keyword === "") {
        return;
    }


    // players.js の選手を検索
    Object.keys(players).forEach(function(playerId) {

        const player =
            players[playerId];

        const name =
            player.name.toLowerCase();

        const reading =
            player.reading.toLowerCase();


        // 名前・読み仮名で部分一致
        if (
            name.includes(keyword) ||
            reading.includes(keyword)
        ) {

            createPlayerButton(
                playerId,
                player
            );

        }

    });

}



// ========================================
// 検索結果に「選手名ボタン」を作る
// ========================================

function createPlayerButton(playerId, player) {

    const resultArea =
        document.getElementById("playerButtons");


    // 選手全体を入れる箱
    const playerBox =
        document.createElement("div");

    playerBox.className =
        "search-player";


    // 選手名ボタン
    const playerButton =
        document.createElement("button");

    playerButton.textContent =
        player.name;


    // 選手名を押したとき
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
// 選手名を押した後の3ボタン
// ========================================

function showPlayerMenu(
    playerId,
    player,
    playerBox
) {

    // すでにメニューが出ていたら
    // 二重に作らない
    const oldMenu =
        playerBox.querySelector(".player-menu");

    if (oldMenu) {
        return;
    }


    // 3ボタンを入れる箱
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
    // ② MIDIを出力
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
    // ③ GarageBand ZIPを出力
    // ====================================

    const garageButton =
        document.createElement("button");

    garageButton.textContent =
        ""GarageBandファイル出力（iPhoneのみ）"";


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
// ファイルを出力
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


    // 応援歌を再生
    playSong(
        playerId
    );


    // 歌詞タイトル
    document.getElementById(
        "lyricsTitle"
    ).textContent =
        player.name + " 応援歌";


    // 歌詞表示
    document.getElementById(
        "lyrics"
    ).textContent =
        player.lyrics;

}



// ========================================
// ページを開いた直後
// ========================================

window.addEventListener(
    "DOMContentLoaded",
    function() {

        document.getElementById(
            "playerButtons"
        ).innerHTML = "";

    }
);