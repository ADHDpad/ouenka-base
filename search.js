// ========================================
// 選手検索
// ========================================


// 検索候補の最大表示件数
const MAX_SUGGESTIONS = 10;


// 現在選択している選手
let selectedPlayerId = null;


// 選択した時点の検索文字
let selectedSearchText = "";



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


    const currentText =
        searchInput.value;


    const suggestions =
        document.getElementById(
            "searchSuggestions"
        );


    const clearButton =
        document.getElementById(
            "clearSearchButton"
        );


    // ×ボタンの表示

    if (
        searchInput.value.length > 0
    ) {

        clearButton.style.display =
            "flex";

    }
    else {

        clearButton.style.display =
            "none";

    }


    // 選手選択後に検索文字を変更した場合

    if (
        selectedPlayerId !== null &&
        currentText !== selectedSearchText
    ) {

        clearSelectedPlayer();

    }


    suggestions.innerHTML =
        "";


    if (
        keyword === ""
    ) {

        suggestions.style.display =
            "none";

        return;

    }


    // ====================================
    // 一致する選手を検索
    // ====================================

    const matchedPlayers =
        [];


    Object.keys(
        players
    ).forEach(

        function(playerId) {

            const player =
                players[playerId];


            const name =
                (
                    player.name ||
                    ""
                ).toLowerCase();


            const reading =
                (
                    player.reading ||
                    ""
                ).toLowerCase();


            const team =
                (
                    player.team ||
                    ""
                ).toLowerCase();


            if (

                name.includes(
                    keyword
                ) ||

                reading.includes(
                    keyword
                ) ||

                team.includes(
                    keyword
                )

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


        noResult.className =
            "no-search-result";


        noResult.textContent =
            "該当する選手はいません";


        suggestions.appendChild(
            noResult
        );


        suggestions.style.display =
            "block";


        return;

    }


    // ====================================
    // 最大10件
    // ====================================

    const displayPlayers =
        matchedPlayers.slice(
            0,
            MAX_SUGGESTIONS
        );


    // ====================================
    // 検索候補を作成
    // ====================================

    displayPlayers.forEach(

        function(item) {

            const candidate =
                document.createElement(
                    "div"
                );


            candidate.className =
                "search-candidate";


            candidate.textContent =
                item.player.name;


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

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    searchInput.value =
        player.name;


    selectedPlayerId =
        playerId;


    selectedSearchText =
        player.name;


    document.getElementById(
        "clearSearchButton"
    ).style.display =
        "flex";


    const suggestions =
        document.getElementById(
            "searchSuggestions"
        );


    suggestions.innerHTML =
        "";


    suggestions.style.display =
        "none";


    showPlayerActions(
        playerId,
        player
    );

}



// ========================================
// 3種類のボタンを表示
// ========================================

function showPlayerActions(
    playerId,
    player
) {

    const resultArea =
        document.getElementById(
            "playerButtons"
        );


    resultArea.innerHTML =
        "";


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


            shareFile(
                player.midiZip
            );

        };


    menu.appendChild(
        midiButton
    );



    // ====================================
    // ③ GarageBand
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


            shareFile(
                player.garageBandZip
            );

        };


    menu.appendChild(
        garageButton
    );


    resultArea.appendChild(
        menu
    );

}



// ========================================
// 選択した選手の表示を消す
// ========================================

function clearSelectedPlayer() {

    selectedPlayerId =
        null;


    selectedSearchText =
        "";


    document.getElementById(
        "playerButtons"
    ).innerHTML =
        "";


    document.getElementById(
        "nowPlaying"
    ).textContent =
        "選手を検索してください";


    document.getElementById(
        "lyricsTitle"
    ).textContent =
        "";


    document.getElementById(
        "lyrics"
    ).textContent =
        "";

}



// ========================================
// ×ボタン
// ========================================

function clearSearch() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    searchInput.value =
        "";


    const suggestions =
        document.getElementById(
            "searchSuggestions"
        );


    suggestions.innerHTML =
        "";


    suggestions.style.display =
        "none";


    document.getElementById(
        "clearSearchButton"
    ).style.display =
        "none";


    clearSelectedPlayer();


    searchInput.focus();

}



// ========================================
// ファイルを共有
//
// iPhoneではダウンロード画面ではなく
// 共有画面を使用する
// ========================================

async function shareFile(
    filePath
) {

    try {

        // ====================================
        // ファイルを取得
        // ====================================

        const response =
            await fetch(
                filePath
            );


        if (
            !response.ok
        ) {

            throw new Error(
                "ファイルを取得できませんでした"
            );

        }



        // ====================================
        // Blobに変換
        // ====================================

        const blob =
            await response.blob();



        // ====================================
        // ファイル名を取得
        // ====================================

        const fileName =
            decodeURIComponent(
                filePath
                    .split("/")
                    .pop()
            );



        // ====================================
        // Fileオブジェクトを作成
        // ====================================

        const file =
            new File(

                [blob],

                fileName,

                {
                    type:
                        blob.type ||
                        "application/zip"
                }

            );



        // ====================================
        // この端末がファイル共有に対応しているか
        // ====================================

        if (

            navigator.share &&

            navigator.canShare &&

            navigator.canShare({

                files: [file]

            })

        ) {

            // =================================
            // iPhoneの共有画面を表示
            // =================================

            await navigator.share({

                files: [file]

            });


            return;

        }



        // ====================================
        // ファイル共有に対応していない場合
        // 従来のダウンロードに切り替える
        // ====================================

        fallbackDownload(
            blob,
            fileName
        );

    }

    catch (
        error
    ) {

        // ユーザーが共有画面で
        // 「キャンセル」を押した場合は
        // エラー表示しない

        if (
            error.name ===
            "AbortError"
        ) {

            return;

        }


        console.error(
            "ファイル共有エラー:",
            error
        );


        alert(
            "ファイルを開けませんでした"
        );

    }

}



// ========================================
// 共有非対応端末用
// 通常ダウンロード
// ========================================

function fallbackDownload(
    blob,
    fileName
) {

    const blobUrl =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        blobUrl;


    link.download =
        fileName;


    link.style.display =
        "none";


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    setTimeout(

        function() {

            URL.revokeObjectURL(
                blobUrl
            );

        },

        3000

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


    if (
        !player
    ) {

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