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
        "GarageBandファイル出力（iPhoneのみ）";


    garageButton.onclick =
        async function() {

            await downloadGarageBand(
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
// GarageBand ZIP出力
// iPhone：共有シートを開き「ファイルに保存」へ進みやすくする
// その他：通常ダウンロード
// ========================================

function isIPhoneLike() {
    return /iPhone|iPod/i.test(navigator.userAgent);
}

async function downloadGarageBand(player) {

    if (!player || !player.garageBand) {
        alert("GarageBandファイルが見つかりません");
        return;
    }

    const fileName =
        player.name +
        "_" +
        player.productionNumber +
        "_GarageBand.zip";

    // iPhoneではWeb Share APIでファイル共有を試す。
    // 共有シートから「ファイルに保存」を選べる。
    if (
        isIPhoneLike() &&
        navigator.share &&
        navigator.canShare
    ) {
        try {
            const response = await fetch(
                player.garageBand,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(
                    "GarageBandファイルを取得できませんでした：" +
                    response.status
                );
            }

            const blob = await response.blob();

            const file = new File(
                [blob],
                fileName,
                { type: "application/zip" }
            );

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file]
                });
                return;
            }
        } catch (error) {
            // ユーザーが共有画面を閉じただけならエラー表示しない
            if (error && error.name === "AbortError") {
                return;
            }

            console.warn(
                "iPhone共有シートを開けなかったため通常保存へ切替:",
                error
            );
        }
    }

    // Web Share APIが使えない場合のフォールバック。
    // 実ファイルURLをユーザー操作から直接ダウンロードする。
    const link = document.createElement("a");

    link.href = player.garageBand;
    link.download = fileName;
    link.rel = "noopener";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    playSongData(player);

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