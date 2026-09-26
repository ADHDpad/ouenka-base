// ========================================
// 選手データ
// players.csv から自動で読み込み
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


        const text =
            await response.text();


        const lines =
            text.trim().split(/\r?\n/);


        // 1行目は見出しなので飛ばす
        for (
            let i = 1;
            i < lines.length;
            i++
        ) {

            const columns =
                parseCSVLine(lines[i]);


            if (columns.length < 13) {
                continue;
            }


            const id =
                columns[0].trim();


            if (!id) {
                continue;
            }


            players[id] = {

                name:
                    columns[1].trim(),

                reading:
                    columns[2].trim(),

                team:
                    columns[3].trim(),

                active:
                    Number(columns[4]),

                audio:
                    columns[5].trim(),

                melodyMidi:
                    columns[6].trim(),

                chordMidi:
                    columns[7].trim(),

                bassMidi:
                    columns[8].trim(),

                midiZip:
                    columns[9].trim(),

                garageBandZip:
                    columns[10].trim(),

                pickupBeats:
                    Number(columns[11]),

                lyrics:
                    columns[12]
                        .replace(/\\n/g, "\n")
                        .trim()

            };

        }


        console.log(
            "選手データ読み込み完了",
            players
        );


        // CSV読み込み完了を知らせる
        window.dispatchEvent(
            new Event("playersLoaded")
        );


    } catch (error) {

        console.error(error);

        document.getElementById(
            "nowPlaying"
        ).textContent =
            "選手データを読み込めませんでした";

    }

}



// ========================================
// CSVの1行を分解
// "" で囲まれた歌詞にも対応
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


        if (char === '"') {

            // "" は文字としての "
            if (
                insideQuotes &&
                line[i + 1] === '"'
            ) {

                current += '"';

                i++;

            } else {

                insideQuotes =
                    !insideQuotes;

            }

        }

        else if (
            char === "," &&
            !insideQuotes
        ) {

            result.push(current);

            current = "";

        }

        else {

            current += char;

        }

    }


    result.push(current);


    return result;

}



// ========================================
// ページ読み込み時にCSVを読み込む
// ========================================

loadPlayers();
