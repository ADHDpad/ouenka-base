// ========================================
// 選手データ
// players.csv から読み込み
// AccessのCSV（Shift-JIS）対応
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


        // --------------------------------
        // AccessのCSVはShift-JISで読む
        // --------------------------------

        const buffer =
            await response.arrayBuffer();


        const decoder =
            new TextDecoder("shift-jis");


        const text =
            decoder.decode(buffer);


        const lines =
            text.trim().split(/\r?\n/);


        // --------------------------------
        // 1行目は見出し
        // --------------------------------

        for (
            let i = 1;
            i < lines.length;
            i++
        ) {

            const columns =
                parseCSVLine(lines[i]);


            // IDが空の行は無視
            if (
                !columns[0] ||
                columns[0].trim() === ""
            ) {

                continue;

            }


            const id =
                columns[0].trim();


            // --------------------------------
            // 選手データ
            // --------------------------------

            players[id] = {

                name:
                    columns[1]
                        ?.trim() || "",

                reading:
                    columns[2]
                        ?.trim() || "",

                team:
                    columns[3]
                        ?.trim() || "",

                active:
                    Number(
                        columns[4]
                    ) || 0,

                audio:
                    columns[5]
                        ?.trim() || "",

                melodyMidi:
                    columns[6]
                        ?.trim() || "",

                chordMidi:
                    columns[7]
                        ?.trim() || "",

                bassMidi:
                    columns[8]
                        ?.trim() || "",

                midiZip:
                    columns[9]
                        ?.trim() || "",

                garageBandZip:
                    columns[10]
                        ?.trim() || "",

                pickupBeats:
                    Number(
                        columns[11]
                    ) || 0,

                lyrics:
                    (columns[12] || "")
                        .replace(/\\n/g, "\n")
                        .trim()

            };

        }


        console.log(
            "選手データ読み込み完了",
            players
        );


        // --------------------------------
        // CSV読み込み完了
        // --------------------------------

        window.dispatchEvent(
            new Event("playersLoaded")
        );


    }
    catch (error) {

        console.error(error);


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


        // --------------------------------
        // ダブルクォーテーション
        // --------------------------------

        if (char === '"') {

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


        // --------------------------------
        // カンマ
        // --------------------------------

        else if (
            char === "," &&
            !insideQuotes
        ) {

            result.push(
                current
            );

            current = "";

        }


        // --------------------------------
        // 通常の文字
        // --------------------------------

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
// ページ読み込み時にCSVを読み込む
// ========================================

loadPlayers();