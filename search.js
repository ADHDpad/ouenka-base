// ========================================
// OUENKA BASE
// search.js
// D1検索対応版
// ========================================

const MAX_SUGGESTIONS = 10;

const DATA_API =
    "https://ouenka-base-data.ninzin5600.workers.dev";

let selectedPlayerId = null;
let selectedSearchText = "";

const d1Players = {};

let searchRequestNumber = 0;


// ========================================
// 選手検索
// ========================================

async function searchPlayers() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    const suggestions =
        document.getElementById(
            "searchSuggestions"
        );

    const clearButton =
        document.getElementById(
            "clearSearchButton"
        );


    const keyword =
        searchInput.value.trim();

    const currentText =
        searchInput.value;


    // ====================================
    // ×ボタン
    // ====================================

    if (keyword.length > 0) {

        clearButton.style.display =
            "flex";

    }
    else {

        clearButton.style.display =
            "none";

    }


    // ====================================
    // 選択後に文字を変更した場合
    // ====================================

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


    const requestNumber =
        ++searchRequestNumber;


    try {

        // ====================================
        // D1検索
        // ====================================

        const response =
            await fetch(

                DATA_API +
                "/songs/search?q=" +
                encodeURIComponent(
                    keyword
                ),

                {
                    cache: "no-store"
                }

            );


        if (!response.ok) {

            throw new Error(
                "検索データを取得できませんでした"
            );

        }


        const data =
            await response.json();


        // 古い検索結果は無視

        if (
            requestNumber !==
            searchRequestNumber
        ) {

            return;

        }


        const songs =
            Array.isArray(data.songs)
                ? data.songs
                : [];


        // ====================================
        // 候補なし
        // ====================================

        if (songs.length === 0) {

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
        // 最大10件表示
        // ====================================

        songs
            .slice(
                0,
                MAX_SUGGESTIONS
            )
            .forEach(

                function(song) {

                    const playerId =
                        "d1_" + song.id;


                    // ============================
                    // GitHub Pages上の保存場所
                    //
                    // データ/
                    // └ 選手名/
                    //    └ 制作番号/
                    // ============================

                    const basePath =
                        "データ/" +
                        encodeURIComponent(
                            song.player_name
                        ) +
                        "/" +
                        song.production_number +
                        "/";


                    const player = {

                        id:
                            song.id,

                        name:
                            song.player_name || "",

                        reading:
                            song.reading || "",

                        team:
                            song.team || "",

                        playerType:
                            song.player_type || "",

                        uniformNumber:
                            song.uniform_number,

                        productionNumber:
                            song.production_number,

                        lyrics:
                            song.lyrics || "",


                        // ========================
                        // 音声
                        // ========================

                        audio:
                            basePath +
                            (
                                song.audio_filename ||
                                "audio.m4a"
                            ),


                        // ========================
                        // MIDI
                        // ========================

                        melody:
                            basePath +
                            (
                                song.melody_filename ||
                                "melody.mid"
                            ),

                        chord:
                            basePath +
                            (
                                song.chord_filename ||
                                "chord.mid"
                            ),

                        bass:
                            basePath +
                            (
                                song.bass_filename ||
                                "bass.mid"
                            )

                    };


                    d1Players[playerId] =
                        player;


                    // ============================
                    // 検索候補
                    // ============================

                    const candidate =
                        document.createElement(
                            "div"
                        );


                    candidate.className =
                        "search-candidate";


                    candidate.textContent =
                        player.name;


                    candidate.onclick =
                        function() {

                            selectSearchCandidate(
                                playerId,
                                player
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

    catch (error) {

        console.error(
            "D1検索エラー:",
            error
        );


        if (
            requestNumber !==
            searchRequestNumber
        ) {

            return;

        }


        const errorResult =
            document.createElement(
                "div"
            );


        errorResult.className =
            "no-search-result";


        errorResult.textContent =
            "検索データを取得できません";


        suggestions.appendChild(
            errorResult
        );


        suggestions.style.display =
            "block";

    }

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


    suggestions.innerHTML = "";


    suggestions.style.display =
        "none";


    showPlayerActions(
        playerId,
        player
    );

}


// ========================================
// 選手操作ボタン
// ========================================

function showPlayerActions(
    playerId,
    player
) {

    const resultArea =
        document.getElementById(
            "playerButtons"
        );


    resultArea.innerHTML = "";


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
                playerId,
                player
            );

        };


    menu.appendChild(
        playButton
    );


    // ====================================
    // ② MIDI
    // 今回は3ファイル保存方式なので
    // 次回ここを完成させる
    // ====================================

    const midiButton =
        document.createElement(
            "button"
        );


    midiButton.textContent =
        "MIDIを出力";


    midiButton.onclick =
        function() {

            alert(
                "MIDI出力は次回、3つのMIDIをまとめて出力できるようにします"
            );

        };


    menu.appendChild(
        midiButton
    );


    // ====================================
    // ③ GarageBand
    // 今回の新保存方式ではZIPを
    // サイトに保存していないため一旦停止
    // ====================================

    const garageButton =
        document.createElement(
            "button"
        );


    garageButton.textContent =
        "GarageBandファイル出力（iPhoneのみ）";


    garageButton.disabled =
        true;


    menu.appendChild(
        garageButton
    );


    resultArea.appendChild(
        menu
    );

}


// ========================================
// 曲を再生
// ========================================

function selectPlayer(
    playerId,
    playerData = null
) {

    const player =
        playerData ||
        d1Players[playerId];


    if (!player) {

        alert(
            "選手データを取得できませんでした"
        );

        return;

    }


    // ====================================
    // audio要素取得
    // ====================================

    let audio =
        document.getElementById(
            "audioPlayer"
        );


    // IDが違う場合にも対応

    if (!audio) {

        audio =
            document.querySelector(
                "audio"
            );

    }


    if (!audio) {

        alert(
            "再生プレイヤーが見つかりません"
        );

        return;

    }


    // ====================================
    // 音源セット
    // ====================================

    audio.src =
        player.audio;


    audio.load();


    // ====================================
    // 再生
    // ====================================

    const playResult =
        audio.play();


    if (
        playResult &&
        typeof playResult.catch ===
            "function"
    ) {

        playResult.catch(

            function(error) {

                console.error(
                    "音声再生エラー:",
                    error
                );


                alert(
                    "音声を再生できませんでした"
                );

            }

        );

    }


    // ====================================
    // 再生中表示
    // ====================================

    const nowPlaying =
        document.getElementById(
            "nowPlaying"
        );


    if (nowPlaying) {

        nowPlaying.textContent =
            player.name;

    }


    // ====================================
    // 歌詞
    // ====================================

    const lyricsTitle =
        document.getElementById(
            "lyricsTitle"
        );


    if (lyricsTitle) {

        lyricsTitle.textContent =
            player.name +
            " 応援歌";

    }


    const lyrics =
        document.getElementById(
            "lyrics"
        );


    if (lyrics) {

        lyrics.textContent =
            player.lyrics || "";

    }

}


// ========================================
// 選択解除
// ========================================

function clearSelectedPlayer() {

    selectedPlayerId =
        null;


    selectedSearchText =
        "";


    const playerButtons =
        document.getElementById(
            "playerButtons"
        );


    if (playerButtons) {

        playerButtons.innerHTML =
            "";

    }


    const nowPlaying =
        document.getElementById(
            "nowPlaying"
        );


    if (nowPlaying) {

        nowPlaying.textContent =
            "選手を検索してください";

    }


    const lyricsTitle =
        document.getElementById(
            "lyricsTitle"
        );


    if (lyricsTitle) {

        lyricsTitle.textContent =
            "";

    }


    const lyrics =
        document.getElementById(
            "lyrics"
        );


    if (lyrics) {

        lyrics.textContent =
            "";

    }

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
// 準備完了
// ========================================

console.log(
    "OUENKA BASE D1検索準備完了"
);