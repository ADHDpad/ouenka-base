// ========================================
// 応援歌BASE MIDIエディター
// テンポ170 / 4拍子 / 16分音符スナップ
// ========================================


// ========================================
// 基本設定
// ========================================

const EDITOR_BPM = 170;
const EDITOR_BEATS_PER_BAR = 4;
const EDITOR_DIVISIONS = 4; // 1拍を4分割 = 16分音符

const EDITOR_BEAT_SECONDS =
    60 / EDITOR_BPM;

const EDITOR_GRID_SECONDS =
    EDITOR_BEAT_SECONDS /
    EDITOR_DIVISIONS;


// 表示サイズ
const EDITOR_BEAT_WIDTH = 120;
const EDITOR_GRID_WIDTH =
    EDITOR_BEAT_WIDTH /
    EDITOR_DIVISIONS;

const EDITOR_NOTE_HEIGHT = 26;


// 表示する音域
const EDITOR_MIN_NOTE = 48;
const EDITOR_MAX_NOTE = 84;


// 編集中の音符
let editorNotes = [];


// エディター試聴用
let editorPreviewSources = [];


// ========================================
// MIDI編集画面を開く
// ========================================

async function openMidiEditor() {

    try {

        const response =
            await fetch(
                "データ/堂林翔太/①MIDIメロディー.mid"
            );


        if (!response.ok) {

            throw new Error(
                "メロディーMIDIが見つかりません"
            );

        }


        const arrayBuffer =
            await response.arrayBuffer();


        // midi-player.js のMIDI解析を使用
        editorNotes =
            parseMidi(arrayBuffer);


        // 16分音符単位に揃える
        editorNotes.forEach(function(note) {

            note.time =
                snapTime(
                    note.time
                );

            note.duration =
                Math.max(
                    EDITOR_GRID_SECONDS,
                    snapTime(
                        note.duration
                    )
                );

        });


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
// 時間を16分音符に吸着
// ========================================

function snapTime(seconds) {

    return (
        Math.round(
            seconds /
            EDITOR_GRID_SECONDS
        ) *
        EDITOR_GRID_SECONDS
    );

}



// ========================================
// 秒 → X座標
// ========================================

function timeToX(seconds) {

    return (
        seconds /
        EDITOR_GRID_SECONDS
    ) *
    EDITOR_GRID_WIDTH;

}



// ========================================
// X座標 → 秒
// ========================================

function xToTime(x) {

    return (
        x /
        EDITOR_GRID_WIDTH
    ) *
    EDITOR_GRID_SECONDS;

}



// ========================================
// MIDI番号 → Y座標
// ========================================

function midiToY(midi) {

    return (
        EDITOR_MAX_NOTE -
        midi
    ) *
    EDITOR_NOTE_HEIGHT;

}



// ========================================
// Y座標 → MIDI番号
// ========================================

function yToMidi(y) {

    return (
        EDITOR_MAX_NOTE -
        Math.round(
            y /
            EDITOR_NOTE_HEIGHT
        )
    );

}



// ========================================
// MIDI番号 → 音名
// ========================================

function midiToName(midi) {

    const names = [
        "C",
        "C♯",
        "D",
        "D♯",
        "E",
        "F",
        "F♯",
        "G",
        "G♯",
        "A",
        "A♯",
        "B"
    ];


    const name =
        names[
            ((midi % 12) + 12) % 12
        ];


    const octave =
        Math.floor(
            midi / 12
        ) - 1;


    return (
        name +
        octave
    );

}



// ========================================
// エディター画面を作成
// ========================================

function createMidiEditor() {

    const old =
        document.getElementById(
            "midiEditorOverlay"
        );


    if (old) {
        old.remove();
    }


    // ====================================
    // 曲の長さを計算
    // ====================================

    let songEnd = 0;


    editorNotes.forEach(function(note) {

        songEnd =
            Math.max(
                songEnd,
                note.time +
                note.duration
            );

    });


    // 必要小節数
    const barSeconds =
        EDITOR_BEAT_SECONDS *
        EDITOR_BEATS_PER_BAR;


    let barCount =
        Math.ceil(
            songEnd /
            barSeconds
        );


    // 最低8小節表示
    barCount =
        Math.max(
            8,
            barCount
        );


    // 少し余白
    barCount += 1;


    const totalBeats =
        barCount *
        EDITOR_BEATS_PER_BAR;


    const rollWidth =
        totalBeats *
        EDITOR_BEAT_WIDTH;


    const rollHeight =
        (
            EDITOR_MAX_NOTE -
            EDITOR_MIN_NOTE +
            1
        ) *
        EDITOR_NOTE_HEIGHT;



    // ====================================
    // 全画面
    // ====================================

    const overlay =
        document.createElement("div");


    overlay.id =
        "midiEditorOverlay";


    Object.assign(
        overlay.style,
        {
            position: "fixed",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            background: "#101010",
            zIndex: "9999",
            display: "flex",
            flexDirection: "column",
            color: "white"
        }
    );



    // ====================================
    // ヘッダー
    // ====================================

    const header =
        document.createElement("div");


    Object.assign(
        header.style,
        {
            padding: "10px",
            background: "#222",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap"
        }
    );


    const title =
        document.createElement("strong");


    title.textContent =
        "堂林翔太　メロディー編集";


    header.appendChild(
        title
    );



    // BPM表示
    const bpmLabel =
        document.createElement("span");


    bpmLabel.textContent =
        "♩ = 170";


    bpmLabel.style.opacity =
        "0.7";


    header.appendChild(
        bpmLabel
    );



    // ====================================
    // 試聴
    // ====================================

    const playButton =
        document.createElement("button");


    playButton.textContent =
        "▶ 試聴";


    playButton.onclick =
        previewEditorNotes;


    header.appendChild(
        playButton
    );



    // ====================================
    // 停止
    // ====================================

    const stopButton =
        document.createElement("button");


    stopButton.textContent =
        "■ 停止";


    stopButton.onclick =
        stopEditorPreview;


    header.appendChild(
        stopButton
    );



    // ====================================
    // 閉じる
    // ====================================

    const closeButton =
        document.createElement("button");


    closeButton.textContent =
        "✕ 閉じる";


    closeButton.onclick =
        function() {

            stopEditorPreview();

            overlay.remove();

        };


    header.appendChild(
        closeButton
    );


    overlay.appendChild(
        header
    );



    // ====================================
    // 説明
    // ====================================

    const info =
        document.createElement("div");


    info.textContent =
        "移動：バーをドラッグ　｜　長さ：バー右端の白い部分をドラッグ　｜　横＝16分音符単位　｜　縦＝半音単位";


    Object.assign(
        info.style,
        {
            padding: "7px 12px",
            background: "#181818",
            fontSize: "13px",
            color: "#bbb"
        }
    );


    overlay.appendChild(
        info
    );



    // ====================================
    // スクロール部分
    // ====================================

    const scrollArea =
        document.createElement("div");


    Object.assign(
        scrollArea.style,
        {
            flex: "1",
            overflow: "auto",
            position: "relative"
        }
    );



    // ====================================
    // ピアノロール
    // ====================================

    const roll =
        document.createElement("div");


    roll.id =
        "midiPianoRoll";


    Object.assign(
        roll.style,
        {
            position: "relative",
            width:
                rollWidth + "px",
            height:
                rollHeight + "px",
            background: "#171717"
        }
    );



    // ====================================
    // 横線
    // ====================================

    for (
        let midi = EDITOR_MIN_NOTE;
        midi <= EDITOR_MAX_NOTE;
        midi++
    ) {

        const row =
            document.createElement("div");


        Object.assign(
            row.style,
            {
                position: "absolute",
                left: "0",
                top:
                    midiToY(midi) +
                    "px",
                width: "100%",
                height:
                    EDITOR_NOTE_HEIGHT +
                    "px",
                boxSizing: "border-box",
                borderBottom:
                    "1px solid #292929"
            }
        );


        // Cだけ少し分かりやすく
        if (midi % 12 === 0) {

            row.style.background =
                "#1d1d1d";

        }


        roll.appendChild(
            row
        );

    }



    // ====================================
    // 小節・拍・16分線
    // ====================================

    const totalGrids =
        totalBeats *
        EDITOR_DIVISIONS;


    for (
        let grid = 0;
        grid <= totalGrids;
        grid++
    ) {

        const line =
            document.createElement("div");


        const x =
            grid *
            EDITOR_GRID_WIDTH;


        const beatNumber =
            grid /
            EDITOR_DIVISIONS;


        const isBeat =
            grid %
            EDITOR_DIVISIONS === 0;


        const isBar =
            grid %
            (
                EDITOR_DIVISIONS *
                EDITOR_BEATS_PER_BAR
            ) === 0;


        Object.assign(
            line.style,
            {
                position: "absolute",
                left:
                    x + "px",
                top: "0",
                height: "100%",
                pointerEvents: "none"
            }
        );


        if (isBar) {

            line.style.width =
                "2px";

            line.style.background =
                "#888";

        }

        else if (isBeat) {

            line.style.width =
                "1px";

            line.style.background =
                "#555";

        }

        else {

            line.style.width =
                "1px";

            line.style.background =
                "#292929";

        }


        roll.appendChild(
            line
        );



        // =================================
        // 小節番号
        // =================================

        if (isBar) {

            const barLabel =
                document.createElement(
                    "div"
                );


            const barNumber =
                Math.floor(
                    grid /
                    (
                        EDITOR_DIVISIONS *
                        EDITOR_BEATS_PER_BAR
                    )
                ) + 1;


            barLabel.textContent =
                barNumber;


            Object.assign(
                barLabel.style,
                {
                    position:
                        "absolute",

                    left:
                        (
                            x + 5
                        ) + "px",

                    top:
                        "3px",

                    color:
                        "#aaa",

                    fontSize:
                        "12px",

                    pointerEvents:
                        "none"
                }
            );


            roll.appendChild(
                barLabel
            );

        }

    }



    // ====================================
    // 音符
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
// 音符バー作成
// ========================================

function createEditorNote(
    roll,
    note,
    index
) {

    const bar =
        document.createElement("div");


    bar.className =
        "midi-editor-note";


    bar.dataset.index =
        index;


    Object.assign(
        bar.style,
        {
            position: "absolute",

            left:
                timeToX(
                    note.time
                ) +
                "px",

            top:
                midiToY(
                    note.midi
                ) +
                "px",

            width:
                Math.max(
                    EDITOR_GRID_WIDTH,
                    timeToX(
                        note.duration
                    )
                ) +
                "px",

            height:
                (
                    EDITOR_NOTE_HEIGHT -
                    4
                ) +
                "px",

            background:
                "#22c55e",

            border:
                "1px solid #86efac",

            borderRadius:
                "3px",

            boxSizing:
                "border-box",

            cursor:
                "grab",

            touchAction:
                "none",

            zIndex:
                "10"
        }
    );



    // 音名
    const label =
        document.createElement("span");


    label.textContent =
        midiToName(
            note.midi
        );


    Object.assign(
        label.style,
        {
            fontSize: "10px",
            paddingLeft: "4px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            color: "#071b0d"
        }
    );


    bar.appendChild(
        label
    );



    // ====================================
    // 右端の長さ変更ハンドル
    // ====================================

    const resizeHandle =
        document.createElement("div");


    Object.assign(
        resizeHandle.style,
        {
            position: "absolute",
            right: "0",
            top: "0",
            width: "9px",
            height: "100%",
            background:
                "rgba(255,255,255,0.65)",
            cursor: "ew-resize",
            touchAction: "none"
        }
    );


    bar.appendChild(
        resizeHandle
    );


    enableNoteMove(
        bar,
        resizeHandle,
        note,
        label
    );


    enableNoteResize(
        bar,
        resizeHandle,
        note
    );


    roll.appendChild(
        bar
    );

}



// ========================================
// 音符移動
// ========================================

function enableNoteMove(
    bar,
    resizeHandle,
    note,
    label
) {

    let dragging = false;

    let startX = 0;
    let startY = 0;

    let originalLeft = 0;
    let originalTop = 0;


    bar.addEventListener(
        "pointerdown",
        function(event) {

            // 右端ならサイズ変更なので
            // 移動処理をしない
            if (
                event.target ===
                resizeHandle
            ) {
                return;
            }


            dragging = true;


            startX =
                event.clientX;

            startY =
                event.clientY;


            originalLeft =
                parseFloat(
                    bar.style.left
                );

            originalTop =
                parseFloat(
                    bar.style.top
                );


            bar.setPointerCapture(
                event.pointerId
            );


            bar.style.cursor =
                "grabbing";

        }
    );


    bar.addEventListener(
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



            // =================================
            // 横方向
            // 16分音符単位
            // =================================

            let left =
                originalLeft +
                dx;


            left =
                Math.round(
                    left /
                    EDITOR_GRID_WIDTH
                ) *
                EDITOR_GRID_WIDTH;


            left =
                Math.max(
                    0,
                    left
                );


            bar.style.left =
                left + "px";



            // =================================
            // 縦方向
            // 半音単位
            // =================================

            let top =
                originalTop +
                dy;


            top =
                Math.round(
                    top /
                    EDITOR_NOTE_HEIGHT
                ) *
                EDITOR_NOTE_HEIGHT;


            const maxTop =
                (
                    EDITOR_MAX_NOTE -
                    EDITOR_MIN_NOTE
                ) *
                EDITOR_NOTE_HEIGHT;


            top =
                Math.max(
                    0,
                    Math.min(
                        maxTop,
                        top
                    )
                );


            bar.style.top =
                top + "px";


            const newMidi =
                yToMidi(
                    top
                );


            label.textContent =
                midiToName(
                    newMidi
                );

        }
    );


    bar.addEventListener(
        "pointerup",
        function(event) {

            if (!dragging) {
                return;
            }


            dragging = false;


            bar.style.cursor =
                "grab";


            const left =
                parseFloat(
                    bar.style.left
                );


            const top =
                parseFloat(
                    bar.style.top
                );


            note.time =
                snapTime(
                    xToTime(
                        left
                    )
                );


            note.midi =
                yToMidi(
                    top
                );


            console.log(
                "音符移動:",
                note
            );

        }
    );

}



// ========================================
// 音符の長さ変更
// ========================================

function enableNoteResize(
    bar,
    resizeHandle,
    note
) {

    let resizing = false;

    let startX = 0;
    let originalWidth = 0;


    resizeHandle.addEventListener(
        "pointerdown",
        function(event) {

            event.stopPropagation();


            resizing = true;


            startX =
                event.clientX;


            originalWidth =
                parseFloat(
                    bar.style.width
                );


            resizeHandle.setPointerCapture(
                event.pointerId
            );

        }
    );


    resizeHandle.addEventListener(
        "pointermove",
        function(event) {

            if (!resizing) {
                return;
            }


            const dx =
                event.clientX -
                startX;


            let width =
                originalWidth +
                dx;


            // 16分単位に吸着
            width =
                Math.round(
                    width /
                    EDITOR_GRID_WIDTH
                ) *
                EDITOR_GRID_WIDTH;


            width =
                Math.max(
                    EDITOR_GRID_WIDTH,
                    width
                );


            bar.style.width =
                width + "px";

        }
    );


    resizeHandle.addEventListener(
        "pointerup",
        function() {

            if (!resizing) {
                return;
            }


            resizing = false;


            const width =
                parseFloat(
                    bar.style.width
                );


            note.duration =
                Math.max(
                    EDITOR_GRID_SECONDS,
                    snapTime(
                        xToTime(
                            width
                        )
                    )
                );


            console.log(
                "音符長変更:",
                note
            );

        }
    );

}



// ========================================
// エディター試聴停止
// ========================================

function stopEditorPreview() {

    editorPreviewSources.forEach(
        function(source) {

            try {
                source.stop();
            }
            catch (error) {
                // 停止済みなら無視
            }

        }
    );


    editorPreviewSources = [];

}



// ========================================
// 編集したメロディーを試聴
// ========================================

async function previewEditorNotes() {

    try {

        stopEditorPreview();


        if (!midiAudioContext) {

            midiAudioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        }


        await midiAudioContext.resume();



        // ====================================
        // 必要な音源を先に読み込む
        // ====================================

        const uniqueNotes =
            [
                ...new Set(
                    editorNotes.map(
                        note =>
                            note.midi
                    )
                )
            ];


        const loaded = {};


        for (
            const midiNumber
            of uniqueNotes
        ) {

            loaded[midiNumber] =
                await loadSound(
                    "melody",
                    midiNumber
                );

        }



        const startTime =
            midiAudioContext.currentTime +
            0.15;



        // ====================================
        // 音符を鳴らす
        // ====================================

        editorNotes.forEach(
            function(note) {

                const sound =
                    loaded[
                        note.midi
                    ];


                const source =
                    midiAudioContext
                        .createBufferSource();


                source.buffer =
                    sound.buffer;


                source.playbackRate.value =
                    sound.rate;



                // =================================
                // 音量
                // =================================

                const gain =
                    midiAudioContext
                        .createGain();


                const volume =
                    Math.min(
                        1,
                        Math.max(
                            0.15,
                            note.velocity /
                            127
                        )
                    );


                const when =
                    startTime +
                    note.time;


                const noteEnd =
                    when +
                    note.duration;


                // 余韻
                const release =
                    0.18;


                gain.gain.setValueAtTime(
                    volume,
                    when
                );


                // 音符終了までは
                // 音量を維持
                gain.gain.setValueAtTime(
                    volume,
                    noteEnd
                );


                // そこから滑らかに消す
                gain.gain.linearRampToValueAtTime(
                    0.0001,
                    noteEnd +
                    release
                );


                source.connect(
                    gain
                );


                gain.connect(
                    midiAudioContext
                        .destination
                );


                source.start(
                    when
                );


                // 元音源の長さを超えて
                // stopしないよう安全に停止
                const availableDuration =
                    sound.buffer.duration /
                    sound.rate;


                const wantedDuration =
                    note.duration +
                    release;


                const actualDuration =
                    Math.min(
                        availableDuration,
                        wantedDuration
                    );


                source.stop(
                    when +
                    actualDuration
                );


                editorPreviewSources.push(
                    source
                );

            }
        );


    } catch (error) {

        console.error(error);


        alert(
            "試聴できませんでした。\n\n" +
            error.message
        );

    }

}