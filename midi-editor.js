// ========================================
// 応援歌BASE MIDIエディター
// ========================================

let editorNotes = [];

let editorPixelsPerSecond = 100;
let editorNoteHeight = 24;

let editorMinNote = 48;
let editorMaxNote = 84;


// ========================================
// MIDI編集画面を開く
// ========================================

async function openMidiEditor() {

    try {

        // --------------------------------
        // MIDIを読み込む
        // --------------------------------

        const response = await fetch(
            "データ/堂林翔太/①MIDIメロディー.mid"
        );


        if (!response.ok) {

            throw new Error(
                "メロディーMIDIが見つかりません"
            );

        }


        const arrayBuffer =
            await response.arrayBuffer();


        // midi-player.js の
        // parseMidi()を使用
        editorNotes =
            parseMidi(arrayBuffer);


        console.log(
            "読み込んだ音符:",
            editorNotes
        );


        // --------------------------------
        // 編集画面を作る
        // --------------------------------

        createMidiEditor();


    } catch (error) {

        console.error(error);

        alert(
            "MIDI編集画面を開けませんでした。\n\n" +
            error.message
        );

    }

}



// ========================================
// 編集画面を作成
// ========================================

function createMidiEditor() {

    // 以前の画面があれば削除
    const oldEditor =
        document.getElementById(
            "midiEditorOverlay"
        );

    if (oldEditor) {

        oldEditor.remove();

    }


    // ====================================
    // 全体
    // ====================================

    const overlay =
        document.createElement("div");

    overlay.id =
        "midiEditorOverlay";


    overlay.style.position =
        "fixed";

    overlay.style.left =
        "0";

    overlay.style.top =
        "0";

    overlay.style.width =
        "100%";

    overlay.style.height =
        "100%";

    overlay.style.background =
        "#111";

    overlay.style.zIndex =
        "9999";

    overlay.style.display =
        "flex";

    overlay.style.flexDirection =
        "column";


    // ====================================
    // 上部メニュー
    // ====================================

    const header =
        document.createElement("div");


    header.style.padding =
        "12px";

    header.style.background =
        "#222";

    header.style.color =
        "white";

    header.style.display =
        "flex";

    header.style.alignItems =
        "center";

    header.style.gap =
        "10px";

    header.style.flexWrap =
        "wrap";


    // タイトル
    const title =
        document.createElement("strong");

    title.textContent =
        "堂林翔太　メロディー編集";


    header.appendChild(
        title
    );


    // ====================================
    // 再生ボタン
    // ====================================

    const playButton =
        document.createElement("button");

    playButton.textContent =
        "▶ 試聴";


    playButton.onclick =
        function() {

            previewEditorNotes();

        };


    header.appendChild(
        playButton
    );


    // ====================================
    // 停止ボタン
    // ====================================

    const stopButton =
        document.createElement("button");

    stopButton.textContent =
        "■ 停止";


    stopButton.onclick =
        function() {

            stopMidiSong();

        };


    header.appendChild(
        stopButton
    );


    // ====================================
    // 閉じるボタン
    // ====================================

    const closeButton =
        document.createElement("button");

    closeButton.textContent =
        "✕ 閉じる";


    closeButton.onclick =
        function() {

            stopMidiSong();

            overlay.remove();

        };


    header.appendChild(
        closeButton
    );


    overlay.appendChild(
        header
    );


    // ====================================
    // スクロール領域
    // ====================================

    const scrollArea =
        document.createElement("div");


    scrollArea.style.flex =
        "1";

    scrollArea.style.overflow =
        "auto";

    scrollArea.style.position =
        "relative";


    // ====================================
    // ピアノロール
    // ====================================

    const roll =
        document.createElement("div");

    roll.id =
        "midiPianoRoll";

    roll.style.position =
        "relative";


    // 曲の最後を取得
    let songLength = 12;


    editorNotes.forEach(
        function(note) {

            songLength =
                Math.max(
                    songLength,
                    note.time +
                    note.duration
                );

        }
    );


    roll.style.width =
        (
            songLength *
            editorPixelsPerSecond +
            200
        ) +
        "px";


    roll.style.height =
        (
            (
                editorMaxNote -
                editorMinNote +
                1
            ) *
            editorNoteHeight
        ) +
        "px";


    roll.style.background =
        "#181818";


    // ====================================
    // 横線
    // ====================================

    for (
        let midi = editorMinNote;
        midi <= editorMaxNote;
        midi++
    ) {

        const line =
            document.createElement("div");


        line.style.position =
            "absolute";

        line.style.left =
            "0";

        line.style.width =
            "100%";

        line.style.height =
            "1px";

        line.style.background =
            "#333";


        line.style.top =
            (
                (
                    editorMaxNote -
                    midi
                ) *
                editorNoteHeight
            ) +
            "px";


        roll.appendChild(
            line
        );

    }


    // ====================================
    // 縦線
    // 1秒ごと
    // ====================================

    for (
        let second = 0;
        second <= songLength + 2;
        second++
    ) {

        const line =
            document.createElement("div");


        line.style.position =
            "absolute";

        line.style.top =
            "0";

        line.style.height =
            "100%";

        line.style.width =
            "1px";

        line.style.background =
            "#444";


        line.style.left =
            (
                second *
                editorPixelsPerSecond
            ) +
            "px";


        roll.appendChild(
            line
        );

    }


    // ====================================
    // MIDI音符を表示
    // ====================================

    editorNotes.forEach(
        function(note, index) {

            createEditorNote(
                roll,
                note,
                index
            );

        }
    );


    scrollArea.appendChild(
        roll
    );


    overlay.appendChild(
        scrollArea
    );


    document.body.appendChild(
        overlay
    );

}



// ========================================
// 1個の音符をバーとして表示
// ========================================

function createEditorNote(
    roll,
    note,
    index
) {

    const noteBar =
        document.createElement("div");


    noteBar.className =
        "midi-editor-note";


    noteBar.dataset.index =
        index;


    noteBar.style.position =
        "absolute";


    noteBar.style.left =
        (
            note.time *
            editorPixelsPerSecond
        ) +
        "px";


    noteBar.style.top =
        (
            (
                editorMaxNote -
                note.midi
            ) *
            editorNoteHeight
        ) +
        "px";


    noteBar.style.width =
        Math.max(
            8,
            note.duration *
            editorPixelsPerSecond
        ) +
        "px";


    noteBar.style.height =
        (
            editorNoteHeight -
            3
        ) +
        "px";


    noteBar.style.background =
        "#28c76f";


    noteBar.style.borderRadius =
        "4px";


    noteBar.style.cursor =
        "grab";


    noteBar.style.boxSizing =
        "border-box";


    noteBar.style.border =
        "1px solid #8affb7";


    noteBar.title =
        "MIDI " +
        note.midi;


    // ドラッグ操作
    enableNoteDragging(
        noteBar,
        note
    );


    roll.appendChild(
        noteBar
    );

}



// ========================================
// 音符をドラッグして編集
// ========================================

function enableNoteDragging(
    element,
    note
) {

    let dragging = false;

    let startX = 0;
    let startY = 0;

    let originalLeft = 0;
    let originalTop = 0;


    element.addEventListener(
        "pointerdown",
        function(event) {

            dragging = true;

            startX =
                event.clientX;

            startY =
                event.clientY;


            originalLeft =
                parseFloat(
                    element.style.left
                );


            originalTop =
                parseFloat(
                    element.style.top
                );


            element.setPointerCapture(
                event.pointerId
            );


            element.style.cursor =
                "grabbing";

        }
    );


    element.addEventListener(
        "pointermove",
        function(event) {

            if (!dragging) {
                return;
            }


            const dx =
                event.clientX -
                startX;


            const dy =
                event.clientY -
                startY;


            // ----------------------------
            // 横方向
            // ----------------------------

            let newLeft =
                originalLeft +
                dx;


            if (newLeft < 0) {
                newLeft = 0;
            }


            element.style.left =
                newLeft +
                "px";


            // ----------------------------
            // 縦方向
            // 1音単位に吸着
            // ----------------------------

            let newTop =
                originalTop +
                dy;


            newTop =
                Math.round(
                    newTop /
                    editorNoteHeight
                ) *
                editorNoteHeight;


            const maxTop =
                (
                    editorMaxNote -
                    editorMinNote
                ) *
                editorNoteHeight;


            newTop =
                Math.max(
                    0,
                    Math.min(
                        maxTop,
                        newTop
                    )
                );


            element.style.top =
                newTop +
                "px";

        }
    );


    element.addEventListener(
        "pointerup",
        function(event) {

            if (!dragging) {
                return;
            }


            dragging = false;


            element.style.cursor =
                "grab";


            // =================================
            // 新しい開始時間
            // =================================

            const left =
                parseFloat(
                    element.style.left
                );


            note.time =
                left /
                editorPixelsPerSecond;


            // =================================
            // 新しい音程
            // =================================

            const top =
                parseFloat(
                    element.style.top
                );


            note.midi =
                editorMaxNote -
                Math.round(
                    top /
                    editorNoteHeight
                );


            console.log(
                "編集後:",
                note
            );

        }
    );

}



// ========================================
// 編集中のメロディーを試聴
// ========================================

async function previewEditorNotes() {

    try {

        stopMidiSong();


        if (!midiAudioContext) {

            midiAudioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }


        await midiAudioContext.resume();


        const startTime =
            midiAudioContext.currentTime +
            0.1;


        await schedulePart(
            editorNotes,
            "melody",
            startTime
        );


    } catch (error) {

        console.error(error);


        alert(
            "試聴できませんでした。\n\n" +
            error.message
        );

    }

}