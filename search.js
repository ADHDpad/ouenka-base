// ========================================
// 選手検索
// ========================================

const MAX_SUGGESTIONS = 10;

let selectedPlayerId = null;
let selectedSearchText = "";


// ========================================
// GarageBand先読み用
// ========================================

let preparedGarageBandFile = null;
let preparedGarageBandPath = "";
let garageBandPreparing = false;


// ========================================
// 選手を検索
// ========================================

function searchPlayers() {

    const searchInput =
        document.getElementById("searchInput");

    const keyword =
        searchInput.value
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


    // ×ボタン

    if (searchInput.value.length > 0) {

        clearButton.style.display =
            "flex";

    }
    else {

        clearButton.style.display =
            "none";

    }


    // 選手選択後に文字を変更した場合

    if (
        selectedPlayerId !== null &&
        currentText !== selectedSearchText
    ) {

        clearSelectedPlayer();

    }


    suggestions.innerHTML = "";


    if (keyword === "") {

        suggestions.style.display =
            "none";

        return;

    }


    // ====================================
    // 一致する選手
    // ====================================

    const matchedPlayers = [];


    Object.keys(players).forEach(

        function(playerId) {

            const player =
                players[playerId];

            const name =
                (player.name || "")
                    .toLowerCase();

            const reading =
                (player.reading || "")
                    .toLowerCase();

            const team =
                (player.team || "")
                    .toLowerCase();


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

    if (matchedPlayers.length === 0) {

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


    // 最大10件

    const displayPlayers =
        matchedPlayers.slice(
            0,
            MAX_SUGGESTIONS
        );


    // ====================================
    // 検索候補
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


    // 3ボタン表示

    showPlayerActions(
        playerId,
        player
    );


    // ====================================
    // GarageBand ZIPをここで先読み
    // ====================================

    prepareGarageBandFile(
        player
    );

}


// ========================================
// 3種類のボタン
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
    // ② MIDIをその場で再生
    // ====================================

    const midiPlayButton =
        document.createElement(
            "button"
        );

    midiPlayButton.textContent =
        "▶ MIDIを再生";

    midiPlayButton.onclick =
        function() {

            playPlayerMidi(
                playerId
            );

        };

    menu.appendChild(
        midiPlayButton
    );


    // ====================================
    // ③ MIDIファイル出力
    // ====================================

    const midiButton =
        document.createElement(
            "button"
        );


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


            shareFileNormally(
                player.midiZip
            );

        };


    menu.appendChild(
        midiButton
    );


    // ====================================
    // ④ GarageBand
    // ====================================

    const garageButton =
        document.createElement(
            "button"
        );


    garageButton.id =
        "garageBandButton";


    garageButton.textContent =
        "GarageBand準備中…";


    garageButton.disabled =
        true;


    garageButton.onclick =
        function() {

            sharePreparedGarageBand(
                player
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
// GarageBandファイルを先読み
// ========================================

async function prepareGarageBandFile(
    player
) {

    // 前の選手のデータを消す

    preparedGarageBandFile =
        null;

    preparedGarageBandPath =
        "";

    garageBandPreparing =
        false;


    const button =
        document.getElementById(
            "garageBandButton"
        );


    // ファイル未登録

    if (!player.garageBandZip) {

        if (button) {

            button.textContent =
                "GarageBandファイル未登録";

            button.disabled =
                true;

        }

        return;

    }


    garageBandPreparing =
        true;


    if (button) {

        button.textContent =
            "GarageBand準備中…";

        button.disabled =
            true;

    }


    try {

        // ====================================
        // ZIP取得
        // ====================================

        const response =
            await fetch(
                player.garageBandZip
            );


        if (!response.ok) {

            throw new Error(
                "GarageBandファイルを取得できませんでした"
            );

        }


        // ====================================
        // Blob化
        // ====================================

        const blob =
            await response.blob();


        // ====================================
        // ファイル名
        // ====================================

        const fileName =
            decodeURIComponent(

                player.garageBandZip
                    .split("/")
                    .pop()

            );


        // ====================================
        // Fileを作る
        // ====================================

        preparedGarageBandFile =
            new File(

                [blob],

                fileName,

                {
                    type:
                        blob.type ||
                        "application/zip"
                }

            );


        preparedGarageBandPath =
            player.garageBandZip;


        garageBandPreparing =
            false;


        // ====================================
        // 同じ選手をまだ表示中なら
        // ボタンを使用可能にする
        // ====================================

        if (

            selectedPlayerId !== null &&

            preparedGarageBandPath ===
                player.garageBandZip

        ) {

            const currentButton =
                document.getElementById(
                    "garageBandButton"
                );


            if (currentButton) {

                currentButton.textContent =
                    "GarageBandファイル出力（iPhoneのみ）";

                currentButton.disabled =
                    false;

            }

        }

    }

    catch (error) {

        console.error(
            "GarageBand準備エラー:",
            error
        );


        garageBandPreparing =
            false;


        const currentButton =
            document.getElementById(
                "garageBandButton"
            );


        if (currentButton) {

            currentButton.textContent =
                "GarageBand準備失敗";

            currentButton.disabled =
                false;

        }

    }

}


// ========================================
// 準備済みGarageBandファイルを共有
// ========================================

function sharePreparedGarageBand(
    player
) {

    // まだ準備中

    if (garageBandPreparing) {

        alert(
            "GarageBandファイルを準備中です"
        );

        return;

    }


    // 準備できていない

    if (

        !preparedGarageBandFile ||

        preparedGarageBandPath !==
            player.garageBandZip

    ) {

        alert(
            "GarageBandファイルの準備ができていません"
        );

        return;

    }


    try {

        const shareData = {

            files: [
                preparedGarageBandFile
            ]

        };


        // ====================================
        // 共有できるか確認
        // ====================================

        if (

            navigator.share &&

            navigator.canShare &&

            navigator.canShare(
                shareData
            )

        ) {

            /*
             * 重要
             *
             * ここではfetchしない。
             *
             * ボタンを押した直後に
             * navigator.share()を実行する。
             */

            const result =
                navigator.share(
                    shareData
                );


            if (

                result &&

                typeof result.catch ===
                    "function"

            ) {

                result.catch(

                    function(error) {

                        if (
                            error.name !==
                            "AbortError"
                        ) {

                            console.error(
                                "GarageBand共有エラー:",
                                error
                            );


                            alert(
                                "GarageBandファイルを共有できませんでした"
                            );

                        }

                    }

                );

            }


            return;

        }


        alert(
            "この端末ではGarageBandファイル共有に対応していません"
        );

    }

    catch (error) {

        console.error(
            "GarageBand共有エラー:",
            error
        );


        alert(
            "GarageBandファイルを共有できませんでした"
        );

    }

}


// ========================================
// MIDI共有
// ========================================

async function shareFileNormally(
    filePath
) {

    try {

        const response =
            await fetch(
                filePath
            );


        if (!response.ok) {

            throw new Error(
                "ファイルを取得できませんでした"
            );

        }


        const blob =
            await response.blob();


        const fileName =
            decodeURIComponent(

                filePath
                    .split("/")
                    .pop()

            );


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


        const shareData = {

            files: [file]

        };


        if (

            navigator.share &&

            navigator.canShare &&

            navigator.canShare(
                shareData
            )

        ) {

            await navigator.share(
                shareData
            );

            return;

        }


        fallbackDownload(
            blob,
            fileName
        );

    }

    catch (error) {

        if (
            error.name ===
            "AbortError"
        ) {

            return;

        }


        console.error(
            "MIDI共有エラー:",
            error
        );


        alert(
            "MIDIファイルを開けませんでした"
        );

    }

}


// ========================================
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
// 選択解除
// ========================================

function clearSelectedPlayer() {

    selectedPlayerId =
        null;


    selectedSearchText =
        "";


    // GarageBand先読みデータも解除

    preparedGarageBandFile =
        null;

    preparedGarageBandPath =
        "";

    garageBandPreparing =
        false;


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
// 曲を再生＋歌詞
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