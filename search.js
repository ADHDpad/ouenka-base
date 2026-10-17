// ========================================
// OUENKA BASE
// search.js
// D1検索・高速再生・GarageBand対応版
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


    // ====================================
    // 検索中表示
    // ====================================

    const searchingResult =
        document.createElement(
            "div"
        );

    searchingResult.className =
        "search-message search-loading";

    searchingResult.textContent =
        "検索中…";

    suggestions.appendChild(
        searchingResult
    );

    suggestions.style.display =
        "block";


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


        // 「検索中…」を消してから結果を表示
        suggestions.innerHTML = "";


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
                    // 保存フォルダ
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
                        // m4a
                        // ========================

                        // 実ファイル名は登録時の元名に関係なく
                        // 保存ルールどおり audio.m4a に固定
                        audio:
                            basePath +
                            "audio.m4a",

                        // 個別再生用：再生用m4a＋コード進行・ベースm4a
                        accompaniment:
                            basePath +
                            "accompaniment.m4a",

                        // 前奏（登録されている場合だけ player.js 側で使用）
                        introMelody:
                            basePath +
                            "intro_melody.m4a",

                        introAccompaniment:
                            basePath +
                            "intro_accompaniment.m4a",

                        // ========================
                        // GarageBand
                        // ========================

                        garageBand:
                            basePath +
                            (
                                song.garageband_filename ||
                                "garageband.zip"
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

                    // 1-9と同じ「名前・球団・歌詞1行目」の3行表示
                    const candidateName = document.createElement("strong");
                    candidateName.className = "candidate-name";
                    candidateName.textContent = player.name;

                    const candidateTeam = document.createElement("small");
                    candidateTeam.className = "candidate-team";
                    candidateTeam.textContent = (player.team || "球団未設定") +
                        (player.productionNumber != null && player.productionNumber !== ""
                            ? " ／ 制作番号 " + player.productionNumber : "");

                    const candidateLyric = document.createElement("small");
                    candidateLyric.className = "candidate-lyric";
                    candidateLyric.textContent = (player.lyrics || "")
                        .split(/\r?\n/).map(line => line.trim()).find(Boolean) || "歌詞未登録";

                    candidate.append(candidateName, candidateTeam, candidateLyric);


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

        if (requestNumber !== searchRequestNumber) {
            return;
        }

        suggestions.innerHTML = "";

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
    // ② GarageBand出力
    // ====================================

    const garageButton =
        document.createElement(
            "button"
        );


    garageButton.textContent =
        "GarageBandで開く";


    garageButton.onclick =
        async function() {

            await downloadGarageBand(
                player
            );

        };


    menu.appendChild(
        garageButton
    );
    const garageSettingsButton = document.createElement("button");
    garageSettingsButton.textContent = "GarageBand連携設定";
    garageSettingsButton.style.fontSize = "12px";
    garageSettingsButton.onclick = () => window.OuenkaGarageBand?.settings(player);
    menu.appendChild(garageSettingsButton);



    resultArea.appendChild(
        menu
    );

}


// ========================================
// GarageBandで開く（ショートカット連携）
// ========================================
function downloadGarageBand(player) {
    if (!window.OuenkaGarageBand) {
        alert("GarageBand連携を読み込めませんでした。ページを更新してください。");
        return;
    }
    window.OuenkaGarageBand.open(player);
}

// ========================================
// 曲を再生
// ========================================

function selectPlayer(
    playerId,
    playerData = null
) {
    const player = playerData || d1Players[playerId];

    if (!player) {
        alert("選手データを取得できませんでした");
        return;
    }

    if (typeof playSongData !== "function") {
        alert("音楽プレイヤーを読み込めませんでした");
        return;
    }

    const gestureCtx=window.ouenkaAudioRecovery?.consumeGestureContext();
    playSongData(player,gestureCtx);

    const lyricsTitle = document.getElementById("lyricsTitle");
    if (lyricsTitle) lyricsTitle.textContent = player.name + " 応援歌";

    const lyrics = document.getElementById("lyrics");
    if (lyrics) lyrics.textContent = player.lyrics || "";
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
    "OUENKA BASE D1検索・高速再生・GarageBand準備完了"
);