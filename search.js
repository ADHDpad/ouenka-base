// ========================================
// 選手検索
// 検索候補方式
// ========================================


// ========================================
// 検索候補の最大表示件数
// ========================================

const MAX_SUGGESTIONS = 10;



// ========================================
// 選手を検索
// ========================================

function searchPlayers() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const keyword =
        searchInput
            .value
            .trim()
            .toLowerCase();


    const suggestions =
        document.getElementById(
            "searchSuggestions"
        );


    // 一度候補を消す
    suggestions.innerHTML = "";


    // ====================================
    // 空欄なら候補を閉じる
    // ====================================

    if (keyword === "") {

        suggestions.style.display =
            "none";

        return;

    }



    // ====================================
    // 一致した選手を取得
    // ====================================

    const matchedPlayers = [];


    Object.keys(players).forEach(
        function(playerId) {

            const player =
                players[playerId];


            const name =
                (
                    player.name || ""
                ).toLowerCase();


            const reading =
                (
                    player.reading || ""
                ).toLowerCase();


            const team =
                (
                    player.team || ""
                ).toLowerCase();


            if (

                name.includes(keyword) ||

                reading.includes(keyword) ||

                team.includes(keyword)

            ) {

                matchedPlayers.push({

                    playerId:
                        playerId,

                    player:
                        player

                });

            }

        }
    );



    // ====================================
    // 候補なし
    // ====================================

    if (
        matchedPlayers.length === 0
    ) {

        const noResult =
            document.createElement(
                "div"
            );


        noResult.textContent =
            "該当する選手はいません";


        noResult.style.padding =
            "16px";


        noResult.style.color =
            "#ffffff";


        noResult.style.textAlign =
            "center";


        suggestions.appendChild(
            noResult
        );


        suggestions.style.display =
            "block";


        return;

    }



    // ====================================
    // 最大10件までにする
    // ====================================

    const displayPlayers =
        matchedPlayers.slice(
            0,
            MAX_SUGGESTIONS
        );



    // ====================================
    // 検索候補を作る
    // ====================================

    displayPlayers.forEach(
        function(item) {

            const candidate =
                document.createElement(
                    "div"
                );


            // 選手名
            candidate.textContent =
                item.player.name;



            // =================================
            // 候補カードのデザイン
            // =================================

            candidate.style.padding =
                "16px 20px";


            candidate.style.margin =
                "10px";


            candidate.style.background =
                "#ffffff";


            candidate.style.border =
                "1px solid #d8dde6";


            candidate.style.borderRadius =
                "16px";


            candidate.style.boxShadow =
                "0 2px 6px rgba(0, 0, 0, 0.08)";


            candidate.style.fontSize =
                "18px";


            candidate.style.fontWeight =
                "bold";


            candidate.style.color =
                "#222";


            candidate.style.cursor =
                "pointer";


            candidate.style.boxSizing =
                "border-box";



            // =================================
            // マウスを乗せた時
            // =================================

            candidate.onmouseenter =
                function() {

                    candidate.style.background =
                        "#f3f7ff";


                    candidate.style.borderColor =
                        "#8db7ff";

                };


            candidate.onmouseleave =
                function() {

                    candidate.style.background =
                        "#ffffff";


                    candidate.style.borderColor =
                        "#d8dde6";

                };



            // =================================
            // 候補を選択
            // =================================

            candidate.onclick =
                function() {

                    selectSearchCandidate(
                        item.playerId,
                        item.player
                    );

                };


            suggestions.appendChild(
                candidate
            );

        }
    );


    suggestions.style.display =
        "block";

}



// ========================================
// 検索候補を選択
// ========================================

function selectSearchCandidate(
    playerId,
    player
) {

    // ====================================
    // テキストボックスを選手名にする
    // ====================================

    document.getElementById(
        "searchInput"
    ).value =
        player.name;



    // ====================================
    // 検索候補を閉じる
    // ====================================

    const suggestions =
        document.getElementById(
            "searchSuggestions"
        );


    suggestions.innerHTML =
        "";


    suggestions.style.display =
        "none";



    // ====================================
    // 以前の選手ボタンを消す
    // ====================================

    const resultArea =
        document.getElementById(
            "playerButtons"
        );


    resultArea.innerHTML =
        "";



    // ====================================
    // 選択した選手だけ表示
    // ====================================

    createPlayerButton(
        playerId,
        player
    );

}



// ========================================
// 選手ボタンを作る
// ========================================

function createPlayerButton(
    playerId,
    player
) {

    const resultArea =
        document.getElementById(
            "playerButtons"
        );


    const playerBox =
        document.createElement(
            "div"
        );


    playerBox.className =
        "search-player";


    const playerButton =
        document.createElement(
            "button"
        );


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
        playerBox.querySelector(
            ".player-menu"
        );


    if (oldMenu) {

        return;

    }


    const menu =
        document.createElement(
            "div"
        );


    menu.className =
        "player-menu";



    // ====================================
    // ① 曲を再生
    // ====================================

    const playButton =
        document.createElement(
            "button"
        );


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
        document.createElement(
            "button"
        );


    midiButton.textContent =
        "MIDIを出力";


    midiButton.onclick =
        function() {

            if (
                !player.midiZip
            ) {

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
    // ③ GarageBandを出力
    // ====================================

    const garageButton =
        document.createElement(
            "button"
        );


    garageButton.textContent =
        "GarageBandファイル出力（iPhoneのみ）";


    garageButton.onclick =
        function() {

            if (
                !player.garageBandZip
            ) {

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

function downloadFile(
    filePath
) {

    const link =
        document.createElement(
            "a"
        );


    link.href =
        filePath;


    link.download =
        "";


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

function selectPlayer(
    playerId
) {

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
        player.name +
        " 応援歌";


    document.getElementById(
        "lyrics"
    ).textContent =
        player.lyrics;

}



// ========================================
// CSV読み込み完了
// ========================================

window.addEventListener(
    "playersLoaded",
    function() {

        document.getElementById(
            "playerButtons"
        ).innerHTML =
            "";


        console.log(
            "検索候補機能準備完了"
        );

    }
);