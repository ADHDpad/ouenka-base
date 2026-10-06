// ========================================
// 選手データ
// players.csv から読み込み
// Access CSVの文字コード自動対応
// ========================================

const players = {};


// ========================================
// CSV読み込み
// ========================================

async function loadPlayers() {

    try {

        const response =
            await fetch("players.csv");


        if (!response.ok) {

            throw new Error(
                "players.csvを読み込めませんでした"
            );

        }


        // CSVをバイナリとして取得
        const buffer =
            await response.arrayBuffer();


        // ====================================
        // 文字コードを自動判定
        // ====================================

        const bytes =
            new Uint8Array(buffer);

        let text;


        // UTF-16 LE
        if (
            bytes.length >= 2 &&
            bytes[0] === 0xFF &&
            bytes[1] === 0xFE
        ) {

            text =
                new TextDecoder(
                    "utf-16le"
                ).decode(buffer);

        }


        // UTF-16 BE
        else if (
            bytes.length >= 2 &&
            bytes[0] === 0xFE &&
            bytes[1] === 0xFF
        ) {

            text =
                new TextDecoder(
                    "utf-16be"
                ).decode(buffer);

        }


        // UTF-8 BOM
        else if (
            bytes.length >= 3 &&
            bytes[0] === 0xEF &&
            bytes[1] === 0xBB &&
            bytes[2] === 0xBF
        ) {

            text =
                new TextDecoder(
                    "utf-8"
                ).decode(buffer);

        }


        // その他
        else {

            // まずUTF-8として試す
            const utf8Text =
                new TextDecoder(
                    "utf-8"
                ).decode(buffer);


            // 日本語の文字化けが疑われる場合
            if (
                utf8Text.includes(" ")
            ) {

                text =
                    new TextDecoder(
                        "shift-jis"
                    ).decode(buffer);

            }
            else {

                text =
                    utf8Text;

            }

        }


        // ====================================
        // 改行で分割
        // ====================================

        const lines =
            text
                .replace(/^\uFEFF/, "")
                .trim()
                .split(/\r?\n/);


        // ====================================
        // 1行目は見出し
        // ====================================

        for (
            let i = 1;
            i < lines.length;
            i++
        ) {

            const columns =
                parseCSVLine(
                    lines[i]
                );


            // IDがない行は無視
            if (
                !columns[0] ||
                columns[0].trim() === ""
            ) {

                continue;

            }


            const id =
                columns[0].trim();


            // =================================
            // 選手データ
            // =================================

            players[id] = {

                name:
                    cleanCSVValue(
                        columns[1]
                    ),

                reading:
                    cleanCSVValue(
                        columns[2]
                    ),

                team:
                    cleanCSVValue(
                        columns[3]
                    ),

                active:
                    Number(
                        cleanCSVValue(
                            columns[4]
                        )
                    ) || 0,

                audio:
                    cleanCSVValue(
                        columns[5]
                    ),

                melodyMidi:
                    cleanCSVValue(
                        columns[6]
                    ),

                chordMidi:
                    cleanCSVValue(
                        columns[7]
                    ),

                bassMidi:
                    cleanCSVValue(
                        columns[8]
                    ),

                midiZip:
                    cleanCSVValue(
                        columns[9]
                    ),

                garageBandZip:
                    cleanCSVValue(
                        columns[10]
                    ),

                pickupBeats:
                    Number(
                        cleanCSVValue(
                            columns[11]
                        )
                    ) || 0,

                lyrics:
                    cleanCSVValue(
                        columns[12]
                    )
                    .replace(/\\n/g, "\n")

            };

        }


        // ====================================
        // 読み込み確認
        // ====================================

        console.log(
            "選手データ読み込み完了",
            players
        );


        // ====================================
        // CSV読み込み完了を通知
        // ====================================

        window.dispatchEvent(
            new Event(
                "playersLoaded"
            )
        );


    }
    catch (error) {

        console.error(
            "CSV読み込みエラー:",
            error
        );


        const nowPlaying =
            document.getElementById(
                "nowPlaying"
            );


        if (nowPlaying) {

            nowPlaying.textContent =
                "選手データを読み込めませんでした";

        }

    }

}



// ========================================
// CSVの値をきれいにする
// ========================================

function cleanCSVValue(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }


    return String(value)
        .replace(/^\uFEFF/, "")
        .trim();

}



// ========================================
// CSV 1行を分解
// ========================================

function parseCSVLine(line) {

    const result = [];

    let current = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < line.length;
        i++
    ) {

        const char =
            line[i];


        // ダブルクォーテーション
        if (
            char === '"'
        ) {

            // "" → " として扱う
            if (
                insideQuotes &&
                line[i + 1] === '"'
            ) {

                current += '"';

                i++;

            }
            else {

                insideQuotes =
                    !insideQuotes;

            }

        }


        // カンマ
        else if (
            char === "," &&
            !insideQuotes
        ) {

            result.push(
                current
            );

            current = "";

        }


        // 通常の文字
        else {

            current += char;

        }

    }


    result.push(
        current
    );


    return result;

}



// ========================================
// CSV読み込み開始
// ========================================

loadPlayers();